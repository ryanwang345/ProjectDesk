package desk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const ExampleCount = 10

const englishColumns = `id::text, word, meaning, examples, in_review, updated_at, generated, pronunciation, senses, band`

type WordSense struct {
	Pos string `json:"pos"`
	En  string `json:"en"`
	Zh  string `json:"zh"`
}

// WordSenses is the learner-dictionary entry for one word.
type WordSenses []WordSense

// BandNote is how to use the word at IELTS band 9.
type BandNote struct {
	Collocations []string `json:"collocations"`
	Writing      string   `json:"writing"`
	Speaking     string   `json:"speaking"`
	Examples     []string `json:"examples"`
	Weak         string   `json:"weak"`
	Fix          string   `json:"fix"`
	Paraphrases  []string `json:"paraphrases"`
	Zh           string   `json:"zh"`
}

type EnglishCard struct {
	ID            string     `json:"id"`
	Word          string     `json:"word"`
	Meaning       string     `json:"meaning"`
	Examples      []string   `json:"examples"`
	InReview      bool       `json:"inReview"`
	Generated     bool       `json:"generated"`
	Pronunciation string     `json:"pronunciation"`
	Senses        WordSenses `json:"senses"`
	Band          BandNote   `json:"band"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

type EnglishInput struct {
	Word     string
	Meaning  string
	Examples []string
}

func (s *Store) ListEnglish(ctx context.Context) ([]EnglishCard, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+englishColumns+`
		FROM english_cards
		ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cards := []EnglishCard{}
	for rows.Next() {
		card, err := scanEnglish(rows)
		if err != nil {
			return nil, err
		}
		cards = append(cards, card)
	}
	return cards, rows.Err()
}

func (s *Store) DeleteEnglish(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM english_cards WHERE id = $1`, id)
	if err != nil {
		if isInvalidUUID(err) {
			return ErrNotFound
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SetEnglishReview(ctx context.Context, id string, inReview bool) (EnglishCard, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE english_cards
		SET in_review = $2
		WHERE id = $1
		RETURNING `+englishColumns,
		id, inReview)
	card, err := scanEnglish(row)
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return EnglishCard{}, ErrNotFound
	}
	return card, err
}

func NormalizeEnglish(input EnglishInput) EnglishInput {
	examples := make([]string, len(input.Examples))
	for i, sentence := range input.Examples {
		examples[i] = strings.TrimSpace(sentence)
	}
	return EnglishInput{
		Word:     strings.TrimSpace(input.Word),
		Meaning:  strings.TrimSpace(input.Meaning),
		Examples: examples,
	}
}

func ValidateEnglish(input EnglishInput) error {
	switch {
	case input.Word == "":
		return fmt.Errorf("%w: enter a word", ErrInvalid)
	case len([]rune(input.Word)) > 80:
		return fmt.Errorf("%w: keep the word under 80 characters", ErrInvalid)
	case input.Meaning == "":
		return fmt.Errorf("%w: enter a meaning", ErrInvalid)
	case len([]rune(input.Meaning)) > 160:
		return fmt.Errorf("%w: keep the meaning under 160 characters", ErrInvalid)
	case len(input.Examples) != ExampleCount:
		return fmt.Errorf("%w: write ten examples", ErrInvalid)
	}
	word := strings.ToLower(input.Word)
	for _, sentence := range input.Examples {
		switch {
		case sentence == "":
			return fmt.Errorf("%w: enter an example", ErrInvalid)
		case len([]rune(sentence)) > 280:
			return fmt.Errorf("%w: keep the example under 280 characters", ErrInvalid)
		case !strings.Contains(strings.ToLower(sentence), word):
			return fmt.Errorf("%w: use the word in the example sentence", ErrInvalid)
		}
	}
	return nil
}

func scanEnglish(row scanner) (EnglishCard, error) {
	var card EnglishCard
	var senses, band []byte
	err := row.Scan(&card.ID, &card.Word, &card.Meaning, &card.Examples, &card.InReview, &card.UpdatedAt, &card.Generated, &card.Pronunciation, &senses, &band)
	if len(senses) > 0 {
		if jsonErr := json.Unmarshal(senses, &card.Senses); jsonErr != nil && err == nil {
			err = jsonErr
		}
	}
	if len(band) > 0 {
		if jsonErr := json.Unmarshal(band, &card.Band); jsonErr != nil && err == nil {
			err = jsonErr
		}
	}
	if card.Examples == nil {
		card.Examples = []string{}
	}
	if card.Senses == nil {
		card.Senses = WordSenses{}
	}
	if card.Band.Collocations == nil {
		card.Band.Collocations = []string{}
	}
	if card.Band.Examples == nil {
		card.Band.Examples = []string{}
	}
	if card.Band.Paraphrases == nil {
		card.Band.Paraphrases = []string{}
	}
	return card, err
}
