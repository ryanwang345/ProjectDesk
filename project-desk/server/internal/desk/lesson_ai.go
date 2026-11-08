package desk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"

	"projectdesk/internal/ai"
)

// LessonQuestion is one saved quiz item. The model writes the sentence,
// the choices, the reason, and the Chinese line. Nothing here is a template.
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

type lessonDraft struct {
	Words []struct {
		Word     string   `json:"word"`
		Examples []string `json:"examples"`
	} `json:"words"`
	Questions []LessonQuestion `json:"questions"`
}

func (s *Store) lessonCards(ctx context.Context, index int) ([]EnglishCard, error) {
	if index < 0 {
		return nil, fmt.Errorf("%w: unknown lesson", ErrInvalid)
	}
	all, err := s.ListEnglish(ctx)
	if err != nil {
		return nil, err
	}
	sort.Slice(all, func(i, j int) bool {
		return strings.ToLower(all[i].Word) < strings.ToLower(all[j].Word)
	})
	start := index * 5
	if start >= len(all) {
		return nil, fmt.Errorf("%w: unknown lesson", ErrInvalid)
	}
	end := start + 5
	if end > len(all) {
		end = len(all)
	}
	return all[start:end], nil
}

func (s *Store) loadQuiz(ctx context.Context, lesson int, ids []string) ([]LessonQuestion, bool, error) {
	var raw []byte
	err := s.pool.QueryRow(ctx, `
		SELECT questions
		FROM english_quizzes
		WHERE lesson = $1 AND word_ids = $2`, lesson, ids).Scan(&raw)
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
		INSERT INTO english_quizzes (lesson, word_ids, questions)
		VALUES ($1, $2, $3)
		ON CONFLICT (lesson) DO UPDATE
		SET word_ids = EXCLUDED.word_ids, questions = EXCLUDED.questions, updated_at = now()`,
		lesson, ids, raw)
	return err
}

func (s *Store) saveGeneratedExamples(ctx context.Context, id string, examples []string) (EnglishCard, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE english_cards
		SET examples = $2, generated = true, updated_at = now()
		WHERE id = $1
		RETURNING `+englishColumns, id, examples)
	card, err := scanEnglish(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return EnglishCard{}, ErrNotFound
	}
	return card, err
}

// PrepareLesson returns a lesson whose sentences and quiz were written by the
// model and stored. A later visit uses the saved copy.
func (s *Store) PrepareLesson(ctx context.Context, index int, provider ai.Provider) (LessonPack, error) {
	cards, err := s.lessonCards(ctx, index)
	if err != nil {
		return LessonPack{}, err
	}
	if provider == nil {
		return LessonPack{}, fmt.Errorf("%w: no AI provider is configured; add one under AI settings", ErrInvalid)
	}
	if provider.Kind() == ai.KindDemo || provider.Capabilities().Simulated {
		return LessonPack{}, fmt.Errorf("%w: choose a real model under AI settings", ErrInvalid)
	}
	ids := make([]string, len(cards))
	pending := map[string]bool{}
	for i, card := range cards {
		ids[i] = card.ID
		if !card.Generated {
			pending[strings.ToLower(card.Word)] = true
		}
	}
	if len(pending) == 0 {
		if saved, ok, err := s.loadQuiz(ctx, index, ids); err != nil {
			return LessonPack{}, err
		} else if ok {
			return LessonPack{Cards: cards, Questions: saved}, nil
		}
	}

	var last error
	for attempt := 0; attempt < 2; attempt++ {
		draft, err := requestLesson(ctx, provider, cards, pending, last)
		if err != nil {
			last = err
			continue
		}
		examples, questions, err := acceptLesson(cards, pending, draft)
		if err != nil {
			last = err
			continue
		}
		for i, card := range cards {
			sentences, ok := examples[strings.ToLower(card.Word)]
			if !ok {
				continue
			}
			saved, err := s.saveGeneratedExamples(ctx, card.ID, sentences)
			if err != nil {
				return LessonPack{}, err
			}
			cards[i] = saved
		}
		if err := s.saveQuiz(ctx, index, ids, questions); err != nil {
			return LessonPack{}, err
		}
		return LessonPack{Cards: cards, Questions: questions}, nil
	}
	return LessonPack{}, fmt.Errorf("%w: the model could not write this lesson", ErrInvalid)
}

func requestLesson(ctx context.Context, provider ai.Provider, cards []EnglishCard, pending map[string]bool, previous error) (lessonDraft, error) {
	var draft lessonDraft
	req := ai.Request{
		Messages: []ai.Message{
			{Role: "system", Content: lessonSystem},
			{Role: "user", Content: lessonUser(cards, pending, previous)},
		},
		MaxTokens:   7000,
		Temperature: 0.4,
	}
	if _, err := ai.GenerateJSON(ctx, provider, req, &draft); err != nil {
		return draft, err
	}
	return draft, nil
}

const lessonSystem = `You write everyday English for a learner. Reply with one JSON object and nothing else.
Each example is a sentence a person could actually say. Vary the situations. Do not reuse one sentence pattern.
Every example must contain the given word. Write exactly ten examples for each word that needs them.
Write two questions for every word in the lesson: one "meaning" question and one "cloze" question.
A meaning question asks what the English word means. Its answer is the Chinese meaning you were given, exactly. Its four choices are Chinese meanings, and one of them is the answer.
A cloze question hides the word in one of the examples. "before" is the text before the word and "after" is the text after it. The four choices are English words from this lesson, and one of them is the answer.
"why" is one or two plain sentences about how the word is used in real life, and why a different choice would not fit.
"chinese" is a natural Chinese translation of the full sentence for a cloze question, or the Chinese meaning for a meaning question.`

func lessonUser(cards []EnglishCard, pending map[string]bool, previous error) string {
	var b strings.Builder
	if previous != nil {
		fmt.Fprintf(&b, "Your last reply was rejected: %s\nRewrite the whole JSON object.\n\n", previous.Error())
	}
	b.WriteString("Words that need ten new sentences:\n")
	for _, card := range cards {
		if pending[strings.ToLower(card.Word)] {
			fmt.Fprintf(&b, "- %s | %s\n", card.Word, card.Meaning)
		}
	}
	b.WriteString("\nWords that already have sentences. Use these sentences for the cloze. Do not rewrite them:\n")
	for _, card := range cards {
		if pending[strings.ToLower(card.Word)] {
			continue
		}
		fmt.Fprintf(&b, "- %s | %s\n", card.Word, card.Meaning)
		for i, sentence := range card.Examples {
			fmt.Fprintf(&b, "  %d. %s\n", i+1, sentence)
		}
	}
	b.WriteString(`
Return JSON with this shape:
{"words":[{"word":"...","examples":["...ten sentences..."]}],"questions":[{"id":"word-meaning","kind":"meaning","prompt":"word","answer":"中文","choices":["中文","..."],"why":"...","chinese":"中文"},{"id":"word-cloze","kind":"cloze","before":"...","after":"...","answer":"word","choices":["word","..."],"why":"...","chinese":"..."}]}
Include a words entry only for words that need new sentences. Include both questions for every word.`)
	return b.String()
}

func acceptLesson(cards []EnglishCard, pending map[string]bool, draft lessonDraft) (map[string][]string, []LessonQuestion, error) {
	byWord := map[string]EnglishCard{}
	for _, card := range cards {
		byWord[strings.ToLower(card.Word)] = card
	}
	examples := map[string][]string{}
	seen := map[string]bool{}
	for _, item := range draft.Words {
		key := strings.ToLower(strings.TrimSpace(item.Word))
		card, ok := byWord[key]
		if !ok || !pending[key] {
			continue
		}
		if seen[key] {
			return nil, nil, fmt.Errorf("repeated word %s", card.Word)
		}
		seen[key] = true
		input := NormalizeEnglish(EnglishInput{Word: card.Word, Meaning: card.Meaning, Examples: item.Examples})
		if err := ValidateEnglish(input); err != nil {
			return nil, nil, fmt.Errorf("%s: %w", card.Word, err)
		}
		examples[key] = input.Examples
	}
	for key := range pending {
		if _, ok := examples[key]; !ok {
			return nil, nil, fmt.Errorf("missing ten sentences for %s", byWord[key].Word)
		}
	}

	meaningSeen := map[string]bool{}
	clozeSeen := map[string]bool{}
	words := map[string]bool{}
	meanings := map[string]bool{}
	for _, card := range cards {
		words[strings.ToLower(card.Word)] = true
		meanings[card.Meaning] = true
	}
	if len(draft.Questions) != len(cards)*2 {
		return nil, nil, fmt.Errorf("want %d questions", len(cards)*2)
	}
	out := make([]LessonQuestion, 0, len(draft.Questions))
	for _, question := range draft.Questions {
		question.Kind = strings.TrimSpace(question.Kind)
		question.Answer = strings.TrimSpace(question.Answer)
		question.Why = strings.TrimSpace(question.Why)
		question.Chinese = strings.TrimSpace(question.Chinese)
		question.Prompt = strings.TrimSpace(question.Prompt)
		question.Before = question.Before
		question.After = question.After
		if question.Why == "" || question.Chinese == "" {
			return nil, nil, fmt.Errorf("each question needs a reason and a Chinese line")
		}
		if len(question.Choices) != 4 || !containsFold(question.Choices, question.Answer) {
			return nil, nil, fmt.Errorf("each question needs four choices including the answer")
		}
		switch question.Kind {
		case "meaning":
			key := strings.ToLower(question.Prompt)
			card, ok := byWord[key]
			if !ok || meaningSeen[key] || question.Answer != card.Meaning {
				return nil, nil, fmt.Errorf("meaning question for %s must use its saved meaning", question.Prompt)
			}
			for _, choice := range question.Choices {
				if !meanings[choice] {
					return nil, nil, fmt.Errorf("meaning choice %s is not one of these words", choice)
				}
			}
			meaningSeen[key] = true
			question.ID = card.Word + "-meaning"
		case "cloze":
			key := strings.ToLower(question.Answer)
			card, ok := byWord[key]
			if !ok || clozeSeen[key] {
				return nil, nil, fmt.Errorf("cloze answer %s is not in this lesson", question.Answer)
			}
			sentence := question.Before + question.Answer + question.After
			if !strings.Contains(strings.ToLower(sentence), key) || strings.Contains(strings.ToLower(question.Before+question.After), key) {
				return nil, nil, fmt.Errorf("cloze for %s must hide that word", card.Word)
			}
			for _, choice := range question.Choices {
				if !words[strings.ToLower(choice)] {
					return nil, nil, fmt.Errorf("cloze choice %s is not in this lesson", choice)
				}
			}
			source := examples[key]
			if source == nil {
				source = card.Examples
			}
			if !sentenceIn(source, sentence) {
				return nil, nil, fmt.Errorf("cloze for %s must use one of its sentences", card.Word)
			}
			clozeSeen[key] = true
			question.ID = card.Word + "-cloze"
			question.Answer = card.Word
		default:
			return nil, nil, fmt.Errorf("unknown question kind %s", question.Kind)
		}
		out = append(out, question)
	}
	for _, card := range cards {
		key := strings.ToLower(card.Word)
		if !meaningSeen[key] || !clozeSeen[key] {
			return nil, nil, fmt.Errorf("missing a question for %s", card.Word)
		}
	}
	return examples, out, nil
}

func containsFold(values []string, want string) bool {
	for _, value := range values {
		if strings.EqualFold(strings.TrimSpace(value), want) {
			return true
		}
	}
	return false
}

func sentenceIn(examples []string, sentence string) bool {
	got := strings.Join(strings.Fields(sentence), " ")
	for _, example := range examples {
		if strings.EqualFold(strings.Join(strings.Fields(example), " "), got) {
			return true
		}
	}
	return false
}
