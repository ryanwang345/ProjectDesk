package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type anthropic struct {
	cfg    Config
	client *http.Client
}

func newAnthropic(cfg Config) *anthropic {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.anthropic.com/v1"
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	return &anthropic{cfg: cfg, client: &http.Client{Timeout: cfg.Timeout}}
}

func (p *anthropic) Kind() Kind { return KindAnthropic }

// The Messages API has no JSON response mode, so GenerateJSON prompts for
// JSON and extracts the object.
func (p *anthropic) Capabilities() Capabilities {
	return Capabilities{JSONMode: false, Streaming: true, Tools: true}
}

func (p *anthropic) Models(ctx context.Context) ([]Model, error) {
	var body struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := p.do(ctx, http.MethodGet, "/models", nil, &body); err != nil {
		return nil, err
	}
	models := make([]Model, 0, len(body.Data))
	for _, m := range body.Data {
		models = append(models, Model{ID: m.ID})
	}
	return models, nil
}

func (p *anthropic) Generate(ctx context.Context, req Request) (Response, error) {
	var system []string
	messages := make([]map[string]string, 0, len(req.Messages))
	for _, m := range req.Messages {
		if m.Role == "system" {
			system = append(system, m.Content)
			continue
		}
		messages = append(messages, map[string]string{"role": m.Role, "content": m.Content})
	}
	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 4096
	}
	payload := map[string]any{
		"model":      p.cfg.Model,
		"max_tokens": maxTokens,
		"messages":   messages,
	}
	if len(system) > 0 {
		payload["system"] = strings.Join(system, "\n\n")
	}
	if req.Temperature > 0 {
		payload["temperature"] = req.Temperature
	}
	var body struct {
		Model   string `json:"model"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		Usage struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}
	if err := p.do(ctx, http.MethodPost, "/messages", payload, &body); err != nil {
		return Response{}, err
	}
	var text strings.Builder
	for _, part := range body.Content {
		if part.Type == "text" {
			text.WriteString(part.Text)
		}
	}
	if text.Len() == 0 {
		return Response{}, fmt.Errorf("provider returned no text")
	}
	return Response{
		Text:  text.String(),
		Model: firstNonEmpty(body.Model, p.cfg.Model),
		Usage: Usage{PromptTokens: body.Usage.InputTokens, CompletionTokens: body.Usage.OutputTokens},
	}, nil
}

func (p *anthropic) do(ctx context.Context, method, path string, payload, out any) error {
	var buf []byte
	if payload != nil {
		var err error
		if buf, err = json.Marshal(payload); err != nil {
			return err
		}
	}
	httpReq, err := http.NewRequestWithContext(ctx, method, p.cfg.BaseURL+path, bytes.NewReader(buf))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("anthropic-version", "2023-06-01")
	if p.cfg.APIKey != "" {
		httpReq.Header.Set("x-api-key", p.cfg.APIKey)
	}
	return doJSON(p.client, httpReq, out)
}
