package desk

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"projectdesk/internal/ai"
)

var builtinPronunciations = map[string]string{
	"clog":          "/klɒɡ/",
	"additional":    "/əˈdɪʃ.ən.əl/",
	"complimentary": "/ˌkɒm.plɪˈmen.tər.i/",
	"abandon":       "/əˈbæn.dən/",
	"abandonment":   "/əˈbæn.dən.mənt/",
	"abbey":         "/ˈæb.i/",
	"ability":       "/əˈbɪl.ə.ti/",
	"abnormal":      "/æbˈnɔː.məl/",
	"aboard":        "/əˈbɔːd/",
	"abolish":       "/əˈbɒl.ɪʃ/",
	"abortion":      "/əˈbɔː.ʃən/",
}

// WritePronunciations asks the configured model for a British IPA transcription
// of every card that does not have one yet, then stores it. A later start
// skips words that are already saved.
func (s *Store) WritePronunciations(ctx context.Context, sealer *Sealer) {
	provider, _, err := s.ProviderForRole(ctx, "english", sealer)
	if err != nil {
		log.Printf("pronunciations: %v", err)
		return
	}
	if err := s.FillPronunciations(ctx, provider); err != nil {
		log.Printf("pronunciations: %v", err)
	}
}

// AttachPronunciation fills one card when it has no saved transcription.
// Creating or renaming a word uses this so the reply already includes it.
func (s *Store) AttachPronunciation(ctx context.Context, provider ai.Provider, card EnglishCard) (EnglishCard, error) {
	if card.Pronunciation != "" {
		return card, nil
	}
	if ipa, ok := builtinPronunciations[strings.ToLower(card.Word)]; ok {
		return s.savePronunciation(ctx, card.ID, ipa)
	}
	if !realPronunciationModel(provider) {
		return card, nil
	}
	got, err := requestPronunciations(ctx, provider, []EnglishCard{card})
	if err != nil {
		return card, err
	}
	ipa := got[strings.ToLower(card.Word)]
	if ipa == "" {
		return card, nil
	}
	saved, err := s.savePronunciation(ctx, card.ID, ipa)
	if err != nil {
		return card, err
	}
	return saved, nil
}

// FillPronunciations writes IPA for every card that still has an empty
// pronunciation. Words that fail the check are left empty and tried once more.
func (s *Store) FillPronunciations(ctx context.Context, provider ai.Provider) error {
	if !realPronunciationModel(provider) {
		return fmt.Errorf("%w: choose a real model under AI settings", ErrInvalid)
	}
	var saved int
	attempted := false
	for round := 0; round < 2; round++ {
		missing, err := s.wordsWithoutPronunciation(ctx)
		if err != nil {
			return err
		}
		if len(missing) == 0 {
			break
		}
		attempted = true
		if round == 0 {
			log.Printf("writing pronunciations for %d words", len(missing))
		}
		for start := 0; start < len(missing); start += 40 {
			if err := s.waitInteractiveAI(ctx); err != nil {
				return err
			}
			end := start + 40
			if end > len(missing) {
				end = len(missing)
			}
			chunk := missing[start:end]
			got, err := requestPronunciations(ctx, provider, chunk)
			if err != nil {
				return err
			}
			for _, card := range chunk {
				ipa := got[strings.ToLower(card.Word)]
				if ipa == "" {
					continue
				}
				if _, err := s.savePronunciation(ctx, card.ID, ipa); err != nil {
					return err
				}
				saved++
			}
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(150 * time.Millisecond):
			}
		}
	}
	if !attempted {
		return nil
	}
	left, err := s.wordsWithoutPronunciation(ctx)
	if err != nil {
		return err
	}
	log.Printf("pronunciations saved %d, still missing %d", saved, len(left))
	return nil
}

func realPronunciationModel(provider ai.Provider) bool {
	return provider != nil && provider.Kind() != ai.KindDemo && !provider.Capabilities().Simulated
}

func (s *Store) wordsWithoutPronunciation(ctx context.Context) ([]EnglishCard, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+englishColumns+`
		FROM english_cards
		WHERE pronunciation = ''
		ORDER BY lower(word)`)
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

func (s *Store) savePronunciation(ctx context.Context, id, ipa string) (EnglishCard, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE english_cards
		SET pronunciation = $2
		WHERE id = $1 AND pronunciation = ''
		RETURNING `+englishColumns, id, ipa)
	card, err := scanEnglish(row)
	if errors.Is(err, pgx.ErrNoRows) {
		row = s.pool.QueryRow(ctx, `SELECT `+englishColumns+` FROM english_cards WHERE id = $1`, id)
		return scanEnglish(row)
	}
	if err == nil {
		s.invalidateEnglishCache()
	}
	return card, err
}

type pronunciationDraft struct {
	Words []struct {
		Word          string `json:"word"`
		Pronunciation string `json:"pronunciation"`
	} `json:"words"`
}

func requestPronunciations(ctx context.Context, provider ai.Provider, cards []EnglishCard) (map[string]string, error) {
	var draft pronunciationDraft
	_, err := ai.GenerateJSON(ctx, provider, ai.Request{
		Messages: []ai.Message{
			{Role: "system", Content: pronunciationSystem},
			{Role: "user", Content: pronunciationUser(cards)},
		},
		MaxTokens:   2500,
		Temperature: 0.2,
	}, &draft)
	if err != nil {
		return nil, err
	}
	return acceptPronunciations(cards, draft), nil
}

const pronunciationSystem = `You write British English IPA for a learner. Reply with one JSON object and nothing else.
Each pronunciation uses slashes and a stress mark, like /əˈbæn.dən/. Write one pronunciation for each word. Copy the word exactly.`

func pronunciationUser(cards []EnglishCard) string {
	var b strings.Builder
	b.WriteString("Words:\n")
	for _, card := range cards {
		fmt.Fprintf(&b, "- %s | %s\n", card.Word, card.Meaning)
	}
	b.WriteString("\nReturn JSON: {\"words\":[{\"word\":\"abandon\",\"pronunciation\":\"/əˈbæn.dən/\"}]}\n")
	return b.String()
}

func acceptPronunciations(cards []EnglishCard, draft pronunciationDraft) map[string]string {
	want := map[string]bool{}
	for _, card := range cards {
		want[strings.ToLower(card.Word)] = true
	}
	out := map[string]string{}
	for _, item := range draft.Words {
		key := strings.ToLower(strings.TrimSpace(item.Word))
		if !want[key] {
			continue
		}
		ipa := cleanPronunciation(item.Pronunciation)
		if ipa == "" || strings.EqualFold(strings.Trim(ipa, "/"), key) {
			continue
		}
		out[key] = ipa
	}
	return out
}

// cleanPronunciation keeps one IPA transcription. A reply that is only the
// spelling is removed later, once the word is known.
func cleanPronunciation(text string) string {
	text = strings.TrimSpace(text)
	start := strings.IndexByte(text, '/')
	if start < 0 {
		text = "/" + strings.Trim(text, "/") + "/"
		start = 0
	}
	rest := text[start+1:]
	end := strings.IndexByte(rest, '/')
	if end < 0 {
		return ""
	}
	inner := rest[:end]
	if strings.TrimSpace(inner) == "" || strings.Contains(inner, " ") {
		return ""
	}
	full := "/" + inner + "/"
	if n := utf8.RuneCountInString(full); n < 3 || n > 80 {
		return ""
	}
	if !pronunciationBody(inner) {
		return ""
	}
	return full
}

func pronunciationBody(inner string) bool {
	for _, r := range inner {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z':
		case r == '.' || r == '\'' || r == '(' || r == ')' || r == '-' || r == 'ˈ' || r == 'ˌ' || r == 'ː' || r == 'ˑ' || r == 'θ':
		case r >= 0x00C0 && r <= 0x036F:
		default:
			return false
		}
	}
	return true
}
