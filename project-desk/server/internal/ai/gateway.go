// Package ai is the provider-independent gateway. Every model vendor is an
// adapter behind the Provider interface, and the rest of the server only
// sees Request, Response, and Capabilities.
package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Kind names a provider adapter. The settings page stores one of these.
type Kind string

const (
	KindOpenAI    Kind = "openai"    // OpenAI and any /v1/chat/completions compatible endpoint
	KindAnthropic Kind = "anthropic" // Anthropic Messages API
	KindOllama    Kind = "ollama"    // Local Ollama
	KindDemo      Kind = "demo"      // Deterministic, offline. Always labeled simulated.
)

// Kinds lists the adapters this build ships, in display order.
var Kinds = []Kind{KindOpenAI, KindAnthropic, KindOllama, KindDemo}

// Compatible lists OpenAI-compatible vendors. They share the openai adapter
// and differ only in base URL and model names.
var Compatible = map[string]string{
	"openai":   "https://api.openai.com/v1",
	"deepseek": "https://api.deepseek.com/v1",
	"xai":      "https://api.x.ai/v1",
	"vllm":     "http://127.0.0.1:8000/v1",
	"azure":    "https://<resource>.openai.azure.com/openai/deployments/<deployment>",
}

// Config is what the store hands to an adapter. The API key is already
// decrypted here and never leaves the server process.
type Config struct {
	Kind    Kind
	BaseURL string
	Model   string
	APIKey  string
	Timeout time.Duration
}

// Capabilities describe what the adapter can do with the configured model.
type Capabilities struct {
	JSONMode  bool `json:"jsonMode"`
	Streaming bool `json:"streaming"`
	Tools     bool `json:"tools"`
	Simulated bool `json:"simulated"`
}

// Message is a chat turn. Role is system, user, or assistant.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Request is one generation call.
type Request struct {
	Messages    []Message
	JSON        bool // ask for a JSON object; the caller validates the shape
	MaxTokens   int
	Temperature float64
}

// Usage is the normalized token count.
type Usage struct {
	PromptTokens     int `json:"promptTokens"`
	CompletionTokens int `json:"completionTokens"`
}

// Response is the normalized answer.
type Response struct {
	Text      string
	Model     string
	Usage     Usage
	Simulated bool
}

// Model is one entry from model discovery.
type Model struct {
	ID string `json:"id"`
}

// Provider is implemented by every adapter.
type Provider interface {
	Kind() Kind
	Capabilities() Capabilities
	Models(ctx context.Context) ([]Model, error)
	Generate(ctx context.Context, req Request) (Response, error)
}

// ErrUnsupported is returned when a required capability is missing.
var ErrUnsupported = errors.New("capability not supported")

// ErrProvider wraps upstream failures so callers can show the status without
// leaking headers or keys.
type ErrProvider struct {
	Status int
	Body   string
}

func (e *ErrProvider) Error() string {
	body := strings.TrimSpace(e.Body)
	if len(body) > 300 {
		body = body[:300] + "…"
	}
	return fmt.Sprintf("provider returned %d: %s", e.Status, body)
}

// New builds the adapter for a config.
func New(cfg Config) (Provider, error) {
	if cfg.Timeout == 0 {
		cfg.Timeout = 90 * time.Second
	}
	switch cfg.Kind {
	case KindOpenAI:
		return newOpenAI(cfg), nil
	case KindAnthropic:
		return newAnthropic(cfg), nil
	case KindOllama:
		return newOllama(cfg), nil
	case KindDemo:
		return newDemo(cfg), nil
	default:
		return nil, fmt.Errorf("unknown provider kind %q", cfg.Kind)
	}
}

// GenerateJSON asks for a JSON object and decodes it into out. Adapters
// without a JSON mode are prompted for JSON and the first object in the
// reply is extracted. The caller still validates required fields.
func GenerateJSON(ctx context.Context, p Provider, req Request, out any) (Response, error) {
	req.JSON = true
	if !p.Capabilities().JSONMode {
		req.Messages = append([]Message{{
			Role:    "system",
			Content: "Reply with exactly one JSON object and nothing else. No prose, no code fences.",
		}}, req.Messages...)
	}
	resp, err := p.Generate(ctx, req)
	if err != nil {
		return resp, err
	}
	raw, err := ExtractJSON(resp.Text)
	if err != nil {
		return resp, err
	}
	if err := json.Unmarshal([]byte(raw), out); err != nil {
		return resp, fmt.Errorf("model reply is not the expected JSON shape: %w", err)
	}
	return resp, nil
}

// ExtractJSON returns the first balanced JSON object in text. Models often
// wrap JSON in fences or a sentence; this tolerates both.
func ExtractJSON(text string) (string, error) {
	text = strings.TrimSpace(text)
	if strings.HasPrefix(text, "```") {
		text = strings.TrimPrefix(text, "```json")
		text = strings.TrimPrefix(text, "```")
		if i := strings.LastIndex(text, "```"); i >= 0 {
			text = text[:i]
		}
		text = strings.TrimSpace(text)
	}
	start := strings.IndexByte(text, '{')
	if start < 0 {
		return "", errors.New("model reply contained no JSON object")
	}
	depth := 0
	inString := false
	escaped := false
	for i := start; i < len(text); i++ {
		c := text[i]
		switch {
		case escaped:
			escaped = false
		case c == '\\' && inString:
			escaped = true
		case c == '"':
			inString = !inString
		case inString:
		case c == '{':
			depth++
		case c == '}':
			depth--
			if depth == 0 {
				candidate := text[start : i+1]
				if json.Valid([]byte(candidate)) {
					return candidate, nil
				}
				return "", errors.New("model reply contained malformed JSON")
			}
		}
	}
	return "", errors.New("model reply contained an unterminated JSON object")
}
