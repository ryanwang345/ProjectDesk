package desk

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func toolsHandler(server *httptest.Server) *Handler {
	tools := newEnglishTools()
	tools.grammarURL = server.URL + "/v2/check"
	tools.examplesURL = server.URL + "/v1/sentences"
	tools.client = server.Client()
	// A platform is present, but has no store: any attempt to resolve an AI
	// provider will panic. These endpoints must work independently of it.
	return &Handler{platform: &Platform{}, englishTools: tools}
}

func TestEnglishCheckUsesLanguageToolWithoutAI(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v2/check" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if r.Form.Get("language") != "en-US" || r.Form.Get("text") != "😀 She go to school." || r.Form.Get("apiKey") != "" {
			t.Errorf("unexpected check payload: %v", r.Form)
		}
		// The emoji occupies two UTF-16 units. Keep LanguageTool offsets intact.
		_, _ = w.Write([]byte(`{"matches":[{"message":"Use goes.","offset":7,"length":2,"replacements":[{"value":"goes"}],"rule":{"id":"AGREEMENT","issueType":"grammar"}}]}`))
	}))
	defer server.Close()
	h := toolsHandler(server)
	w := httptest.NewRecorder()
	h.evaluateEnglishSentence(w, httptest.NewRequest("POST", "/api/english/evaluate", strings.NewReader(`{"word":"school","sentence":"😀 She go to school."}`)))
	var got sentenceEvaluateResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if w.Code != 200 || got.Source != "languagetool" || !got.UsedWord || len(got.Matches) != 1 || got.Matches[0].Offset != 7 {
		t.Fatalf("unexpected result: %d %s", w.Code, w.Body)
	}
	if strings.Contains(w.Body.String(), `"score"`) || strings.Contains(w.Body.String(), `"corrected"`) {
		t.Fatal("check invented a score or silently applied a suggestion")
	}
}

func TestEnglishCheckDoesNotTreatUpstreamFailureAsSuccess(t *testing.T) {
	for name, reply := range map[string]string{
		"missing matches": `{}`,
		"bad JSON":        `{`,
		"null matches":    `{"matches":null}`,
		"incomplete":      `{"matches":[],"warnings":{"incompleteResults":true}}`,
		"negative offset": `{"matches":[{"offset":-1,"length":1}]}`,
		"out of range":    `{"matches":[{"offset":100,"length":1}]}`,
	} {
		t.Run(name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(reply)) }))
			defer server.Close()
			w := httptest.NewRecorder()
			toolsHandler(server).evaluateEnglishSentence(w, httptest.NewRequest("POST", "/api/english/evaluate", strings.NewReader(`{"word":"school","sentence":"I go to school."}`)))
			if w.Code != http.StatusBadGateway {
				t.Fatalf("upstream failure returned %d: %s", w.Code, w.Body)
			}
		})
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusTooManyRequests) }))
	h := toolsHandler(server)
	w := httptest.NewRecorder()
	h.evaluateEnglishSentence(w, httptest.NewRequest("POST", "/api/english/evaluate", strings.NewReader(`{"word":"school","sentence":"I go to school."}`)))
	if w.Code != http.StatusBadGateway {
		t.Fatalf("upstream HTTP error returned %d", w.Code)
	}
	server.Close()
	w = httptest.NewRecorder()
	h.evaluateEnglishSentence(w, httptest.NewRequest("POST", "/api/english/evaluate", strings.NewReader(`{"word":"school","sentence":"I go to school."}`)))
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("unavailable server returned %d", w.Code)
	}
}

func TestEnglishCheckValidatesInputAndReportsNoDetectedIssues(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		_, _ = w.Write([]byte(`{"matches":[]}`))
	}))
	defer server.Close()
	h := toolsHandler(server)
	for _, input := range []string{
		`{`, `{"word":"","sentence":"Hello."}`, `{"word":"school","sentence":" "}`,
		`{"word":"school","sentence":"` + strings.Repeat("😀", 301) + `"}`,
	} {
		w := httptest.NewRecorder()
		h.evaluateEnglishSentence(w, httptest.NewRequest("POST", "/api/english/evaluate", strings.NewReader(input)))
		if w.Code != http.StatusBadRequest {
			t.Errorf("invalid input returned %d", w.Code)
		}
	}
	if calls != 0 {
		t.Fatal("sent invalid input to LanguageTool")
	}
	w := httptest.NewRecorder()
	h.evaluateEnglishSentence(w, httptest.NewRequest("POST", "/api/english/evaluate", strings.NewReader(`{"word":"additional","sentence":"Additionally, I agree."}`)))
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"usedWord":false`) || !strings.Contains(w.Body.String(), `"matches":[]`) {
		t.Fatalf("unexpected clean result: %s", w.Body)
	}
}

func TestReferenceExamplesAreReviewedAttributedAndExactMatches(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		q := r.URL.Query()
		if r.URL.Path != "/v1/sentences" || q.Get("list") != "907" || q.Get("sort") != "relevance" || q.Get("is_unapproved") != "no" || q.Get("is_orphan") != "no" || q.Get("q") != `"additional"` {
			t.Errorf("incorrect example filters: %s", r.URL)
		}
		_, _ = w.Write([]byte(`{"data":[
			{"id":1,"text":"Additional help is needed.","lang":"eng","owner":"CK","license":"CC BY 2.0 FR"},
			{"id":2,"text":"Additionally, I agree.","lang":"eng","owner":"CK","license":"CC BY 2.0 FR"},
			{"id":3,"text":"Subtraction is harder than addition.","lang":"eng","owner":"CK","license":"CC BY 2.0 FR"},
			{"id":4,"text":"Additional help is needed.","lang":"eng","owner":"CK","license":"CC BY 2.0 FR"},
			{"id":5,"text":"We need additional staff.","lang":"eng","owner":"CK","license":"CC0 1.0"},
			{"id":6,"text":"We need additional time.","lang":"eng","owner":"CK","license":"PROBLEM"},
			{"id":7,"text":"We need additional funds.","lang":"eng","owner":"CK","license":"CC BY 2.0 FR","is_unapproved":true},
			{"id":8,"text":"We need additional funds.","lang":"eng","owner":null,"license":"CC BY 2.0 FR"}
		]}`))
	}))
	defer server.Close()
	h := toolsHandler(server)
	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		h.englishReferenceExamples(w, httptest.NewRequest("GET", "/api/english/examples?word=additional", nil))
		var got struct {
			Examples []referenceExample `json:"examples"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		if w.Code != 200 || len(got.Examples) != 2 || got.Examples[0].Author != "CK" || got.Examples[0].URL != "https://tatoeba.org/en/sentences/show/1" || got.Examples[0].LicenseURL == "" || got.Examples[1].License != "CC0 1.0" {
			t.Fatalf("unexpected examples: %d %s", w.Code, w.Body)
		}
	}
	if calls != 1 {
		t.Errorf("expected cached results, got %d upstream calls", calls)
	}
}

func TestReferenceExamplesFailuresAreRetryable(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if calls == 1 {
			w.WriteHeader(503)
			return
		}
		_, _ = w.Write([]byte(`{"data":[]}`))
	}))
	defer server.Close()
	h := toolsHandler(server)
	for _, expected := range []int{502, 200} {
		w := httptest.NewRecorder()
		h.englishReferenceExamples(w, httptest.NewRequest("GET", "/api/english/examples?word=uncommonword", nil))
		if w.Code != expected {
			t.Fatalf("wanted %d, got %d: %s", expected, w.Code, w.Body)
		}
		if expected == 200 && !strings.Contains(w.Body.String(), `"examples":[]`) {
			t.Fatalf("empty examples must be an array: %s", w.Body)
		}
	}
	w := httptest.NewRecorder()
	h.englishReferenceExamples(w, httptest.NewRequest("GET", "/api/english/examples?word=%22OR%20*", nil))
	if w.Code != 400 || calls != 2 {
		t.Fatalf("invalid word reached upstream: %d, %d calls", w.Code, calls)
	}
}
