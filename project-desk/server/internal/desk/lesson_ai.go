package desk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"

	"projectdesk/internal/ai"
)

// LessonQuestion is one saved quiz item. The code chooses the word, the
// sentence, the answer and the choices; the model checks that only the answer
// fits and writes the reason and the Chinese line.
type LessonQuestion struct {
	ID      string   `json:"id"`
	Kind    string   `json:"kind"`
	Prompt  string   `json:"prompt,omitempty"`
	Before  string   `json:"before,omitempty"`
	After   string   `json:"after,omitempty"`
	Answer  string   `json:"answer"`
	Choices []string `json:"choices"`
	Why     string   `json:"why"`
	Chinese string   `json:"chinese"`
}

// LessonPack is the five words for a lesson plus the quiz saved for them.
type LessonPack struct {
	Cards     []EnglishCard    `json:"cards"`
	Questions []LessonQuestion `json:"questions"`
}

// quizVersion changes whenever saved quizzes must be rebuilt.
const quizVersion = 2

// A sentence frame shared by this many words is a fill-in template, not a
// real use of the word.
const templateWords = 3

const maxClozeLength = 220

type lessonFlightCall struct {
	done chan struct{}
	pack LessonPack
	err  error
}

var (
	builtinFramesOnce     sync.Once
	builtinTemplateFrames map[string]bool
	wordPatternCache      sync.Map
)

func getBuiltinTemplateFrames() map[string]bool {
	builtinFramesOnce.Do(func() {
		frames := make(map[string]bool, 400)
		for _, list := range ieltsFramesV1 {
			for _, f := range list {
				frames[strings.ToLower(strings.ReplaceAll(f, "%s", "___"))] = true
			}
		}
		for _, list := range ieltsFrames {
			for _, f := range list {
				frames[strings.ToLower(strings.ReplaceAll(f, "%s", "___"))] = true
			}
		}
		for _, banks := range variedFrames {
			for _, list := range banks {
				for _, f := range list {
					frames[strings.ToLower(strings.ReplaceAll(f, "%s", "___"))] = true
				}
			}
		}
		builtinTemplateFrames = frames
	})
	return builtinTemplateFrames
}

func (s *Store) lessonCards(ctx context.Context, index int) ([]EnglishCard, []EnglishCard, int, error) {
	if index < 0 {
		return nil, nil, 0, fmt.Errorf("%w: unknown lesson", ErrInvalid)
	}
	all, err := s.listEnglishSorted(ctx)
	if err != nil {
		return nil, nil, 0, err
	}
	start := index * 5
	if start >= len(all) {
		return nil, nil, 0, fmt.Errorf("%w: unknown lesson", ErrInvalid)
	}
	end := start + 5
	if end > len(all) {
		end = len(all)
	}
	cards := make([]EnglishCard, end-start)
	copy(cards, all[start:end])
	return cards, all, start, nil
}

func (s *Store) loadQuiz(ctx context.Context, lesson int, ids []string) ([]LessonQuestion, bool, error) {
	var raw []byte
	err := s.pool.QueryRow(ctx, `
		SELECT questions
		FROM english_quizzes
		WHERE lesson = $1 AND word_ids = $2 AND version = $3`, lesson, ids, quizVersion).Scan(&raw)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, false, nil
		}
		return nil, false, err
	}
	var questions []LessonQuestion
	if err := json.Unmarshal(raw, &questions); err != nil {
		return nil, false, err
	}
	return questions, true, nil
}

func (s *Store) saveQuiz(ctx context.Context, lesson int, ids []string, questions []LessonQuestion) error {
	raw, err := json.Marshal(questions)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO english_quizzes (lesson, word_ids, questions, version)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (lesson) DO UPDATE
		SET word_ids = EXCLUDED.word_ids, questions = EXCLUDED.questions,
		    version = EXCLUDED.version, updated_at = now()`,
		lesson, ids, raw, quizVersion)
	return err
}

// realSentences returns the saved sentences of each card that are not
// shared fill-in templates. Sentences are only read, never written.
func (s *Store) realSentences(ctx context.Context, cards []EnglishCard) (map[string][]string, error) {
	all, err := s.listEnglishSorted(ctx)
	if err != nil {
		return nil, err
	}
	useBuiltinFastPath := len(all) >= 500
	knownTemplates := getBuiltinTemplateFrames()
	out := make(map[string][]string, len(cards))

	for _, card := range cards {
		pattern := wordPattern(card.Word)
		for _, sentence := range card.Examples {
			locs := pattern.FindAllStringIndex(sentence, -1)
			var frame, prefixLower, suffixLower string
			if len(locs) == 0 {
				frame = strings.ToLower(sentence)
				prefixLower = frame
			} else if len(locs) == 1 {
				prefixLower = strings.ToLower(sentence[:locs[0][0]])
				suffixLower = strings.ToLower(sentence[locs[0][1]:])
				frame = prefixLower + "___" + suffixLower
			} else {
				prefixLower = strings.ToLower(sentence[:locs[0][0]])
				suffixLower = strings.ToLower(sentence[locs[len(locs)-1][1]:])
				frame = strings.ToLower(pattern.ReplaceAllString(sentence, "___"))
			}
			if useBuiltinFastPath && knownTemplates[frame] {
				continue
			}
			if !isSharedSentenceFrame(all, frame, prefixLower, suffixLower) {
				out[card.ID] = append(out[card.ID], sentence)
			}
		}
	}
	return out, nil
}

func isSharedSentenceFrame(all []EnglishCard, frame, prefixLower, suffixLower string) bool {
	minAffixLen := len(prefixLower) + len(suffixLower)
	matchedCards := 0
	for _, other := range all {
		cardMatched := false
		for _, ex := range other.Examples {
			if len(ex) < minAffixLen {
				continue
			}
			if prefixLower != "" && !strings.EqualFold(ex[:len(prefixLower)], prefixLower) {
				continue
			}
			if suffixLower != "" && !strings.EqualFold(ex[len(ex)-len(suffixLower):], suffixLower) {
				continue
			}
			otherFrame := strings.ToLower(wordPattern(other.Word).ReplaceAllString(ex, "___"))
			if otherFrame == frame {
				cardMatched = true
				break
			}
		}
		if cardMatched {
			matchedCards++
			if matchedCards >= templateWords {
				return true
			}
		}
	}
	return false
}

// PrepareLesson returns a lesson and its saved quiz, writing the quiz once.
// The model never writes words or sentences.
func (s *Store) PrepareLesson(ctx context.Context, index int, provider ai.Provider) (LessonPack, error) {
	cards, all, start, err := s.lessonCards(ctx, index)
	if err != nil {
		return LessonPack{}, err
	}
	ids := make([]string, len(cards))
	for i, card := range cards {
		ids[i] = card.ID
	}
	if saved, ok, err := s.loadQuiz(ctx, index, ids); err != nil {
		return LessonPack{}, err
	} else if ok {
		return LessonPack{Cards: cards, Questions: saved}, nil
	}
	if provider == nil {
		return LessonPack{}, fmt.Errorf("%w: no AI provider is configured; add one under AI settings", ErrInvalid)
	}
	if provider.Kind() == ai.KindDemo || provider.Capabilities().Simulated {
		return LessonPack{}, fmt.Errorf("%w: choose a real model under AI settings", ErrInvalid)
	}

	call := &lessonFlightCall{done: make(chan struct{})}
	if actual, loaded := s.lessonFlight.LoadOrStore(index, call); loaded {
		existing := actual.(*lessonFlightCall)
		select {
		case <-existing.done:
			return existing.pack, existing.err
		case <-ctx.Done():
			return LessonPack{}, ctx.Err()
		}
	}
	defer func() {
		close(call.done)
		s.lessonFlight.Delete(index)
	}()

	doneInteractive := s.beginInteractiveAI()
	defer doneInteractive()

	genCtx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	real, err := s.realSentences(genCtx, cards)
	if err != nil {
		call.err = err
		return LessonPack{}, err
	}
	cards, err = s.lessonSenses(genCtx, provider, cards, real)
	if err != nil {
		call.err = err
		return LessonPack{}, err
	}

	plan := newQuizPlan(cards, real, neighbours(all, start, len(cards)))
	var last error
	for attempt := 0; attempt < 2; attempt++ {
		pending := plan.next()
		if len(pending) == 0 {
			break
		}
		review, err := requestReview(genCtx, provider, pending)
		if err != nil {
			if providerBusy(err) {
				call.err = err
				return LessonPack{}, err
			}
			last = err
			continue
		}
		plan.apply(pending, review)
		if len(plan.questions()) >= len(cards)*2-1 {
			break
		}
	}
	questions := plan.questions()
	if len(questions) == 0 {
		if last != nil {
			call.err = fmt.Errorf("the model could not check this lesson: %w", last)
			return LessonPack{}, call.err
		}
		call.err = fmt.Errorf("the model could not check this lesson")
		return LessonPack{}, call.err
	}
	if err := s.saveQuiz(genCtx, index, ids, questions); err != nil {
		call.err = err
		return LessonPack{}, err
	}
	call.pack = LessonPack{Cards: cards, Questions: questions}
	return call.pack, nil
}

// lessonSenses fills dictionary senses for words that have no real sentence,
// so they can get a definition question instead of a cloze.
func (s *Store) lessonSenses(ctx context.Context, provider ai.Provider, cards []EnglishCard, real map[string][]string) ([]EnglishCard, error) {
	var need []EnglishCard
	for _, card := range cards {
		if len(card.Senses) == 0 && len(clozeSentences(card, real[card.ID])) == 0 {
			need = append(need, card)
		}
	}
	if len(need) == 0 || !realPronunciationModel(provider) {
		return cards, nil
	}
	got, err := requestSensesFast(ctx, provider, need)
	if err != nil {
		if providerBusy(err) {
			return nil, err
		}
		return cards, nil
	}
	out := append([]EnglishCard(nil), cards...)
	for i, card := range out {
		senses := got[strings.ToLower(card.Word)]
		if len(card.Senses) > 0 || len(senses) == 0 {
			continue
		}
		saved, err := s.saveSenses(ctx, card.ID, senses)
		if err != nil {
			return nil, err
		}
		out[i] = saved
	}
	return out, nil
}

// neighbours lists the cards around a lesson, nearest first, for extra
// choices when the lesson itself has too few.
func neighbours(all []EnglishCard, start, size int) []EnglishCard {
	var out []EnglishCard
	for step := 1; len(out) < 40; step++ {
		after, before := start+size-1+step, start-step
		if after >= len(all) && before < 0 {
			break
		}
		if after < len(all) {
			out = append(out, all[after])
		}
		if before >= 0 {
			out = append(out, all[before])
		}
	}
	return out
}

func wordPattern(word string) *regexp.Regexp {
	key := strings.ToLower(strings.TrimSpace(word))
	if cached, ok := wordPatternCache.Load(key); ok {
		return cached.(*regexp.Regexp)
	}
	compiled := regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(strings.TrimSpace(word)) + `\b`)
	wordPatternCache.Store(key, compiled)
	return compiled
}

// clozeSentences keeps real sentences that show the exact word once.
func clozeSentences(card EnglishCard, real []string) []string {
	pattern := wordPattern(card.Word)
	var out []string
	for _, sentence := range real {
		sentence = strings.Join(strings.Fields(sentence), " ")
		if len(sentence) > maxClozeLength || len(pattern.FindAllStringIndex(sentence, -1)) != 1 {
			continue
		}
		out = append(out, sentence)
	}
	return out
}

// definitionFor picks the learner definition that matches the saved meaning
// and does not give the word away.
func definitionFor(card EnglishCard) string {
	word := strings.ToLower(strings.TrimSpace(card.Word))
	var first string
	for _, sense := range card.Senses {
		en := strings.TrimSpace(sense.En)
		if en == "" || strings.Contains(strings.ToLower(en), word) {
			continue
		}
		if first == "" {
			first = en
		}
		if sense.Zh != "" && (strings.Contains(sense.Zh, card.Meaning) || strings.Contains(card.Meaning, sense.Zh)) {
			return en
		}
	}
	return first
}

type plannedQuestion struct {
	LessonQuestion
	card     EnglishCard
	sentence string
}

// quizPlan builds two questions per word: a meaning question, then a cloze
// from a real sentence or, without one, a definition question. Choices the
// model says also fit are swapped out on the next round.
type quizPlan struct {
	cards     []EnglishCard
	real      map[string][]string
	extra     []EnglishCard
	avoid     map[string]bool
	dropped   map[string]bool
	accepted  map[string]LessonQuestion
	sentences map[string]bool
}

func newQuizPlan(cards []EnglishCard, real map[string][]string, extra []EnglishCard) *quizPlan {
	plan := &quizPlan{
		cards:     cards,
		real:      real,
		extra:     extra,
		avoid:     map[string]bool{},
		dropped:   map[string]bool{},
		accepted:  map[string]LessonQuestion{},
		sentences: map[string]bool{},
	}
	for _, card := range append(append([]EnglishCard{}, cards...), extra...) {
		for _, example := range card.Examples {
			plan.sentences[strings.ToLower(strings.Join(strings.Fields(example), " "))] = true
		}
	}
	return plan
}

func slotKey(card EnglishCard, slot string) string {
	return strings.ToLower(card.Word) + "-" + slot
}

func (p *quizPlan) next() []plannedQuestion {
	var out []plannedQuestion
	for _, card := range p.cards {
		if _, ok := p.accepted[slotKey(card, "meaning")]; !ok && !p.dropped[slotKey(card, "meaning")] {
			if q, ok := p.meaning(card); ok {
				out = append(out, q)
			}
		}
	}
	for _, card := range p.cards {
		if _, ok := p.accepted[slotKey(card, "use")]; ok {
			continue
		}
		if q, ok := p.use(card); ok {
			out = append(out, q)
		}
	}
	return out
}

func (p *quizPlan) meaning(card EnglishCard) (plannedQuestion, bool) {
	id := card.Word + "-meaning"
	answer := strings.TrimSpace(card.Meaning)
	if answer == "" {
		return plannedQuestion{}, false
	}
	own := []string{answer}
	for _, sense := range card.Senses {
		own = append(own, sense.Zh)
	}
	choices := []string{answer}
	for _, other := range p.candidates(card) {
		meaning := strings.TrimSpace(other.Meaning)
		if meaning == "" || p.avoid[id+"\x00"+meaning] || overlaps(meaning, own) || overlaps(meaning, choices) {
			continue
		}
		choices = append(choices, meaning)
		if len(choices) == 4 {
			break
		}
	}
	if len(choices) < 4 {
		return plannedQuestion{}, false
	}
	return plannedQuestion{
		LessonQuestion: LessonQuestion{ID: id, Kind: "meaning", Prompt: card.Word, Answer: answer, Choices: p.shuffle(choices), Chinese: answer},
		card:           card,
	}, true
}

func (p *quizPlan) use(card EnglishCard) (plannedQuestion, bool) {
	for _, sentence := range clozeSentences(card, p.real[card.ID]) {
		id := card.Word + "-cloze"
		if p.dropped[id+"\x00"+sentence] {
			continue
		}
		loc := wordPattern(card.Word).FindStringIndex(sentence)
		before, after := sentence[:loc[0]], sentence[loc[1]:]
		choices := p.wordChoices(card, id, func(other EnglishCard) bool {
			return p.sentences[strings.ToLower(before+other.Word+after)]
		})
		if choices == nil {
			continue
		}
		return plannedQuestion{
			LessonQuestion: LessonQuestion{ID: id, Kind: "cloze", Before: before, After: after, Answer: card.Word, Choices: choices},
			card:           card,
			sentence:       sentence,
		}, true
	}
	id := card.Word + "-definition"
	definition := definitionFor(card)
	if definition == "" || p.dropped[id] {
		return plannedQuestion{}, false
	}
	choices := p.wordChoices(card, id, nil)
	if choices == nil {
		return plannedQuestion{}, false
	}
	return plannedQuestion{
		LessonQuestion: LessonQuestion{ID: id, Kind: "definition", Prompt: definition, Answer: card.Word, Choices: choices, Chinese: card.Meaning},
		card:           card,
	}, true
}

func (p *quizPlan) wordChoices(card EnglishCard, id string, alsoRight func(EnglishCard) bool) []string {
	choices := []string{card.Word}
	for _, other := range p.candidates(card) {
		if p.avoid[id+"\x00"+strings.ToLower(other.Word)] || containsFold(choices, other.Word) {
			continue
		}
		if alsoRight != nil && alsoRight(other) {
			continue
		}
		choices = append(choices, other.Word)
		if len(choices) == 4 {
			return p.shuffle(choices)
		}
	}
	return nil
}

// candidates lists other lesson words first, then the nearest other words.
func (p *quizPlan) candidates(card EnglishCard) []EnglishCard {
	out := make([]EnglishCard, 0, len(p.cards)+len(p.extra))
	for _, other := range append(append([]EnglishCard{}, p.cards...), p.extra...) {
		if !strings.EqualFold(other.Word, card.Word) {
			out = append(out, other)
		}
	}
	return out
}

func (p *quizPlan) shuffle(choices []string) []string {
	out := append([]string(nil), choices...)
	rand.Shuffle(len(out), func(i, j int) { out[i], out[j] = out[j], out[i] })
	return out
}

func overlaps(meaning string, others []string) bool {
	for _, other := range others {
		other = strings.TrimSpace(other)
		if other == "" {
			continue
		}
		if meaning == other || strings.Contains(meaning, other) || strings.Contains(other, meaning) {
			return true
		}
	}
	return false
}

type quizReview struct {
	Questions []struct {
		ID      string   `json:"id"`
		Fits    []string `json:"fits"`
		Why     string   `json:"why"`
		Chinese string   `json:"chinese"`
	} `json:"questions"`
}

// apply keeps questions where the answer is the only choice that fits. It
// marks extra fitting choices to avoid, and drops a sentence or question
// whose own answer does not fit.
func (p *quizPlan) apply(pending []plannedQuestion, review quizReview) {
	byID := map[string]int{}
	for i, item := range review.Questions {
		byID[strings.ToLower(strings.TrimSpace(item.ID))] = i
	}
	for _, q := range pending {
		i, ok := byID[strings.ToLower(q.ID)]
		if !ok {
			continue
		}
		item := review.Questions[i]
		answerFits := false
		var extra []string
		for _, fit := range item.Fits {
			fit = strings.TrimSpace(fit)
			if !containsFold(q.Choices, fit) {
				continue
			}
			if strings.EqualFold(fit, q.Answer) {
				answerFits = true
			} else {
				extra = append(extra, fit)
			}
		}
		slot := slotKey(q.card, "use")
		if q.Kind == "meaning" {
			slot = slotKey(q.card, "meaning")
		}
		if !answerFits {
			switch q.Kind {
			case "cloze":
				p.dropped[q.ID+"\x00"+q.sentence] = true
			case "definition":
				p.dropped[q.ID] = true
			default:
				p.dropped[slot] = true
			}
			continue
		}
		if len(extra) > 0 {
			for _, choice := range extra {
				if q.Kind == "meaning" {
					p.avoid[q.ID+"\x00"+choice] = true
				} else {
					p.avoid[q.ID+"\x00"+strings.ToLower(choice)] = true
				}
			}
			continue
		}
		why := strings.TrimSpace(item.Why)
		chinese := strings.TrimSpace(item.Chinese)
		if q.Kind != "cloze" {
			chinese = q.Chinese
		}
		if why == "" || chinese == "" {
			continue
		}
		accepted := q.LessonQuestion
		accepted.Why = why
		accepted.Chinese = chinese
		p.accepted[slot] = accepted
	}
}

// questions lists every meaning question, then the cloze and definition ones.
func (p *quizPlan) questions() []LessonQuestion {
	var out []LessonQuestion
	for _, slot := range []string{"meaning", "use"} {
		for _, card := range p.cards {
			if q, ok := p.accepted[slotKey(card, slot)]; ok {
				out = append(out, q)
			}
		}
	}
	return out
}

func requestReview(ctx context.Context, provider ai.Provider, pending []plannedQuestion) (quizReview, error) {
	var review quizReview
	_, err := ai.GenerateJSON(ctx, provider, ai.Request{
		Messages: []ai.Message{
			{Role: "system", Content: reviewSystem},
			{Role: "user", Content: reviewUser(pending)},
		},
		MaxTokens:   400 + 220*len(pending),
		Temperature: 0,
	}, &review)
	return review, err
}

const reviewSystem = `You check a vocabulary quiz for a Chinese learner of English, then explain each answer. Reply with one JSON object and nothing else.
For every question, judge each choice on its own and list in "fits" every choice that is a correct answer:
- meaning: every Chinese choice that is an accurate translation of the English word in common use.
- cloze: every English choice that, put in the blank, makes a grammatical and natural sentence a fluent speaker would accept, whatever it would then mean. Ignore the intended meaning for this test.
- definition: every English choice that the definition describes accurately.
Be strict and honest. Leave the marked answer out of "fits" if it is wrong, or if the sentence or definition is unnatural.
"why" is one or two plain English sentences: what the answer means here, and why the other choices do not fit. Call a choice ungrammatical only when it really is; otherwise explain the difference in meaning.
"chinese" is a natural Chinese translation of the whole cloze sentence with the answer filled in. Use an empty string for other kinds.`

func reviewUser(pending []plannedQuestion) string {
	var b strings.Builder
	b.WriteString("Questions:\n")
	for _, q := range pending {
		fmt.Fprintf(&b, "- id: %s\n  kind: %s\n", q.ID, q.Kind)
		switch q.Kind {
		case "meaning":
			fmt.Fprintf(&b, "  word: %s\n", q.Prompt)
		case "cloze":
			fmt.Fprintf(&b, "  sentence: %s___%s\n  intended meaning: %s\n", q.Before, q.After, q.card.Meaning)
		case "definition":
			fmt.Fprintf(&b, "  definition: %s\n", q.Prompt)
		}
		fmt.Fprintf(&b, "  choices: %s\n  marked answer: %s\n", strings.Join(q.Choices, " | "), q.Answer)
	}
	b.WriteString(`
Return JSON: {"questions":[{"id":"abroad-cloze","fits":["abroad"],"why":"...","chinese":"..."}]}
Include every question once.`)
	return b.String()
}

func containsFold(values []string, want string) bool {
	for _, value := range values {
		if strings.EqualFold(strings.TrimSpace(value), strings.TrimSpace(want)) {
			return true
		}
	}
	return false
}
