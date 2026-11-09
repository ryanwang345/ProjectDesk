package desk

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

type SaveReadingWordRequest struct {
	SessionID      string `json:"sessionId"`
	PassageID      string `json:"passageId"`
	ParagraphLabel string `json:"paragraphLabel"`
	Selection      string `json:"selection"`
	Definition     string `json:"definition"`
}

type ReadingSavedWord struct {
	ID           string    `json:"id"`
	CardID       string    `json:"cardId"`
	Word         string    `json:"word"`
	Meaning      string    `json:"meaning"`
	Context      string    `json:"context"`
	PassageTitle string    `json:"passageTitle"`
	CreatedAt    time.Time `json:"createdAt"`
}

func readingContextExample(paragraph, term string) string {
	runes := []rune(paragraph)
	if len(runes) <= 280 {
		return paragraph
	}
	index := strings.Index(strings.ToLower(paragraph), strings.ToLower(term))
	if index < 0 {
		return ""
	}
	position := utf8.RuneCountInString(paragraph[:index])
	start := max(0, position-80)
	end := min(len(runes), start+280)
	if end-start < 280 {
		start = max(0, end-280)
	}
	return strings.TrimSpace(string(runes[start:end]))
}

func (s *Store) SaveReadingWord(ctx context.Context, input SaveReadingWordRequest) (EnglishCard, error) {
	term := strings.TrimSpace(input.Selection)
	definition := strings.TrimSpace(input.Definition)
	if term == "" || utf8.RuneCountInString(term) > 80 || utf8.RuneCountInString(definition) > 160 {
		return EnglishCard{}, fmt.Errorf("%w: use a word or phrase under 80 characters and a definition under 160 characters", ErrInvalid)
	}
	bundle, err := s.GetReadingSession(ctx, input.SessionID)
	if err != nil {
		return EnglishCard{}, err
	}
	if bundle.Session.Mode == "exam" && bundle.Session.Status != "submitted" {
		return EnglishCard{}, fmt.Errorf("%w: vocabulary is available after the exam", ErrInvalid)
	}
	var paragraph string
	for _, passage := range bundle.Test.Passages {
		if passage.ID == input.PassageID {
			for _, item := range passage.Paragraphs {
				if item.Label == input.ParagraphLabel {
					paragraph = item.Text
				}
			}
		}
	}
	if paragraph == "" || !strings.Contains(strings.ToLower(paragraph), strings.ToLower(term)) {
		return EnglishCard{}, fmt.Errorf("%w: choose a word or phrase from the passage", ErrInvalid)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return EnglishCard{}, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended(lower($1),1))`, term); err != nil {
		return EnglishCard{}, err
	}
	var id string
	err = tx.QueryRow(ctx, `SELECT id::text FROM english_cards WHERE lower(word)=lower($1) ORDER BY updated_at DESC LIMIT 1`, term).Scan(&id)
	if readingNotFound(err) == ErrNotFound {
		if definition == "" {
			return EnglishCard{}, fmt.Errorf("%w: add a definition before saving a new word", ErrInvalid)
		}
		senses, _ := json.Marshal(WordSenses{{Pos: "context", En: definition}})
		err = tx.QueryRow(ctx, `INSERT INTO english_cards (word,meaning,examples,in_review,senses) VALUES ($1,$2,ARRAY[$3],true,$4::jsonb) RETURNING id::text`, term, definition, readingContextExample(paragraph, term), senses).Scan(&id)
	}
	if err != nil {
		return EnglishCard{}, err
	}
	card, err := scanEnglish(tx.QueryRow(ctx, `UPDATE english_cards SET in_review=true,updated_at=now() WHERE id=$1 RETURNING `+englishColumns, id))
	if err != nil {
		return EnglishCard{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO reading_vocabulary (card_id,session_id,passage_id,paragraph_label,context) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (card_id,session_id,passage_id,paragraph_label) DO NOTHING`, id, input.SessionID, input.PassageID, input.ParagraphLabel, paragraph); err != nil {
		return EnglishCard{}, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO vocabulary_srs (card_id, stability, difficulty, state, due_at, updated_at)
		VALUES ($1, 1.0, 5.5, 'learning', now(), now())
		ON CONFLICT (card_id) DO UPDATE SET
			due_at = LEAST(vocabulary_srs.due_at, now()),
			updated_at = now()
	`, id); err != nil {
		return EnglishCard{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return EnglishCard{}, err
	}
	s.invalidateEnglishCache()
	return card, nil
}

func (s *Store) ListReadingVocabulary(ctx context.Context) ([]ReadingSavedWord, error) {
	rows, err := s.pool.Query(ctx, `SELECT v.id::text,c.id::text,c.word,c.meaning,v.context,COALESCE(p->>'title','Reading passage'),v.created_at FROM reading_vocabulary v JOIN english_cards c ON c.id=v.card_id JOIN reading_sessions s ON s.id=v.session_id JOIN reading_tests t ON t.id=s.test_id LEFT JOIN LATERAL (SELECT value p FROM jsonb_array_elements(t.passages) WHERE value->>'id'=v.passage_id) source ON true ORDER BY v.created_at DESC LIMIT 50`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	words := []ReadingSavedWord{}
	for rows.Next() {
		var word ReadingSavedWord
		if err := rows.Scan(&word.ID, &word.CardID, &word.Word, &word.Meaning, &word.Context, &word.PassageTitle, &word.CreatedAt); err != nil {
			return nil, err
		}
		words = append(words, word)
	}
	return words, rows.Err()
}
