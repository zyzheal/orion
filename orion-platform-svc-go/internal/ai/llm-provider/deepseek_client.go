package llmprovider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// deepseekCompletionRequest mirrors the DeepSeek (OpenAI-compatible) request body.
type deepseekCompletionRequest struct {
	Model       string          `json:"model"`
	Messages    []deepseekMessage `json:"messages"`
	Temperature float64         `json:"temperature,omitempty"`
	MaxTokens   int             `json:"max_tokens,omitempty"`
	TopP        float64         `json:"top_p,omitempty"`
	Stream      bool            `json:"stream"`
}

type deepseekMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type deepseekCompletionResponse struct {
	ID      string              `json:"id"`
	Object  string              `json:"object"`
	Model   string              `json:"model"`
	Choices []deepseekChoice    `json:"choices"`
	Usage   deepseekUsage       `json:"usage"`
}

type deepseekChoice struct {
	Index        int             `json:"index"`
	Message      deepseekMessage `json:"message"`
	FinishReason string          `json:"finish_reason"`
}

type deepseekUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type deepseekError struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error"`
}

// DeepSeekClient implements LLMProvider for DeepSeek's chat API (OpenAI-compatible).
type DeepSeekClient struct {
	baseURL      string
	apiKey       string
	defaultModel string
	httpClient   *http.Client
}

// DeepSeekConfig holds optional overrides for DeepSeekClient creation.
type DeepSeekConfig struct {
	BaseURL      string
	APIKey       string
	DefaultModel string
	HTTPClient   *http.Client
}

// NewDeepSeekClient creates a DeepSeek LLM provider.
func NewDeepSeekClient(cfg DeepSeekConfig) *DeepSeekClient {
	c := &DeepSeekClient{
		baseURL:      "https://api.deepseek.com/v1",
		apiKey:       cfg.APIKey,
		defaultModel: "deepseek-chat",
		httpClient:   DefaultClient,
	}
	if cfg.BaseURL != "" {
		c.baseURL = cfg.BaseURL
	}
	if cfg.DefaultModel != "" {
		c.defaultModel = cfg.DefaultModel
	}
	if cfg.HTTPClient != nil {
		c.httpClient = cfg.HTTPClient
	}
	return c
}

func (c *DeepSeekClient) Name() ProviderType {
	return ProviderTypeDeepSeek
}

func (c *DeepSeekClient) model(model string) string {
	if model != "" {
		return model
	}
	return c.defaultModel
}

func (c *DeepSeekClient) requestURL(path string) string {
	base := strings.TrimRight(c.baseURL, "/")
	return fmt.Sprintf("%s%s", base, path)
}

func (c *DeepSeekClient) convertMessages(messages []Message) []deepseekMessage {
	if messages == nil {
		return []deepseekMessage{}
	}
	out := make([]deepseekMessage, len(messages))
	for i, m := range messages {
		out[i] = deepseekMessage{Role: m.Role, Content: m.Content}
	}
	return out
}

func (c *DeepSeekClient) firstChoice(choices []deepseekChoice) deepseekChoice {
	if len(choices) == 0 {
		return deepseekChoice{}
	}
	return choices[0]
}

func (c *DeepSeekClient) handleResponse(resp *http.Response) bool {
	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

func (c *DeepSeekClient) parseError(resp *http.Response) error {
	code := resp.StatusCode
	switch code {
	case http.StatusUnauthorized:
		return fmt.Errorf("%w (http %d)", ErrInvalidAPIKey, code)
	case http.StatusTooManyRequests:
		return fmt.Errorf("%w (http %d)", ErrRateLimited, code)
	case http.StatusNotFound, http.StatusBadRequest:
		return fmt.Errorf("%w (http %d)", ErrInvalidModel, code)
	}
	var errResp deepseekError
	if decErr := json.NewDecoder(resp.Body).Decode(&errResp); decErr == nil && errResp.Error.Message != "" {
		return fmt.Errorf("deepseek api error [%d]: %s (%s)", code, errResp.Error.Message, errResp.Error.Type)
	}
	// body already consumed by json decode; re-open via resp.Body may fail, skip
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	return fmt.Errorf("deepseek http error [%d]: %s", code, strings.TrimSpace(string(body)))
}

// Chat performs a synchronous chat completion.
func (c *DeepSeekClient) Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	if req == nil {
		req = &ChatRequest{}
	}
	model := c.model(req.Model)
	start := time.Now()

	body := deepseekCompletionRequest{
		Model:       model,
		Messages:    c.convertMessages(req.Messages),
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		TopP:        req.TopP,
		Stream:      false,
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal deepseek request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.requestURL("/chat/completions"), bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("build deepseek request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("deepseek http request: %w", err)
	}
	defer resp.Body.Close()

	if !c.handleResponse(resp) {
		return nil, c.parseError(resp)
	}

	var result deepseekCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode deepseek response: %w", err)
	}

	choice := c.firstChoice(result.Choices)
	return &ChatResponse{
		Content:      choice.Message.Content,
		Model:        result.Model,
		Provider:     ProviderTypeDeepSeek,
		InputTokens:  result.Usage.PromptTokens,
		OutputTokens: result.Usage.CompletionTokens,
		TotalTokens:  result.Usage.TotalTokens,
		LatencyMs:    time.Since(start).Milliseconds(),
		FinishReason: choice.FinishReason,
	}, nil
}

// ChatStream returns a channel that yields stream chunks for the response.
func (c *DeepSeekClient) ChatStream(ctx context.Context, req *ChatRequest) (<-chan *StreamChunk, error) {
	if req == nil {
		req = &ChatRequest{}
	}
	model := c.model(req.Model)

	body := deepseekCompletionRequest{
		Model:       model,
		Messages:    c.convertMessages(req.Messages),
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		TopP:        req.TopP,
		Stream:      true,
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal deepseek stream request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.requestURL("/chat/completions"), bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("build deepseek stream request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("deepseek stream http request: %w", err)
	}

	if !c.handleResponse(resp) {
		resp.Body.Close()
		return nil, c.parseError(resp)
	}

	ch := make(chan *StreamChunk, 1)
	go func() {
		defer close(ch)
		defer resp.Body.Close()
		c.readSSEDeepSeek(resp.Body, ch)
	}()
	return ch, nil
}

func (c *DeepSeekClient) readSSEDeepSeek(body io.ReadCloser, ch chan<- *StreamChunk) {
	lines := newSSEChan(body)
	for line := range lines {
		if line == "" {
			continue
		}
		trimmed := strings.TrimSpace(line)
		if !strings.HasPrefix(trimmed, "data: ") {
			continue
		}
		data := strings.TrimPrefix(trimmed, "data: ")
		if data == "[DONE]" {
			ch <- &StreamChunk{Done: true}
			return
		}
		var choice struct {
			Delta struct {
				Content string `json:"content"`
			} `json:"delta"`
			FinishReason string `json:"finish_reason"`
		}
		if err := json.Unmarshal([]byte(data), &choice); err != nil {
			continue
		}
		if choice.Delta.Content != "" {
			ch <- &StreamChunk{Content: choice.Delta.Content}
		}
		if choice.FinishReason != "" {
			ch <- &StreamChunk{Done: true}
			return
		}
	}
}
