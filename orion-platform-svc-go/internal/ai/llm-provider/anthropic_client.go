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

// anthropicCompletionRequest mirrors the Anthropic Messages API request body.
type anthropicCompletionRequest struct {
	Model       string               `json:"model"`
	Messages    []anthropicMessage   `json:"messages"`
	Temperature float64              `json:"temperature,omitempty"`
	MaxTokens   int                  `json:"max_tokens"`
	System      string               `json:"system,omitempty"`
	Stream      bool                 `json:"stream"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicCompletionResponse struct {
	ID      string                  `json:"id"`
	Type    string                  `json:"type"`
	Role    string                  `json:"role"`
	Content []anthropicContentBlock `json:"content"`
	Model   string                  `json:"model"`
	Usage   anthropicUsage          `json:"usage"`
	StopReason string              `json:"stop_reason"`
}

type anthropicContentBlock struct {
	Type    string `json:"type"`
	Text    string `json:"text"`
}

type anthropicUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

type anthropicError struct {
	Error struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error"`
}

// AnthropicClient implements LLMProvider for Anthropic's Claude API.
type AnthropicClient struct {
	baseURL      string
	apiKey       string
	defaultModel string
	apiVersion   string
	httpClient   *http.Client
}

// AnthropicConfig holds optional overrides for AnthropicClient creation.
type AnthropicConfig struct {
	BaseURL      string
	APIKey       string
	DefaultModel string
	APIVersion   string
	HTTPClient   *http.Client
}

// NewAnthropicClient creates an Anthropic LLM provider.
func NewAnthropicClient(cfg AnthropicConfig) *AnthropicClient {
	c := &AnthropicClient{
		baseURL:      "https://api.anthropic.com/v1",
		apiKey:       cfg.APIKey,
		defaultModel: "claude-3-haiku-20240307",
		apiVersion:   "2023-06-01",
		httpClient:   DefaultClient,
	}
	if cfg.BaseURL != "" {
		c.baseURL = cfg.BaseURL
	}
	if cfg.DefaultModel != "" {
		c.defaultModel = cfg.DefaultModel
	}
	if cfg.APIVersion != "" {
		c.apiVersion = cfg.APIVersion
	}
	if cfg.HTTPClient != nil {
		c.httpClient = cfg.HTTPClient
	}
	return c
}

func (c *AnthropicClient) Name() ProviderType {
	return ProviderTypeAnthropic
}

func (c *AnthropicClient) model(model string) string {
	if model != "" {
		return model
	}
	return c.defaultModel
}

func (c *AnthropicClient) requestURL(path string) string {
	base := strings.TrimRight(c.baseURL, "/")
	return fmt.Sprintf("%s%s", base, path)
}

func (c *AnthropicClient) buildRequest(req *ChatRequest) (*http.Request, error) {
	if req == nil {
		req = &ChatRequest{}
	}
	systemMsg, messages := c.splitSystemMessage(req.Messages)
	model := c.model(req.Model)

	body := anthropicCompletionRequest{
		Model:       model,
		Messages:    c.convertMessages(messages),
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		System:      systemMsg,
		Stream:      false,
	}
	if body.MaxTokens == 0 {
		body.MaxTokens = 4096 // Anthropic requires max_tokens
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal anthropic request: %w", err)
	}

	httpReq, err := http.NewRequest(http.MethodPost, c.requestURL("/messages"), bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("build anthropic request: %w", err)
	}
	httpReq.Header.Set("x-api-key", c.apiKey)
	httpReq.Header.Set("anthropic-version", c.apiVersion)
	httpReq.Header.Set("Content-Type", "application/json")
	return httpReq, nil
}

// Chat performs a synchronous chat completion.
func (c *AnthropicClient) Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	httpReq, err := c.buildRequest(req)
	if err != nil {
		return nil, err
	}
	httpReq = httpReq.WithContext(ctx)
	start := time.Now()

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("anthropic http request: %w", err)
	}
	defer resp.Body.Close()

	if !c.handleResponse(resp) {
		return nil, c.parseError(resp)
	}

	var result anthropicCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode anthropic response: %w", err)
	}

	content := c.firstContentText(result.Content)
	return &ChatResponse{
		Content:      content,
		Model:        result.Model,
		Provider:     ProviderTypeAnthropic,
		InputTokens:  result.Usage.InputTokens,
		OutputTokens: result.Usage.OutputTokens,
		TotalTokens:  result.Usage.InputTokens + result.Usage.OutputTokens,
		LatencyMs:    time.Since(start).Milliseconds(),
		FinishReason: result.StopReason,
	}, nil
}

// ChatStream returns a channel that yields stream chunks for the response.
func (c *AnthropicClient) ChatStream(ctx context.Context, req *ChatRequest) (<-chan *StreamChunk, error) {
	if req == nil {
		req = &ChatRequest{}
	}
	systemMsg, messages := c.splitSystemMessage(req.Messages)
	model := c.model(req.Model)

	body := anthropicCompletionRequest{
		Model:       model,
		Messages:    c.convertMessages(messages),
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		System:      systemMsg,
		Stream:      true,
	}
	if body.MaxTokens == 0 {
		body.MaxTokens = 4096
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal anthropic stream request: %w", err)
	}

	httpReq, err := http.NewRequest(http.MethodPost, c.requestURL("/messages"), bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("build anthropic stream request: %w", err)
	}
	httpReq = httpReq.WithContext(ctx)
	httpReq.Header.Set("x-api-key", c.apiKey)
	httpReq.Header.Set("anthropic-version", c.apiVersion)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("anthropic stream http request: %w", err)
	}

	if !c.handleResponse(resp) {
		resp.Body.Close()
		return nil, c.parseError(resp)
	}

	ch := make(chan *StreamChunk, 1)
	go func() {
		defer close(ch)
		defer resp.Body.Close()
		c.readSSEAnthropic(resp.Body, ch)
	}()
	return ch, nil
}

func (c *AnthropicClient) splitSystemMessage(messages []Message) (string, []Message) {
	if messages == nil || len(messages) == 0 {
		return "", []Message{}
	}
	var systemMsg string
	var filtered []Message
	for _, m := range messages {
		if m.Role == "system" {
			systemMsg = m.Content
		} else {
			filtered = append(filtered, m)
		}
	}
	return systemMsg, filtered
}

func (c *AnthropicClient) convertMessages(messages []Message) []anthropicMessage {
	if messages == nil {
		return []anthropicMessage{}
	}
	out := make([]anthropicMessage, len(messages))
	for i, m := range messages {
		out[i] = anthropicMessage{Role: m.Role, Content: m.Content}
	}
	return out
}

func (c *AnthropicClient) firstContentText(blocks []anthropicContentBlock) string {
	for _, b := range blocks {
		if b.Type == "text" {
			return b.Text
		}
	}
	return ""
}

func (c *AnthropicClient) handleResponse(resp *http.Response) bool {
	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

func (c *AnthropicClient) parseError(resp *http.Response) error {
	code := resp.StatusCode
	switch code {
	case http.StatusUnauthorized:
		return fmt.Errorf("%w (http %d)", ErrInvalidAPIKey, code)
	case http.StatusTooManyRequests:
		return fmt.Errorf("%w (http %d)", ErrRateLimited, code)
	case http.StatusBadRequest:
		return fmt.Errorf("%w (http %d)", ErrInvalidModel, code)
	}
	var errResp anthropicError
	if decErr := json.NewDecoder(resp.Body).Decode(&errResp); decErr == nil && errResp.Error.Message != "" {
		return fmt.Errorf("anthropic api error [%d] (%s): %s", code, errResp.Error.Type, errResp.Error.Message)
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	return fmt.Errorf("anthropic http error [%d]: %s", code, strings.TrimSpace(string(body)))
}

func (c *AnthropicClient) readSSEAnthropic(body io.ReadCloser, ch chan<- *StreamChunk) {
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
		var event struct {
			Type string `json:"type"`
			Delta struct {
				Type  string `json:"type"`
				Text  string `json:"text"`
			} `json:"delta"`
		}
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}
		switch event.Type {
		case "message_stop":
			ch <- &StreamChunk{Done: true}
			return
		case "content_block_delta":
			if event.Delta.Type == "text_delta" {
				ch <- &StreamChunk{Content: event.Delta.Text}
			}
		}
	}
}
