package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestExtractJSON(t *testing.T) {
	cases := map[string]string{
		`{"a":1}`:                                `{"a":1}`,
		"Sure:\n```json\n{\"a\":{\"b\":2}}\n```": `{"a":{"b":2}}`,
		`text {"a":"}"} tail`:                    `{"a":"}"}`,
	}
	for in, want := range cases {
		got, err := ExtractJSON(in)
		if err != nil || got != want {
			t.Fatalf("ExtractJSON(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	if _, err := ExtractJSON("no json here"); err == nil {
		t.Fatal("expected an error without JSON")
	}
	if _, err := ExtractJSON(`{"a":`); err == nil {
		t.Fatal("expected an error for unterminated JSON")
	}
}

func TestOpenAICompatibleGenerate(t *testing.T) {
	var gotAuth string
	var gotFormat string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		var payload map[string]any
		_ = json.NewDecoder(r.Body).Decode(&payload)
		if rf, ok := payload["response_format"].(map[string]any); ok {
			gotFormat, _ = rf["type"].(string)
		}
		_, _ = w.Write([]byte(`{"model":"m","choices":[{"message":{"content":"{\"ok\":true}"}}],"usage":{"prompt_tokens":3,"completion_tokens":2}}`))
	}))
	defer server.Close()

	p, err := New(Config{Kind: KindOpenAI, BaseURL: server.URL, Model: "m", APIKey: "k"})
	if err != nil {
		t.Fatal(err)
	}
	var out struct {
		OK bool `json:"ok"`
	}
	resp, err := GenerateJSON(context.Background(), p, Request{Messages: []Message{{Role: "user", Content: "hi"}}}, &out)
	if err != nil || !out.OK {
		t.Fatalf("GenerateJSON: %v, %+v", err, out)
	}
	if gotAuth != "Bearer k" || gotFormat != "json_object" {
		t.Fatalf("request not shaped for OpenAI: auth=%q format=%q", gotAuth, gotFormat)
	}
	if resp.Usage.PromptTokens != 3 || resp.Usage.CompletionTokens != 2 {
		t.Fatalf("usage not normalized: %+v", resp.Usage)
	}
}

func TestGeminiUsesOpenAICompatibility(t *testing.T) {
	var gotPath, gotAuth, gotEffort string
	var gotMax float64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		var payload map[string]any
		_ = json.NewDecoder(r.Body).Decode(&payload)
		gotEffort, _ = payload["reasoning_effort"].(string)
		gotMax, _ = payload["max_tokens"].(float64)
		_, _ = w.Write([]byte(`{"model":"gemini-3.5-flash-lite","choices":[{"message":{"content":"ok"}}],"usage":{"prompt_tokens":1,"completion_tokens":1}}`))
	}))
	defer server.Close()

	p, err := New(Config{Kind: KindGemini, BaseURL: server.URL, Model: "gemini-3.5-flash-lite", APIKey: "g"})
	if err != nil {
		t.Fatal(err)
	}
	if p.Kind() != KindGemini {
		t.Fatalf("kind = %s", p.Kind())
	}
	resp, err := p.Generate(context.Background(), Request{Messages: []Message{{Role: "user", Content: "ping"}}, MaxTokens: 8})
	if err != nil {
		t.Fatal(err)
	}
	if gotPath != "/chat/completions" || gotAuth != "Bearer g" || gotEffort != "low" || gotMax != 64 {
		t.Fatalf("gemini request path=%s auth=%s effort=%s max=%v", gotPath, gotAuth, gotEffort, gotMax)
	}
	if resp.Text != "ok" {
		t.Fatalf("text = %q", resp.Text)
	}
	bare, err := New(Config{Kind: KindGemini, Model: "gemini-3.5-flash-lite", APIKey: "g"})
	if err != nil {
		t.Fatal(err)
	}
	gemini, ok := bare.(*openAI)
	if !ok || gemini.cfg.BaseURL != Compatible["gemini"] {
		t.Fatalf("default endpoint = %#v", bare)
	}
}

func TestAnthropicPromptsForJSONWithoutJSONMode(t *testing.T) {
	var system string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-api-key") != "k" {
			t.Errorf("missing x-api-key")
		}
		var payload map[string]any
		_ = json.NewDecoder(r.Body).Decode(&payload)
		system, _ = payload["system"].(string)
		_, _ = w.Write([]byte(`{"model":"c","content":[{"type":"text","text":"Here you go: {\"ok\":true}"}],"usage":{"input_tokens":1,"output_tokens":1}}`))
	}))
	defer server.Close()

	p, _ := New(Config{Kind: KindAnthropic, BaseURL: server.URL, Model: "c", APIKey: "k"})
	var out struct {
		OK bool `json:"ok"`
	}
	if _, err := GenerateJSON(context.Background(), p, Request{Messages: []Message{{Role: "user", Content: "hi"}}}, &out); err != nil || !out.OK {
		t.Fatalf("GenerateJSON: %v, %+v", err, out)
	}
	if !strings.Contains(system, "JSON object") {
		t.Fatalf("expected a JSON instruction in the system prompt, got %q", system)
	}
}

func TestQuotaPauseSkipsLaterCalls(t *testing.T) {
	clearQuotaPause()
	t.Cleanup(clearQuotaPause)
	var calls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details.","status":"RESOURCE_EXHAUSTED"}}`))
	}))
	defer server.Close()
	p, _ := New(Config{Kind: KindGemini, BaseURL: server.URL, Model: "gemini", APIKey: "k"})
	var out struct{}
	if _, err := GenerateJSON(context.Background(), p, Request{Messages: []Message{{Role: "user", Content: "hi"}}}, &out); err == nil {
		t.Fatal("expected the quota error")
	}
	if _, err := GenerateJSON(context.Background(), p, Request{Messages: []Message{{Role: "user", Content: "hi"}}}, &out); err == nil {
		t.Fatal("expected the pause to keep failing closed")
	}
	if calls != 1 {
		t.Fatalf("quota pause still called the provider %d times", calls)
	}
}

func TestProviderErrorsAreSurfaced(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"bad key"}`))
	}))
	defer server.Close()
	p, _ := New(Config{Kind: KindOllama, BaseURL: server.URL, Model: "llama"})
	_, err := p.Generate(context.Background(), Request{Messages: []Message{{Role: "user", Content: "hi"}}})
	var perr *ErrProvider
	if err == nil || !asProviderErr(err, &perr) || perr.Status != 401 {
		t.Fatalf("expected ErrProvider 401, got %v", err)
	}
}

func asProviderErr(err error, target **ErrProvider) bool {
	e, ok := err.(*ErrProvider)
	if ok {
		*target = e
	}
	return ok
}

func TestDemoIsLabeledSimulated(t *testing.T) {
	p, _ := New(Config{Kind: KindDemo})
	var out struct {
		Hypotheses []struct {
			Cause string `json:"cause"`
		} `json:"hypotheses"`
	}
	resp, err := GenerateJSON(context.Background(), p, Request{Messages: []Message{{Role: "user", Content: "task: analyze\n<signal>Search button is plain text in staging</signal>"}}}, &out)
	if err != nil || !resp.Simulated || len(out.Hypotheses) == 0 {
		t.Fatalf("demo analyze: %v simulated=%v %+v", err, resp.Simulated, out)
	}
}
