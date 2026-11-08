package desk

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"projectdesk/internal/ai"
)

func (s *WordSenses) Scan(src any) error {
	var raw []byte
	switch v := src.(type) {
	case nil:
		*s = WordSenses{}
		return nil
	case []byte:
		raw = v
	case string:
		raw = []byte(v)
	default:
		return fmt.Errorf("senses: unexpected %T", src)
	}
	if len(raw) == 0 {
		*s = WordSenses{}
		return nil
	}
	if err := json.Unmarshal(raw, s); err != nil {
		return err
	}
	if *s == nil {
		*s = WordSenses{}
	}
	return nil
}

// WriteSenses stores a short learner-dictionary entry for every word that
// does not have one yet. A published dictionary supplies the senses, and the
// model rewrites them in simple original English plus Chinese.
func (s *Store) WriteSenses(ctx context.Context, sealer *Sealer) {
	provider, _, err := s.ProviderForRole(ctx, "english", sealer)
	if err != nil {
		log.Printf("senses: %v", err)
		return
	}
	var last error
	for attempt := 0; attempt < 4; attempt++ {
		if attempt > 0 {
			wait := time.Duration(attempt) * 15 * time.Second
			log.Printf("senses: retrying in %s", wait)
			select {
			case <-ctx.Done():
				return
			case <-time.After(wait):
			}
		}
		last = s.FillSenses(ctx, provider)
		if last == nil || ctx.Err() != nil || providerBusy(last) {
			break
		}
	}
	if last != nil {
		log.Printf("senses: %v", last)
	}
}

// AttachSenses fills the dictionary entry for one new or renamed word.
func (s *Store) AttachSenses(ctx context.Context, provider ai.Provider, card EnglishCard) (EnglishCard, error) {
	if len(card.Senses) > 0 || !realPronunciationModel(provider) {
		return card, nil
	}
	got, err := requestSensesRetry(ctx, provider, []EnglishCard{card})
	if err != nil {
		return card, err
	}
	senses := got[strings.ToLower(card.Word)]
	if len(senses) == 0 {
		return card, nil
	}
	return s.saveSenses(ctx, card.ID, senses)
}

// FillSenses writes entries for cards whose senses are still empty.
func (s *Store) FillSenses(ctx context.Context, provider ai.Provider) error {
	if !realPronunciationModel(provider) {
		return fmt.Errorf("%w: choose a real model under AI settings", ErrInvalid)
	}
	var saved int
	attempted := false
	for round := 0; round < 2; round++ {
		missing, err := s.wordsWithoutSenses(ctx)
		if err != nil {
			return err
		}
		if len(missing) == 0 {
			break
		}
		attempted = true
		if round == 0 {
			log.Printf("writing dictionary senses for %d words", len(missing))
		}
		for start := 0; start < len(missing); start += 4 {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			end := start + 4
			if end > len(missing) {
				end = len(missing)
			}
			chunk := missing[start:end]
			got, err := requestSensesRetry(ctx, provider, chunk)
			if err != nil {
				if providerBusy(err) {
					return err
				}
				log.Printf("senses: %s", err.Error())
				continue
			}
			for _, card := range chunk {
				senses := got[strings.ToLower(card.Word)]
				if len(senses) == 0 {
					continue
				}
				if _, err := s.saveSenses(ctx, card.ID, senses); err != nil {
					return err
				}
				saved++
			}
		}
	}
	if !attempted {
		return nil
	}
	left, err := s.wordsWithoutSenses(ctx)
	if err != nil {
		return err
	}
	log.Printf("dictionary senses saved %d, still missing %d", saved, len(left))
	if len(left) > 0 {
		return fmt.Errorf("still missing %d senses", len(left))
	}
	return nil
}

func (s *Store) wordsWithoutSenses(ctx context.Context) ([]EnglishCard, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+englishColumns+`
		FROM english_cards
		WHERE senses = '[]'::jsonb
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

func (s *Store) saveSenses(ctx context.Context, id string, senses WordSenses) (EnglishCard, error) {
	raw, err := json.Marshal(senses)
	if err != nil {
		return EnglishCard{}, err
	}
	row := s.pool.QueryRow(ctx, `
		UPDATE english_cards
		SET senses = $2::jsonb
		WHERE id = $1 AND senses = '[]'::jsonb
		RETURNING `+englishColumns, id, raw)
	card, err := scanEnglish(row)
	if errors.Is(err, pgx.ErrNoRows) {
		row = s.pool.QueryRow(ctx, `SELECT `+englishColumns+` FROM english_cards WHERE id = $1`, id)
		return scanEnglish(row)
	}
	return card, err
}

type senseDraft struct {
	Words []struct {
		Word   string     `json:"word"`
		Senses WordSenses `json:"senses"`
	} `json:"words"`
}

func quotaExceeded(err error) bool {
	return providerBusy(err)
}

func providerBusy(err error) bool {
	var providerErr *ai.ErrProvider
	if err == nil || !errors.As(err, &providerErr) {
		return false
	}
	return providerErr.Status == http.StatusTooManyRequests || providerErr.Status == http.StatusServiceUnavailable
}

func requestSensesRetry(ctx context.Context, provider ai.Provider, cards []EnglishCard) (map[string]WordSenses, error) {
	var last error
	for try := 0; try < 3; try++ {
		if try > 0 {
			wait := time.Duration(try) * 3 * time.Second
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(wait):
			}
		}
		got, err := requestSenses(ctx, provider, cards)
		if err == nil {
			return got, nil
		}
		last = err
		if ctx.Err() != nil || providerBusy(err) {
			return nil, err
		}
	}
	return nil, last
}

func requestSenses(ctx context.Context, provider ai.Provider, cards []EnglishCard) (map[string]WordSenses, error) {
	notes := dictionaryBriefs(ctx, cards)
	var draft senseDraft
	_, err := ai.GenerateJSON(ctx, provider, ai.Request{
		Messages: []ai.Message{
			{Role: "system", Content: senseSystem},
			{Role: "user", Content: senseUser(cards, notes)},
		},
		MaxTokens:   4000,
		Temperature: 0.2,
	}, &draft)
	if err != nil {
		return nil, err
	}
	return acceptSenses(cards, draft), nil
}

const senseSystem = `You write a small learner-dictionary entry. Reply with one JSON object and nothing else.
The notes list real dictionary senses. Use them to decide the part of speech and how many meanings to include, then write your own simple English. Do not copy a sentence from the notes or from any published dictionary.
Give two to four senses when the word has more than one use. Each sense has pos, en, and zh.
pos is one of: noun, verb, adjective, adverb, preposition, conjunction, pronoun, determiner, phrase.
en is one short sentence a learner can understand. zh is a short Chinese meaning for that sense.
Copy each headword exactly.`

func senseUser(cards []EnglishCard, notes map[string]string) string {
	var b strings.Builder
	b.WriteString("Words:\n")
	for _, card := range cards {
		fmt.Fprintf(&b, "- %s | current gloss: %s\n", card.Word, card.Meaning)
		if note := notes[strings.ToLower(card.Word)]; note != "" {
			fmt.Fprintf(&b, "  dictionary notes:\n%s\n", indentNote(note))
		}
	}
	b.WriteString("\nReturn JSON: {\"words\":[{\"word\":\"approach\",\"senses\":[{\"pos\":\"noun\",\"en\":\"a way of dealing with something\",\"zh\":\"方法\"},{\"pos\":\"verb\",\"en\":\"to move closer to someone\",\"zh\":\"靠近\"}]}]}\n")
	return b.String()
}

func indentNote(note string) string {
	lines := strings.Split(note, "\n")
	for i, line := range lines {
		lines[i] = "  - " + line
	}
	return strings.Join(lines, "\n")
}

func acceptSenses(cards []EnglishCard, draft senseDraft) map[string]WordSenses {
	want := map[string]bool{}
	for _, card := range cards {
		want[strings.ToLower(card.Word)] = true
	}
	out := map[string]WordSenses{}
	for _, item := range draft.Words {
		key := strings.ToLower(strings.TrimSpace(item.Word))
		if !want[key] {
			continue
		}
		senses := normalizeSenses(item.Senses)
		if len(senses) == 0 {
			continue
		}
		out[key] = senses
	}
	return out
}

func normalizeSenses(in WordSenses) WordSenses {
	out := make(WordSenses, 0, 4)
	seen := map[string]bool{}
	for _, sense := range in {
		pos := normalizePos(sense.Pos)
		en := oneLine(sense.En, 180)
		zh := oneLine(sense.Zh, 80)
		if pos == "" || en == "" || zh == "" {
			continue
		}
		key := pos + "\n" + zh
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, WordSense{Pos: pos, En: en, Zh: zh})
		if len(out) == 4 {
			break
		}
	}
	return out
}

func oneLine(text string, limit int) string {
	text = strings.Join(strings.Fields(text), " ")
	if text == "" {
		return ""
	}
	if utf8.RuneCountInString(text) > limit {
		runes := []rune(text)
		text = strings.TrimSpace(string(runes[:limit]))
	}
	return text
}

var posNames = map[string]string{
	"n": "noun", "noun": "noun",
	"v": "verb", "verb": "verb", "vt": "verb", "vi": "verb",
	"adj": "adjective", "adjective": "adjective",
	"adv": "adverb", "adverb": "adverb",
	"prep": "preposition", "preposition": "preposition",
	"conj": "conjunction", "conjunction": "conjunction",
	"pron": "pronoun", "pronoun": "pronoun",
	"det": "determiner", "determiner": "determiner",
	"phrase": "phrase",
}

func normalizePos(pos string) string {
	pos = strings.ToLower(strings.Trim(strings.TrimSpace(pos), "."))
	if name, ok := posNames[pos]; ok {
		return name
	}
	switch {
	case strings.Contains(pos, "verb"):
		return "verb"
	case strings.Contains(pos, "noun"):
		return "noun"
	case strings.Contains(pos, "adjective"):
		return "adjective"
	case strings.Contains(pos, "adverb"):
		return "adverb"
	default:
		return ""
	}
}

var dictionaryClient = &http.Client{Timeout: 8 * time.Second}

func dictionaryBriefs(ctx context.Context, cards []EnglishCard) map[string]string {
	notes := map[string]string{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, card := range cards {
		wg.Add(1)
		go func(word string) {
			defer wg.Done()
			note := dictionaryNotes(ctx, word)
			if note == "" {
				return
			}
			mu.Lock()
			notes[strings.ToLower(word)] = note
			mu.Unlock()
		}(card.Word)
	}
	wg.Wait()
	return notes
}

func dictionaryNotes(ctx context.Context, word string) string {
	for _, candidate := range dictionaryCandidates(word) {
		if note := fetchDictionaryNotes(ctx, candidate); note != "" {
			return note
		}
	}
	return ""
}

func dictionaryCandidates(word string) []string {
	word = strings.ToLower(strings.TrimSpace(word))
	if word == "" {
		return nil
	}
	out := []string{word}
	add := func(next string) {
		if next != "" && next != word {
			out = append(out, next)
		}
	}
	switch {
	case strings.HasSuffix(word, "yse"):
		add(strings.TrimSuffix(word, "yse") + "yze")
	case strings.HasSuffix(word, "ise"):
		add(strings.TrimSuffix(word, "ise") + "ize")
	case strings.HasSuffix(word, "our"):
		add(strings.TrimSuffix(word, "our") + "or")
	}
	return out
}

func fetchDictionaryNotes(ctx context.Context, word string) string {
	endpoint := "https://api.dictionaryapi.dev/api/v2/entries/en/" + url.PathEscape(word)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "project-desk/english")
	resp, err := dictionaryClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil || resp.StatusCode != http.StatusOK {
		return ""
	}
	return parseDictionaryNotes(body)
}

func parseDictionaryNotes(body []byte) string {
	var entries []struct {
		Meanings []struct {
			PartOfSpeech string `json:"partOfSpeech"`
			Definitions  []struct {
				Definition string `json:"definition"`
			} `json:"definitions"`
		} `json:"meanings"`
	}
	if err := json.Unmarshal(body, &entries); err != nil || len(entries) == 0 {
		return ""
	}
	var b strings.Builder
	count := 0
	for _, meaning := range entries[0].Meanings {
		pos := strings.TrimSpace(meaning.PartOfSpeech)
		for _, def := range meaning.Definitions {
			text := oneLine(def.Definition, 140)
			if pos == "" || text == "" {
				continue
			}
			if count > 0 {
				b.WriteByte('\n')
			}
			fmt.Fprintf(&b, "%s: %s", pos, text)
			count++
			if count == 4 {
				return b.String()
			}
		}
	}
	return b.String()
}
