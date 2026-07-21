package llmprovider

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// openaiCompletionRequest mirrors the OpenAI chat completion request body.
type openaiCompletionRequest struct {
	Model       string          `json:"model"`
	Messages    []openaiMessage `json:"messages"`
	Temperature float64         `json:"temperature,omitempty"`
	MaxTokens   int             `json:"max_tokens,omitempty"`
	TopP        float64         `json:"top_p,omitempty"`
	Stream      bool            `json:"stream"`
}

type openaiMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openaiCompletionResponse struct {
	ID      string            `json:"id"`
	Object  string            `json:"object"`
	Model   string            `json:"model"`
	Choices []openaiChoice    `json:"choices"`
	Usage   openaiUsage       `json:"usage"`
}

type openaiChoice struct {
	Index        int           `json:"index"`
	Message      openaiMessage `json:"message"`
	FinishReason string        `json:"finish_reason"`
}

type openaiUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type openaiError struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error"`
}

// OpenAIClient implements LLMProvider for OpenAI-compatible APIs.
type OpenAIClient struct {
	baseURL      string
	apiKey       string
	defaultModel string
	httpClient   *http.Client
}

// OpenAIConfig holds optional overrides for OpenAIClient creation.
type OpenAIConfig struct {
	BaseURL      string
	APIKey       string
	DefaultModel string
	HTTPClient   *http.Client
}

// NewOpenAIClient creates an OpenAI-compatible LLM provider.
func NewOpenAIClient(cfg OpenAIConfig) *OpenAIClient {
	c := &OpenAIClient{
		baseURL:      "https://api.openai.com/v1",
		apiKey:       cfg.APIKey,
		defaultModel: "gpt-4o-mini",
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

func (c *OpenAIClient) Name() ProviderType {
	return ProviderTypeOpenAI
}

func (c *OpenAIClient) model(model string) string {
	if model != "" {
		return model
	}
	return c.defaultModel
}

func (c *OpenAIClient) requestURL(path string) string {
	base := strings.TrimRight(c.baseURL, "/")
	return fmt.Sprintf("%s%s", base, path)
}

// Chat performs a synchronous chat completion.
func (c *OpenAIClient) Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	if req == nil {
		req = &ChatRequest{}
	}
	model := c.model(req.Model)
	start := time.Now()

	body := openaiCompletionRequest{
		Model:       model,
		Messages:    c.convertMessages(req.Messages),
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		TopP:        req.TopP,
		Stream:      false,
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal openai request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.requestURL("/chat/completions"), bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("build openai request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("openai http request: %w", err)
	}
	defer resp.Body.Close()

	if !c.handleResponse(resp) {
		return nil, c.parseError(resp)
	}

	var result openaiCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode openai response: %w", err)
	}

	choice := c.firstChoice(result.Choices)
	return &ChatResponse{
		Content:      choice.Message.Content,
		Model:        result.Model,
		Provider:     ProviderTypeOpenAI,
		InputTokens:  result.Usage.PromptTokens,
		OutputTokens: result.Usage.CompletionTokens,
		TotalTokens:  result.Usage.TotalTokens,
		LatencyMs:    time.Since(start).Milliseconds(),
		FinishReason: choice.FinishReason,
	}, nil
}

// ChatStream returns a channel that yields stream chunks for the response.
func (c *OpenAIClient) ChatStream(ctx context.Context, req *ChatRequest) (<-chan *StreamChunk, error) {
	if req == nil {
		req = &ChatRequest{}
	}
	model := c.model(req.Model)

	body := openaiCompletionRequest{
		Model:       model,
		Messages:    c.convertMessages(req.Messages),
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		TopP:        req.TopP,
		Stream:      true,
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal openai stream request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.requestURL("/chat/completions"), bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("build openai stream request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("openai stream http request: %w", err)
	}

	if !c.handleResponse(resp) {
		resp.Body.Close()
		return nil, c.parseError(resp)
	}

	ch := make(chan *StreamChunk, 1)
	go func() {
		defer close(ch)
		defer resp.Body.Close()
		c.readSSE(resp.Body, ch)
	}()
	return ch, nil
}

func (c *OpenAIClient) convertMessages(messages []Message) []openaiMessage {
	if messages == nil {
		return []openaiMessage{}
	}
	out := make([]openaiMessage, len(messages))
	for i, m := range messages {
		out[i] = openaiMessage{Role: m.Role, Content: m.Content}
	}
	return out
}

func (c *OpenAIClient) firstChoice(choices []openaiChoice) openaiChoice {
	if len(choices) == 0 {
		return openaiChoice{}
	}
	return choices[0]
}

func (c *OpenAIClient) handleResponse(resp *http.Response) bool {
	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

func (c *OpenAIClient) parseError(resp *http.Response) error {
	code := resp.StatusCode
	switch code {
	case http.StatusUnauthorized:
		return fmt.Errorf("%w (http %d)", ErrInvalidAPIKey, code)
	case http.StatusTooManyRequests:
		return fmt.Errorf("%w (http %d)", ErrRateLimited, code)
	case http.StatusNotFound, http.StatusBadRequest:
		return fmt.Errorf("%w (http %d)", ErrInvalidModel, code)
	}
	// Try to extract the error message from the body
	var errResp openaiError
	if decErr := json.NewDecoder(resp.Body).Decode(&errResp); decErr == nil && errResp.Error.Message != "" {
		return fmt.Errorf("openai api error [%d]: %s (%s)", code, errResp.Error.Message, errResp.Error.Type)
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	return fmt.Errorf("openai http error [%d]: %s", code, strings.TrimSpace(string(body)))
}

func (c *OpenAIClient) readSSE(body io.ReadCloser, ch chan<- *StreamChunk) {
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
			continue // skip malformed chunks
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

// newSSEChan reads lines from a body and sends them via a channel.
func newSSEChan(body io.ReadCloser) <-chan string {
	lines := make(chan string)
	go func() {
		defer close(lines)
		buf := bytes.NewBuffer(nil)
		scanner := bufio.NewScanner(body)
		for scanner.Scan() {
			buf.WriteString(scanner.Text() + "\n")
			lines <- buf.String()
			buf.Reset()
		}
	}()
	return lines
}
