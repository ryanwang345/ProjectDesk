package desk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
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
	WritingZh    string   `json:"writingZh"`
	Speaking     string   `json:"speaking"`
	SpeakingZh   string   `json:"speakingZh"`
	Examples     []string `json:"examples"`
	ExamplesZh   []string `json:"examplesZh"`
	Weak         string   `json:"weak"`
	WeakFixed    string   `json:"weakFixed,omitempty"`
	WeakFixedZh  string   `json:"weakFixedZh,omitempty"`
	Fix          string   `json:"fix"`
	FixZh        string   `json:"fixZh"`
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

func (s *Store) ensureEnglishCache(ctx context.Context) error {
	s.englishMu.RLock()
	if s.englishCached {
		s.englishMu.RUnlock()
		return nil
	}
	s.englishMu.RUnlock()

	s.englishMu.Lock()
	defer s.englishMu.Unlock()
	if s.englishCached {
		return nil
	}
	rows, err := s.pool.Query(ctx, `
		SELECT `+englishColumns+`
		FROM english_cards
		ORDER BY updated_at DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()

	cards := make([]EnglishCard, 0, 4600)
	byID := make(map[string]EnglishCard, 4600)
	byWord := make(map[string]EnglishCard, 4600)
	for rows.Next() {
		card, err := scanEnglish(rows)
		if err != nil {
			return err
		}
		cards = append(cards, card)
		byID[card.ID] = card
		lower := strings.ToLower(card.Word)
		if _, exists := byWord[lower]; !exists {
			byWord[lower] = card
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	sorted := make([]EnglishCard, len(cards))
	copy(sorted, cards)
	sort.Slice(sorted, func(i, j int) bool {
		return strings.ToLower(sorted[i].Word) < strings.ToLower(sorted[j].Word)
	})
	rawJSON, err := json.Marshal(cards)
	if err != nil {
		return err
	}
	s.englishVersion++
	s.englishCards = cards
	s.englishSorted = sorted
	s.englishByID = byID
	s.englishByWord = byWord
	s.englishJSON = rawJSON
	s.englishETag = fmt.Sprintf(`"e-%d-%d"`, s.englishVersion, len(rawJSON))
	s.englishCached = true
	return nil
}

func (s *Store) ListEnglish(ctx context.Context) ([]EnglishCard, error) {
	if err := s.ensureEnglishCache(ctx); err != nil {
		return nil, err
	}
	s.englishMu.RLock()
	out := make([]EnglishCard, len(s.englishCards))
	copy(out, s.englishCards)
	s.englishMu.RUnlock()
	return out, nil
}

func (s *Store) ListEnglishJSON(ctx context.Context) ([]byte, string, error) {
	if err := s.ensureEnglishCache(ctx); err != nil {
		return nil, "", err
	}
	s.englishMu.RLock()
	raw := s.englishJSON
	etag := s.englishETag
	s.englishMu.RUnlock()
	return raw, etag, nil
}

func (s *Store) listEnglishSorted(ctx context.Context) ([]EnglishCard, error) {
	if err := s.ensureEnglishCache(ctx); err != nil {
		return nil, err
	}
	s.englishMu.RLock()
	out := s.englishSorted
	s.englishMu.RUnlock()
	return out, nil
}

func (s *Store) englishCardByID(ctx context.Context, id string) (EnglishCard, bool) {
	if err := s.ensureEnglishCache(ctx); err == nil {
		s.englishMu.RLock()
		card, ok := s.englishByID[id]
		s.englishMu.RUnlock()
		if ok {
			return card, true
		}
	}
	return EnglishCard{}, false
}

func (s *Store) englishCardByWord(ctx context.Context, word string) (EnglishCard, bool) {
	if err := s.ensureEnglishCache(ctx); err == nil {
		s.englishMu.RLock()
		card, ok := s.englishByWord[strings.ToLower(strings.TrimSpace(word))]
		s.englishMu.RUnlock()
		if ok {
			return card, true
		}
	}
	return EnglishCard{}, false
}

func (s *Store) englishCardCount(ctx context.Context) (int, error) {
	if err := s.ensureEnglishCache(ctx); err != nil {
		var count int
		err := s.pool.QueryRow(ctx, `SELECT count(*) FROM english_cards`).Scan(&count)
		return count, err
	}
	s.englishMu.RLock()
	n := len(s.englishCards)
	s.englishMu.RUnlock()
	return n, nil
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
	s.invalidateEnglishCache()
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
	if isInvalidUUID(err) || (errors.Is(err, ErrNotFound) && (strings.HasPrefix(id, "seed-") || !strings.Contains(id, "-"))) {
		wordCandidate := strings.TrimSpace(strings.TrimPrefix(id, "seed-"))
		if wordCandidate != "" {
			row = s.pool.QueryRow(ctx, `
				UPDATE english_cards
				SET in_review = $2
				WHERE lower(word) = lower($1)
				RETURNING `+englishColumns,
				wordCandidate, inReview)
			card, err = scanEnglish(row)
		}
	}
	if errors.Is(err, pgx.ErrNoRows) || isInvalidUUID(err) {
		return EnglishCard{}, ErrNotFound
	}
	if err == nil {
		if inReview {
			_, _ = s.pool.Exec(ctx, `
				INSERT INTO vocabulary_srs (card_id, stability, difficulty, state, due_at, updated_at)
				VALUES ($1, 0.8, 5.5, 'learning', now(), now())
				ON CONFLICT (card_id) DO UPDATE SET
					due_at = LEAST(vocabulary_srs.due_at, now()),
					state = CASE WHEN vocabulary_srs.reps = 0 THEN 'learning' ELSE 'relearning' END,
					updated_at = now()
			`, card.ID)
		}
		s.invalidateEnglishCache()
	}
	return card, err
}

// UpsertEnglishCard creates or updates a vocabulary card and registers it into SRS.
func (s *Store) UpsertEnglishCard(ctx context.Context, in EnglishCard) (EnglishCard, error) {
	word := strings.TrimSpace(in.Word)
	if word == "" {
		return EnglishCard{}, fmt.Errorf("%w: word cannot be empty", ErrInvalid)
	}

	var existingID string
	if in.ID != "" && !strings.HasPrefix(in.ID, "seed-") {
		_ = s.pool.QueryRow(ctx, `SELECT id::text FROM english_cards WHERE id = $1`, in.ID).Scan(&existingID)
	}
	if existingID == "" {
		_ = s.pool.QueryRow(ctx, `SELECT id::text FROM english_cards WHERE lower(word) = lower($1) ORDER BY updated_at DESC LIMIT 1`, word).Scan(&existingID)
	}

	sensesJSON, _ := json.Marshal(in.Senses)
	if in.Senses == nil || len(in.Senses) == 0 {
		sensesJSON = []byte("[]")
	}
	bandJSON, _ := json.Marshal(in.Band)
	if in.Band.Collocations == nil && in.Band.Writing == "" && in.Band.Speaking == "" && in.Band.Zh == "" {
		bandJSON = []byte("{}")
	}
	meaning := strings.TrimSpace(in.Meaning)
	if meaning == "" {
		meaning = word
	}
	if len([]rune(meaning)) > 160 {
		meaning = string([]rune(meaning)[:160])
	}

	examples := in.Examples
	if len(examples) == 0 {
		examples = []string{fmt.Sprintf("I learned the word \"%s\" today.", word)}
	} else if len(examples) > 10 {
		examples = examples[:10]
	}

	var row pgx.Row
	if existingID != "" {
		query := `
			UPDATE english_cards
			SET in_review = $2,
				meaning = CASE WHEN $3 != '' THEN $3 ELSE meaning END,
				pronunciation = CASE WHEN $4 != '' THEN $4 ELSE pronunciation END,
				senses = CASE WHEN $5::jsonb != '[]'::jsonb AND $5::jsonb != 'null'::jsonb THEN $5::jsonb ELSE senses END,
				band = CASE WHEN $6::jsonb != '{}'::jsonb AND $6::jsonb != 'null'::jsonb THEN $6::jsonb ELSE band END,
				updated_at = now()
			WHERE id = $1
			RETURNING ` + englishColumns
		row = s.pool.QueryRow(ctx, query, existingID, in.InReview, meaning, in.Pronunciation, sensesJSON, bandJSON)
	} else {
		query := `
			INSERT INTO english_cards (word, meaning, pronunciation, examples, in_review, senses, band, generated, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, true, now())
			RETURNING ` + englishColumns
		row = s.pool.QueryRow(ctx, query, word, meaning, in.Pronunciation, examples, in.InReview, sensesJSON, bandJSON)
	}

	card, err := scanEnglish(row)
	if err != nil {
		return EnglishCard{}, err
	}

	if card.InReview {
		_, _ = s.pool.Exec(ctx, `
			INSERT INTO vocabulary_srs (card_id, stability, difficulty, state, due_at, updated_at)
			VALUES ($1, 0.8, 5.5, 'learning', now(), now())
			ON CONFLICT (card_id) DO UPDATE SET
				due_at = LEAST(vocabulary_srs.due_at, now()),
				state = CASE WHEN vocabulary_srs.reps = 0 THEN 'learning' ELSE 'relearning' END,
				updated_at = now()
		`, card.ID)
	}

	s.invalidateEnglishCache()
	return card, nil
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
	if card.Band.ExamplesZh == nil {
		card.Band.ExamplesZh = []string{}
	}
	if card.Band.Paraphrases == nil {
		card.Band.Paraphrases = []string{}
	}
	return card, err
}
