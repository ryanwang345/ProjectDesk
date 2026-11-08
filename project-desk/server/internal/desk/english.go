package desk

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const ExampleCount = 10

const englishColumns = `id::text, word, meaning, examples, in_review, updated_at, generated`

type EnglishCard struct {
	ID        string    `json:"id"`
	Word      string    `json:"word"`
	Meaning   string    `json:"meaning"`
	Examples  []string  `json:"examples"`
	InReview  bool      `json:"inReview"`
	Generated bool      `json:"generated"`
	UpdatedAt time.Time `json:"updatedAt"`
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

func (s *Store) CreateEnglish(ctx context.Context, input EnglishInput) (EnglishCard, error) {
	input = NormalizeEnglish(input)
	if err := ValidateEnglish(input); err != nil {
		return EnglishCard{}, err
	}
	row := s.pool.QueryRow(ctx, `
		INSERT INTO english_cards (word, meaning, examples, generated)
		VALUES ($1, $2, $3, true)
		RETURNING `+englishColumns,
		input.Word, input.Meaning, input.Examples)
	return scanEnglish(row)
}

func (s *Store) UpdateEnglish(ctx context.Context, id string, input EnglishInput) (EnglishCard, error) {
	input = NormalizeEnglish(input)
	if err := ValidateEnglish(input); err != nil {
		return EnglishCard{}, err
	}
	row := s.pool.QueryRow(ctx, `
		UPDATE english_cards
		SET word = $2, meaning = $3, examples = $4, generated = true, updated_at = now()
		WHERE id = $1
		RETURNING `+englishColumns,
		id, input.Word, input.Meaning, input.Examples)
	card, err := scanEnglish(row)
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return EnglishCard{}, ErrNotFound
	}
	return card, err
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
	err := row.Scan(&card.ID, &card.Word, &card.Meaning, &card.Examples, &card.InReview, &card.UpdatedAt, &card.Generated)
	if card.Examples == nil {
		card.Examples = []string{}
	}
	return card, err
}
