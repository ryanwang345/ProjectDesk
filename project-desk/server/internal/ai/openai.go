package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// openAI talks to /v1/chat/completions. DeepSeek, xAI, vLLM, Azure OpenAI
// (with the deployment URL as base), and most self-hosted gateways speak
// the same shape.
type openAI struct {
	cfg    Config
	client *http.Client
}

func newOpenAI(cfg Config) *openAI {
	if cfg.BaseURL == "" {
		if cfg.Kind == KindGemini {
			cfg.BaseURL = Compatible["gemini"]
		} else {
			cfg.BaseURL = Compatible["openai"]
		}
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	return &openAI{cfg: cfg, client: &http.Client{Timeout: cfg.Timeout}}
}

func (p *openAI) Kind() Kind {
	if p.cfg.Kind == KindGemini {
		return KindGemini
	}
	return KindOpenAI
}

func (p *openAI) Capabilities() Capabilities {
	return Capabilities{JSONMode: true, Streaming: true, Tools: true}
}

func (p *openAI) Models(ctx context.Context) ([]Model, error) {
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

func (p *openAI) Generate(ctx context.Context, req Request) (Response, error) {
	payload := map[string]any{
		"model":    p.cfg.Model,
		"messages": req.Messages,
	}
	if req.MaxTokens > 0 {
		payload["max_tokens"] = req.MaxTokens
	}
	if req.Temperature > 0 {
		payload["temperature"] = req.Temperature
	}
	if req.JSON {
		payload["response_format"] = map[string]string{"type": "json_object"}
	}
	if p.cfg.Kind == KindGemini {
		// Gemini 3 spends part of a small limit on thinking and can return
		// an empty reply. A low effort and a floor keep the connection
		// check and short calls able to answer.
		payload["reasoning_effort"] = "low"
		if req.MaxTokens > 0 && req.MaxTokens < 64 {
			payload["max_tokens"] = 64
		}
	}
	var body struct {
		Model   string `json:"model"`
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
	}
	if err := p.do(ctx, http.MethodPost, "/chat/completions", payload, &body); err != nil {
		return Response{}, err
	}
	if len(body.Choices) == 0 {
		return Response{}, fmt.Errorf("provider returned no choices")
	}
	return Response{
		Text:  body.Choices[0].Message.Content,
		Model: firstNonEmpty(body.Model, p.cfg.Model),
		Usage: Usage{PromptTokens: body.Usage.PromptTokens, CompletionTokens: body.Usage.CompletionTokens},
	}, nil
}

func (p *openAI) do(ctx context.Context, method, path string, payload, out any) error {
	var reader io.Reader
	if payload != nil {
		buf, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(buf)
	}
	httpReq, err := http.NewRequestWithContext(ctx, method, p.cfg.BaseURL+path, reader)
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if p.cfg.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.cfg.APIKey)
		// Azure OpenAI reads api-key instead of a bearer token. Sending both
		// is harmless for every other compatible endpoint.
		httpReq.Header.Set("api-key", p.cfg.APIKey)
	}
	return doJSON(p.client, httpReq, out)
}

func doJSON(client *http.Client, req *http.Request, out any) error {
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("provider unreachable: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &ErrProvider{Status: resp.StatusCode, Body: string(raw)}
	}
	if out == nil {
		return nil
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("provider sent a reply that is not JSON: %w", err)
	}
	return nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
