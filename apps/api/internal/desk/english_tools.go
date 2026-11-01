package desk

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf16"
)

// These tools deliberately do not resolve an AI provider or use the public
// LanguageTool cloud API. Run the open-source LanguageTool HTTP server locally.
type englishTools struct {
	grammarURL  string
	examplesURL string
	client      *http.Client
	mu          sync.Mutex
	examples    map[string]exampleCacheEntry
}

type exampleCacheEntry struct {
	items   []referenceExample
	expires time.Time
}

func newEnglishTools() *englishTools {
	base := strings.TrimRight(strings.TrimSpace(os.Getenv("PROJECT_DESK_LANGUAGETOOL_URL")), "/")
	if base == "" {
		base = "http://127.0.0.1:8081"
	}
	return &englishTools{
		grammarURL:  base + "/v2/check",
		examplesURL: "https://api.tatoeba.org/v1/sentences",
		client:      &http.Client{Timeout: 10 * time.Second},
		examples:    make(map[string]exampleCacheEntry),
	}
}

type sentenceEvaluateRequest struct {
	Word     string `json:"word"`
	Sentence string `json:"sentence"`
}

type grammarMatch struct {
	Message      string `json:"message"`
	Offset       int    `json:"offset"`
	Length       int    `json:"length"`
	Replacements []struct {
		Value string `json:"value"`
	} `json:"replacements"`
	Rule struct {
		ID        string `json:"id"`
		IssueType string `json:"issueType"`
	} `json:"rule"`
}

type sentenceEvaluateResponse struct {
	Source   string         `json:"source"`
	UsedWord bool           `json:"usedWord"`
	Matches  []grammarMatch `json:"matches"`
}

var englishHeadword = regexp.MustCompile(`(?i)^[a-z]+(?:[ '-][a-z]+)*$`)

func containsHeadword(text, word string) bool {
	// Full lexical matches only: "additional" must not match "additionally".
	return regexp.MustCompile(`(?i)(^|[^\p{L}\p{N}_])` + regexp.QuoteMeta(word) + `($|[^\p{L}\p{N}_])`).MatchString(text)
}

func (h *Handler) evaluateEnglishSentence(w http.ResponseWriter, r *http.Request) {
	var input sentenceEvaluateRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "provide a word and sentence to check")
		return
	}
	word := strings.TrimSpace(input.Word)
	sentence := strings.TrimSpace(input.Sentence)
	units := utf16.Encode([]rune(sentence))
	if len(word) > 80 || !englishHeadword.MatchString(word) || len(units) == 0 || len(units) > 600 {
		writeError(w, http.StatusBadRequest, "provide an English word and a sentence of 1–600 characters")
		return
	}
	form := url.Values{"text": {sentence}, "language": {"en-US"}}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, h.englishTools.grammarURL, strings.NewReader(form.Encode()))
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "the grammar checker is not configured correctly")
		return
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := h.englishTools.client.Do(req)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "the rule-based grammar checker is unavailable; please try again later")
		return
	}
	defer res.Body.Close()
	var checked struct {
		Matches  *[]grammarMatch `json:"matches"`
		Warnings struct {
			IncompleteResults bool `json:"incompleteResults"`
		} `json:"warnings"`
	}
	if res.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(res.Body, 2<<20)).Decode(&checked) != nil || checked.Matches == nil || checked.Warnings.IncompleteResults {
		writeError(w, http.StatusBadGateway, "the grammar checker could not complete this check; please try again")
		return
	}
	for _, match := range *checked.Matches {
		if match.Offset < 0 || match.Length < 0 || match.Offset > len(units) || match.Length > len(units)-match.Offset {
			writeError(w, http.StatusBadGateway, "the grammar checker returned an invalid suggestion")
			return
		}
	}
	writeJSON(w, http.StatusOK, sentenceEvaluateResponse{Source: "languagetool", UsedWord: containsHeadword(sentence, word), Matches: *checked.Matches})
}

type referenceExample struct {
	ID         int    `json:"id"`
	Text       string `json:"text"`
	Author     string `json:"author"`
	URL        string `json:"url"`
	License    string `json:"license"`
	LicenseURL string `json:"licenseUrl"`
}

func (h *Handler) englishReferenceExamples(w http.ResponseWriter, r *http.Request) {
	word := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("word")))
	if len(word) > 80 || !englishHeadword.MatchString(word) {
		writeError(w, http.StatusBadRequest, "provide an English word")
		return
	}
	t := h.englishTools
	t.mu.Lock()
	cached, ok := t.examples[word]
	t.mu.Unlock()
	if ok && time.Now().Before(cached.expires) {
		writeJSON(w, http.StatusOK, map[string]any{"examples": cached.items})
		return
	}
	u, err := url.Parse(t.examplesURL)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "example lookup is unavailable")
		return
	}
	// List 907 is CK's proofread English list recommended by Tatoeba for
	// learning materials. Never broaden the search to unreviewed sentences.
	u.RawQuery = url.Values{
		"lang": {"eng"}, "q": {`"` + word + `"`}, "sort": {"relevance"},
		"list": {"907"}, "is_unapproved": {"no"}, "is_orphan": {"no"}, "limit": {"40"},
	}.Encode()
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, u.String(), nil)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "example lookup is unavailable")
		return
	}
	res, err := t.client.Do(req)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "reference examples are unavailable; please try again later")
		return
	}
	defer res.Body.Close()
	var result struct {
		Data []struct {
			ID         int    `json:"id"`
			Text       string `json:"text"`
			Lang       string `json:"lang"`
			Owner      string `json:"owner"`
			License    string `json:"license"`
			Unapproved bool   `json:"is_unapproved"`
		} `json:"data"`
	}
	if res.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(res.Body, 2<<20)).Decode(&result) != nil || result.Data == nil {
		writeError(w, http.StatusBadGateway, "reference examples could not be loaded; please try again")
		return
	}
	items := make([]referenceExample, 0, 8)
	seen := make(map[string]bool)
	for _, sentence := range result.Data {
		text := strings.TrimSpace(sentence.Text)
		key := strings.ToLower(text)
		if sentence.ID <= 0 || sentence.Lang != "eng" || sentence.Unapproved || sentence.Owner == "" || len([]rune(text)) > 280 || !containsHeadword(text, word) || seen[key] {
			continue
		}
		licenseURL := ""
		switch sentence.License {
		case "CC BY 2.0 FR":
			licenseURL = "https://creativecommons.org/licenses/by/2.0/fr/"
		case "CC0 1.0":
			licenseURL = "https://creativecommons.org/publicdomain/zero/1.0/"
		default:
			continue
		}
		seen[key] = true
		items = append(items, referenceExample{ID: sentence.ID, Text: text, Author: sentence.Owner, URL: "https://tatoeba.org/en/sentences/show/" + strconv.Itoa(sentence.ID), License: sentence.License, LicenseURL: licenseURL})
		if len(items) == 8 {
			break
		}
	}
	t.mu.Lock()
	if len(t.examples) >= 200 {
		t.examples = make(map[string]exampleCacheEntry)
	}
	t.examples[word] = exampleCacheEntry{items: items, expires: time.Now().Add(24 * time.Hour)}
	t.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"examples": items})
}
