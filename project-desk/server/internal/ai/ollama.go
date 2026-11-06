package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type ollama struct {
	cfg    Config
	client *http.Client
}

func newOllama(cfg Config) *ollama {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "http://127.0.0.1:11434"
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	return &ollama{cfg: cfg, client: &http.Client{Timeout: cfg.Timeout}}
}

func (p *ollama) Kind() Kind { return KindOllama }

func (p *ollama) Capabilities() Capabilities {
	return Capabilities{JSONMode: true, Streaming: true, Tools: false}
}

func (p *ollama) Models(ctx context.Context) ([]Model, error) {
	var body struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := p.do(ctx, http.MethodGet, "/api/tags", nil, &body); err != nil {
		return nil, err
	}
	models := make([]Model, 0, len(body.Models))
	for _, m := range body.Models {
		models = append(models, Model{ID: m.Name})
	}
	return models, nil
}

func (p *ollama) Generate(ctx context.Context, req Request) (Response, error) {
	payload := map[string]any{
		"model":    p.cfg.Model,
		"messages": req.Messages,
		"stream":   false,
	}
	if req.JSON {
		payload["format"] = "json"
	}
	options := map[string]any{}
	if req.MaxTokens > 0 {
		options["num_predict"] = req.MaxTokens
	}
	if req.Temperature > 0 {
		options["temperature"] = req.Temperature
	}
	if len(options) > 0 {
		payload["options"] = options
	}
	var body struct {
		Model   string `json:"model"`
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
		PromptEvalCount int `json:"prompt_eval_count"`
		EvalCount       int `json:"eval_count"`
	}
	if err := p.do(ctx, http.MethodPost, "/api/chat", payload, &body); err != nil {
		return Response{}, err
	}
	if body.Message.Content == "" {
		return Response{}, fmt.Errorf("provider returned no text")
	}
	return Response{
		Text:  body.Message.Content,
		Model: firstNonEmpty(body.Model, p.cfg.Model),
		Usage: Usage{PromptTokens: body.PromptEvalCount, CompletionTokens: body.EvalCount},
	}, nil
}

func (p *ollama) do(ctx context.Context, method, path string, payload, out any) error {
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
	if p.cfg.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.cfg.APIKey)
	}
	return doJSON(p.client, httpReq, out)
}
