package desk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"projectdesk/internal/ai"
)

func (b BandNote) ready() bool {
	return strings.TrimSpace(b.Writing) != "" &&
		strings.TrimSpace(b.WritingZh) != "" &&
		strings.TrimSpace(b.Speaking) != "" &&
		strings.TrimSpace(b.SpeakingZh) != "" &&
		len(b.Examples) > 0 &&
		len(b.ExamplesZh) == len(b.Examples)
}

var builtinBand = map[string]BandNote{
	"administrative": {
		Collocations: []string{
			"administrative burden",
			"administrative tasks",
			"administrative overhead",
			"administrative error",
			"administrative staff",
			"administrative duties",
			"administrative leave",
			"administrative costs",
		},
		Writing:    "Reducing the administrative burden on teachers allows them to dedicate more time to classroom instruction.",
		WritingZh:  "减轻教师的行政负担，能让他们把更多时间投入到课堂教学中。",
		Speaking:   "I spend far too much of my working week dealing with tedious administrative tasks rather than teaching.",
		SpeakingZh: "我每周工作中有太多时间都花在处理繁琐的行政事务上，而不是教学上。",
		Examples: []string{
			"Automating the invoicing workflow significantly reduced our monthly administrative overhead.",
			"The hospital apologized after a patient record was misplaced due to an administrative error.",
			"Universities have been criticized for increasing spending on administrative staff while freezing teaching posts.",
			"Small firms often lack the resources to cope with the heavy administrative costs of regulatory compliance.",
			"She was promoted to department head, a role that carries substantial administrative duties.",
			"The official was placed on paid administrative leave pending the outcome of the investigation.",
		},
		ExamplesZh: []string{
			"将发票流程自动化，显著降低了我们每月的行政管理开销。",
			"病历因行政失误而放错地方后，医院公开致歉。",
			"高校因在冻结教学岗位的同时增加行政人员开支而受到批评。",
			"小企业往往缺乏足够的资源来应对合规带来的高昂行政成本。",
			"她晋升为部门主管，这一职位承担着大量的行政职责。",
			"在调查结果出来之前，该官员被安排带薪行政休假。",
		},
		Weak:        "The administrative is very difficult in this company.",
		Fix:         "Use administrative as an adjective before a noun such as burden, tasks, overhead, or error.",
		FixZh:       "将 administrative 作为形容词放在 burden、tasks、overhead 或 error 等名词前使用。",
		Paraphrases: []string{"managerial", "bureaucratic", "organizational", "clerical"},
		Zh:          "将 administrative 作为前置形容词修饰具体名词（如 burden、tasks、overhead、error），切勿单独当作名词使用。",
	},
	"add": {
		Collocations: []string{
			"add weight to",
			"add fuel to the fire",
			"add a new dimension",
			"add value to",
			"add momentum to",
			"add significantly to",
		},
		Writing:    "These recent findings add considerable weight to the argument that urban green spaces reduce stress.",
		WritingZh:  "这些最新研究结果为“城市绿地能缓解压力”这一论点增添了很有力的分量。",
		Speaking:   "I think working abroad really adds a new dimension to your CV.",
		SpeakingZh: "我认为海外工作经历确实能为你的简历增添新的亮点。",
		Examples: []string{
			"The new features add significant value to the existing software suite.",
			"The policy changes risk adding fuel to the fire during an already volatile economic period.",
			"Successful marketing campaigns add momentum to brand growth.",
			"Increased regulation will add substantially to the operational costs of small businesses.",
		},
		ExamplesZh: []string{
			"这些新功能为现有的软件套件增添了可观的价值。",
			"在经济本就动荡的时期，这些政策变动恐有火上浇油的风险。",
			"成功的营销活动会为品牌增长注入动力。",
			"监管力度的加大将大幅增加小企业的运营成本。",
		},
		Weak:        "We need to add to the problem.",
		Fix:         "Use add in a clear collocation like add to the problem's complexity or add weight to an argument.",
		FixZh:       "把 add 放在明确的搭配中使用，例如 add to the problem's complexity（增加问题的复杂性）或 add weight to an argument（为论点增加分量）。",
		Paraphrases: []string{"contribute to", "augment", "supplement", "incorporate"},
		Zh:          "多用高级搭配如 add weight to 或 add value to，避免单用 add。",
	},
}

type bandFlightCall struct {
	done  chan struct{}
	cards []EnglishCard
	err   error
}

// ApplyBuiltinBand immediately populates built-in Band 9 notes without calling an AI model.
func (s *Store) ApplyBuiltinBand(ctx context.Context, cards []EnglishCard) []EnglishCard {
	out := append([]EnglishCard(nil), cards...)
	for i, card := range out {
		if card.Band.ready() {
			continue
		}
		if note, ok := builtinBand[strings.ToLower(card.Word)]; ok {
			if saved, err := s.saveBand(ctx, card.ID, note); err == nil {
				out[i] = saved
			}
		}
	}
	return out
}

// WarmLessonCardsAsync fills missing pronunciations, Band 9 notes, and weak-sentence fixes
// in the background so lesson startup never blocks on secondary AI calls.
func (s *Store) WarmLessonCardsAsync(provider ai.Provider, cards []EnglishCard) {
	if !realPronunciationModel(provider) || len(cards) == 0 {
		return
	}
	needPron := false
	needBand := false
	needWeak := false
	for _, card := range cards {
		if card.Pronunciation == "" {
			needPron = true
		}
		if !card.Band.ready() {
			needBand = true
		}
		if card.Band.Weak != "" && card.Band.Writing != "" && card.Band.WeakFixed == "" {
			needWeak = true
		}
	}
	if !needPron && !needBand && !needWeak {
		return
	}
	snapshot := append([]EnglishCard(nil), cards...)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()
		if needPron {
			var missing []EnglishCard
			for _, card := range snapshot {
				if card.Pronunciation == "" {
					missing = append(missing, card)
				}
			}
			if len(missing) > 0 {
				if got, err := requestPronunciations(ctx, provider, missing); err == nil {
					for i, card := range snapshot {
						if ipa := got[strings.ToLower(card.Word)]; card.Pronunciation == "" && ipa != "" {
							if saved, saveErr := s.savePronunciation(ctx, card.ID, ipa); saveErr == nil {
								snapshot[i] = saved
							}
						}
					}
				}
			}
		}
		if needBand {
			if next, err := s.EnsureBand(ctx, provider, snapshot); err == nil {
				snapshot = next
			}
		}
		if next, err := s.EnsureWeakFixes(ctx, provider, snapshot); err == nil {
			_ = next
		}
	}()
}

// EnsureBand stores band 9 usage for every card that does not have it yet.
// A model error leaves the cards unchanged so a lesson can still open.
func (s *Store) EnsureBand(ctx context.Context, provider ai.Provider, cards []EnglishCard) ([]EnglishCard, error) {
	pending := make([]EnglishCard, 0, len(cards))
	for i, card := range cards {
		if card.Band.ready() {
			continue
		}
		if note, ok := builtinBand[strings.ToLower(card.Word)]; ok {
			saved, saveErr := s.saveBand(ctx, card.ID, note)
			if saveErr != nil {
				return cards, saveErr
			}
			cards[i] = saved
			continue
		}
		pending = append(pending, card)
	}
	if len(pending) == 0 {
		return cards, nil
	}
	if !realPronunciationModel(provider) {
		return cards, fmt.Errorf("%w: choose a real model under AI settings", ErrInvalid)
	}
	var flightKey string
	if len(pending) == 1 {
		flightKey = pending[0].ID
	} else {
		ids := make([]string, len(pending))
		for i, c := range pending {
			ids[i] = c.ID
		}
		flightKey = strings.Join(ids, ",")
	}
	call := &bandFlightCall{done: make(chan struct{})}
	if actual, loaded := s.bandFlight.LoadOrStore(flightKey, call); loaded {
		existing := actual.(*bandFlightCall)
		select {
		case <-existing.done:
			return existing.cards, existing.err
		case <-ctx.Done():
			return cards, ctx.Err()
		}
	}
	defer func() {
		close(call.done)
		s.bandFlight.Delete(flightKey)
	}()

	doneInteractive := s.beginInteractiveAI()
	defer doneInteractive()

	got, err := requestBand(ctx, provider, pending)
	if err != nil {
		call.cards = cards
		call.err = err
		return cards, err
	}
	for i, card := range cards {
		note, ok := got[strings.ToLower(card.Word)]
		if !ok {
			continue
		}
		saved, saveErr := s.saveBand(ctx, card.ID, note)
		if saveErr != nil {
			call.cards = cards
			call.err = saveErr
			return cards, saveErr
		}
		cards[i] = saved
	}
	call.cards = cards
	return cards, nil
}

// EnsureWeakFixes corrects each weak sentence and explains its actual
// mistake, so a wrong pick in the lesson drill can show the fixed sentence.
func (s *Store) EnsureWeakFixes(ctx context.Context, provider ai.Provider, cards []EnglishCard) ([]EnglishCard, error) {
	var pending []EnglishCard
	for _, card := range cards {
		if card.Band.Weak != "" && card.Band.Writing != "" && card.Band.WeakFixed == "" {
			pending = append(pending, card)
		}
	}
	if len(pending) == 0 || !realPronunciationModel(provider) {
		return cards, nil
	}
	var draft weakFixDraft
	_, err := ai.GenerateJSON(ctx, provider, ai.Request{
		Messages: []ai.Message{
			{Role: "system", Content: weakFixSystem},
			{Role: "user", Content: weakFixUser(pending)},
		},
		MaxTokens:   800 + 300*len(pending),
		Temperature: 0,
	}, &draft)
	if err != nil {
		return cards, err
	}
	fixes := map[string]weakFix{}
	for _, item := range draft.Words {
		fixes[strings.ToLower(strings.TrimSpace(item.Word))] = item
	}
	out := append([]EnglishCard(nil), cards...)
	for i, card := range out {
		item, ok := fixes[strings.ToLower(card.Word)]
		if !ok || card.Band.WeakFixed != "" {
			continue
		}
		note, ok := acceptWeakFix(card.Word, card.Band, item)
		if !ok {
			continue
		}
		saved, err := s.saveBand(ctx, card.ID, note)
		if err != nil {
			return out, err
		}
		out[i] = saved
	}
	return out, nil
}

type weakFix struct {
	Word        string `json:"word"`
	Corrected   string `json:"corrected"`
	CorrectedZh string `json:"correctedZh"`
	Problem     string `json:"problem"`
	ProblemZh   string `json:"problemZh"`
}

type weakFixDraft struct {
	Words []weakFix `json:"words"`
}

func acceptWeakFix(word string, note BandNote, item weakFix) (BandNote, bool) {
	corrected := sentenceWith(word, item.Corrected, 280)
	correctedZh := oneLine(item.CorrectedZh, 280)
	problem := oneLine(item.Problem, 220)
	problemZh := oneLine(item.ProblemZh, 220)
	if corrected == "" || correctedZh == "" || problem == "" || problemZh == "" || strings.EqualFold(corrected, note.Weak) {
		return note, false
	}
	note.WeakFixed = corrected
	note.WeakFixedZh = correctedZh
	note.Fix = problem
	note.FixZh = problemZh
	return note, true
}

const weakFixSystem = `You correct a learner's weak English sentence. Reply with one JSON object and nothing else.
For each word you get a weak sentence that uses it.
- corrected: the same sentence rewritten so it is grammatical, natural, and uses the word correctly. Keep the writer's idea and keep it about as short. Keep the headword exactly.
- correctedZh: a natural Chinese translation of the corrected sentence.
- problem: one plain English sentence naming what was actually wrong in the weak sentence, such as word order, a missing word, the wrong part of speech, or a vague phrase.
- problemZh: a natural Chinese translation of problem.
Only describe mistakes that are really in the weak sentence.`

func weakFixUser(cards []EnglishCard) string {
	var b strings.Builder
	b.WriteString("Weak sentences:\n")
	for _, card := range cards {
		fmt.Fprintf(&b, "- %s (%s): %s\n", card.Word, card.Meaning, card.Band.Weak)
	}
	b.WriteString(`
Return JSON: {"words":[{"word":"factor","corrected":"Cost is a very important factor.","correctedZh":"成本是一个非常重要的因素。","problem":"Factor is a noun, so it cannot follow very; put an adjective such as important before it.","problemZh":"factor 是名词，不能直接放在 very 后面；应在它前面加 important 这样的形容词。"}]}
`)
	return b.String()
}

func (s *Store) English(ctx context.Context, id string) (EnglishCard, error) {
	if card, ok := s.englishCardByID(ctx, id); ok {
		return card, nil
	}
	row := s.pool.QueryRow(ctx, `SELECT `+englishColumns+` FROM english_cards WHERE id = $1`, id)
	card, err := scanEnglish(row)
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return EnglishCard{}, ErrNotFound
	}
	return card, err
}

func (s *Store) saveBand(ctx context.Context, id string, note BandNote) (EnglishCard, error) {
	raw, err := json.Marshal(note)
	if err != nil {
		return EnglishCard{}, err
	}
	row := s.pool.QueryRow(ctx, `
		UPDATE english_cards
		SET band = $2::jsonb
		WHERE id = $1
		RETURNING `+englishColumns, id, raw)
	card, err := scanEnglish(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return s.English(ctx, id)
	}
	if err == nil {
		s.invalidateEnglishCache()
	}
	return card, err
}

type bandDraft struct {
	Words []struct {
		Word string   `json:"word"`
		Band BandNote `json:"band"`
	} `json:"words"`
}

func requestBand(ctx context.Context, provider ai.Provider, cards []EnglishCard) (map[string]BandNote, error) {
	var draft bandDraft
	maxTokens := min(4500, 600+750*len(cards))
	_, err := ai.GenerateJSON(ctx, provider, ai.Request{
		Messages: []ai.Message{
			{Role: "system", Content: bandSystem},
			{Role: "user", Content: bandUser(cards)},
		},
		MaxTokens:   maxTokens,
		Temperature: 0.2,
	}, &draft)
	if err != nil {
		return nil, err
	}
	return acceptBand(cards, draft), nil
}

const bandSystem = `You coach a learner who wants IELTS band 9. Reply with one JSON object and nothing else.
Band 9 vocabulary is precise, natural, and flexible. Use real academic collocations. Do not write a memorized template.
For each word write:
- collocations: six short phrases that contain the word
- writing: one Writing Task 2 sentence that uses the word in a precise way
- writingZh: natural Chinese translation of the writing sentence
- speaking: one Speaking Part 3 sentence a person could actually say
- speakingZh: natural Chinese translation of the speaking sentence
- examples: four more natural sentences showing the word across academic, workplace, policy, and everyday contexts
- examplesZh: four natural Chinese translations matching examples in the exact same order
- weak: a clumsy sentence that uses the word but would not reach band 9
- weakFixed: the weak sentence corrected so it is grammatical and natural, keeping its idea and the headword
- weakFixedZh: natural Chinese translation of weakFixed
- fix: one plain sentence naming what is actually wrong in the weak sentence
- fixZh: natural Chinese translation of fix
- paraphrases: four other ways to express the idea, without repeating the headword
- zh: one or two sentences of Chinese advice
Every collocation, the writing sentence, the speaking sentence, every example sentence, and the weak sentence must contain the headword.
Copy each headword exactly.`

func bandUser(cards []EnglishCard) string {
	var b strings.Builder
	b.WriteString("Words:\n")
	for _, card := range cards {
		fmt.Fprintf(&b, "- %s | %s\n", card.Word, card.Meaning)
	}
	b.WriteString(`
Return JSON: {"words":[{"word":"factor","band":{"collocations":["a key factor","deciding factor","contributing factor","factor in the decision","environmental factors","risk factor"],"writing":"Cost is a key factor in whether families choose public transport.","writingZh":"费用是家庭是否选择公共交通的一个关键因素。","speaking":"I think price is a real factor when students pick a course.","speakingZh":"我认为学生在选择课程时，价格确实是一个实际考量因素。","examples":["Housing affordability has become a deciding factor for young professionals choosing where to live.","Several environmental factors contributed to the sudden decline in crop yields.","Reliability was the main factor in our decision to switch suppliers.","Age is only one risk factor among many in this medical study."],"examplesZh":["住房负担能力已成为年轻职场人士选择居住地的决定性因素。","多种环境因素导致了农作物产量的突然下降。","可靠性是我们决定更换供应商的主要因素。","在这项医学研究中，年龄只是众多风险因素之一。"],"weak":"It is a very factor thing.","weakFixed":"It is a very important factor.","weakFixedZh":"这是一个非常重要的因素。","fix":"Factor is a noun, so it cannot follow very; put it in a noun phrase such as a key factor.","fixZh":"把 factor 放进名词短语中使用，例如 a key factor。","paraphrases":["cause","influence","determinant","driver"],"zh":"把它放进名词短语，不要只写 very important。"}}]}
`)
	return b.String()
}

func acceptBand(cards []EnglishCard, draft bandDraft) map[string]BandNote {
	want := map[string]string{}
	for _, card := range cards {
		want[strings.ToLower(card.Word)] = card.Word
	}
	out := map[string]BandNote{}
	for _, item := range draft.Words {
		key := strings.ToLower(strings.TrimSpace(item.Word))
		word, ok := want[key]
		if !ok {
			continue
		}
		note, ok := normalizeBand(word, item.Band)
		if !ok {
			continue
		}
		out[key] = note
	}
	return out
}

func normalizeBand(word string, note BandNote) (BandNote, bool) {
	note.Collocations = phrasesWith(word, note.Collocations, 8, 80)
	note.Writing = sentenceWith(word, note.Writing, 280)
	note.WritingZh = oneLine(note.WritingZh, 280)
	note.Speaking = sentenceWith(word, note.Speaking, 280)
	note.SpeakingZh = oneLine(note.SpeakingZh, 280)
	note.Examples, note.ExamplesZh = sentencesWithZh(word, note.Examples, note.ExamplesZh, 6, 280, note.Writing, note.Speaking)
	note.Weak = sentenceWith(word, note.Weak, 280)
	note.WeakFixed = sentenceWith(word, note.WeakFixed, 280)
	note.WeakFixedZh = oneLine(note.WeakFixedZh, 280)
	if note.WeakFixed == "" || note.WeakFixedZh == "" || strings.EqualFold(note.WeakFixed, note.Weak) {
		note.WeakFixed, note.WeakFixedZh = "", ""
	}
	note.Fix = oneLine(note.Fix, 220)
	note.FixZh = oneLine(note.FixZh, 220)
	note.Zh = oneLine(note.Zh, 160)
	note.Paraphrases = otherWords(word, note.Paraphrases, 4)
	if len(note.Collocations) < 2 || note.Writing == "" || note.WritingZh == "" || note.Speaking == "" || note.SpeakingZh == "" || len(note.Examples) == 0 || note.Weak == "" || note.Fix == "" || note.Zh == "" || len(note.Paraphrases) < 2 {
		return BandNote{}, false
	}
	return note, true
}

func sentencesWithZh(word string, items, zhItems []string, want, limit int, skip ...string) ([]string, []string) {
	out := make([]string, 0, want)
	outZh := make([]string, 0, want)
	seen := map[string]bool{}
	for _, s := range skip {
		if key := strings.ToLower(strings.TrimSpace(s)); key != "" {
			seen[key] = true
		}
	}
	for i, item := range items {
		item = sentenceWith(word, item, limit)
		key := strings.ToLower(item)
		if item == "" || seen[key] {
			continue
		}
		if i >= len(zhItems) {
			continue
		}
		zh := oneLine(zhItems[i], limit)
		if zh == "" {
			continue
		}
		seen[key] = true
		out = append(out, item)
		outZh = append(outZh, zh)
		if len(out) == want {
			break
		}
	}
	return out, outZh
}

func phrasesWith(word string, items []string, want, limit int) []string {
	out := make([]string, 0, want)
	seen := map[string]bool{}
	for _, item := range items {
		item = oneLine(item, limit)
		key := strings.ToLower(item)
		if item == "" || seen[key] || !containsWord(item, word) {
			continue
		}
		seen[key] = true
		out = append(out, item)
		if len(out) == want {
			break
		}
	}
	return out
}

func sentenceWith(word, text string, limit int) string {
	text = oneLine(text, limit)
	if utf8.RuneCountInString(text) < 12 || !containsWord(text, word) {
		return ""
	}
	return text
}

func otherWords(word string, items []string, want int) []string {
	out := make([]string, 0, want)
	seen := map[string]bool{}
	head := strings.ToLower(strings.TrimSpace(word))
	for _, item := range items {
		item = oneLine(item, 40)
		key := strings.ToLower(item)
		if item == "" || seen[key] || key == head || strings.Contains(key, head) {
			continue
		}
		seen[key] = true
		out = append(out, item)
		if len(out) == want {
			break
		}
	}
	return out
}

func containsWord(text, word string) bool {
	return strings.Contains(strings.ToLower(text), strings.ToLower(strings.TrimSpace(word)))
}
