package desk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"projectdesk/internal/ai"
)

func (b BandNote) ready() bool {
	return strings.TrimSpace(b.Writing) != "" && strings.TrimSpace(b.Speaking) != "" && len(b.Examples) > 0
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
		Writing:  "Reducing the administrative burden on teachers allows them to dedicate more time to classroom instruction.",
		Speaking: "I spend far too much of my working week dealing with tedious administrative tasks rather than teaching.",
		Examples: []string{
			"Automating the invoicing workflow significantly reduced our monthly administrative overhead.",
			"The hospital apologized after a patient record was misplaced due to an administrative error.",
			"Universities have been criticized for increasing spending on administrative staff while freezing teaching posts.",
			"Small firms often lack the resources to cope with the heavy administrative costs of regulatory compliance.",
			"She was promoted to department head, a role that carries substantial administrative duties.",
			"The official was placed on paid administrative leave pending the outcome of the investigation.",
		},
		Weak:        "The administrative is very difficult in this company.",
		Fix:         "Use administrative as an adjective before a noun such as burden, tasks, overhead, or error.",
		Paraphrases: []string{"managerial", "bureaucratic", "organizational", "clerical"},
		Zh:          "将 administrative 作为前置形容词修饰具体名词（如 burden、tasks、overhead、error），切勿单独当作名词使用。",
	},
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
	var got map[string]BandNote
	var err error
	for try := 0; try < 2; try++ {
		got, err = requestBand(ctx, provider, pending)
		if err == nil && len(got) > 0 {
			break
		}
	}
	if err != nil {
		return cards, err
	}
	for i, card := range cards {
		note, ok := got[strings.ToLower(card.Word)]
		if !ok {
			continue
		}
		saved, saveErr := s.saveBand(ctx, card.ID, note)
		if saveErr != nil {
			return cards, saveErr
		}
		cards[i] = saved
	}
	return cards, nil
}

func (s *Store) English(ctx context.Context, id string) (EnglishCard, error) {
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
	_, err := ai.GenerateJSON(ctx, provider, ai.Request{
		Messages: []ai.Message{
			{Role: "system", Content: bandSystem},
			{Role: "user", Content: bandUser(cards)},
		},
		MaxTokens:   6000,
		Temperature: 0.3,
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
- speaking: one Speaking Part 3 sentence a person could actually say
- examples: four more natural sentences showing the word across academic, workplace, policy, and everyday contexts
- weak: a clumsy sentence that uses the word but would not reach band 9
- fix: one plain sentence about what to change
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
Return JSON: {"words":[{"word":"factor","band":{"collocations":["a key factor","deciding factor","contributing factor","factor in the decision","environmental factors","risk factor"],"writing":"Cost is a key factor in whether families choose public transport.","speaking":"I think price is a real factor when students pick a course.","examples":["Housing affordability has become a deciding factor for young professionals choosing where to live.","Several environmental factors contributed to the sudden decline in crop yields.","Reliability was the main factor in our decision to switch suppliers.","Age is only one risk factor among many in this medical study."],"weak":"It is a very factor thing.","fix":"Put factor in a noun phrase, such as a key factor.","paraphrases":["cause","influence","determinant","driver"],"zh":"把它放进名词短语，不要只写 very important。"}}]}
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
	note.Speaking = sentenceWith(word, note.Speaking, 280)
	note.Examples = sentencesWith(word, note.Examples, 6, 280, note.Writing, note.Speaking)
	note.Weak = sentenceWith(word, note.Weak, 280)
	note.Fix = oneLine(note.Fix, 220)
	note.Zh = oneLine(note.Zh, 160)
	note.Paraphrases = otherWords(word, note.Paraphrases, 4)
	if len(note.Collocations) < 2 || note.Writing == "" || note.Speaking == "" || len(note.Examples) == 0 || note.Weak == "" || note.Fix == "" || note.Zh == "" || len(note.Paraphrases) < 2 {
		return BandNote{}, false
	}
	return note, true
}

func sentencesWith(word string, items []string, want, limit int, skip ...string) []string {
	out := make([]string, 0, want)
	seen := map[string]bool{}
	for _, s := range skip {
		if key := strings.ToLower(strings.TrimSpace(s)); key != "" {
			seen[key] = true
		}
	}
	for _, item := range items {
		item = sentenceWith(word, item, limit)
		key := strings.ToLower(item)
		if item == "" || seen[key] {
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
