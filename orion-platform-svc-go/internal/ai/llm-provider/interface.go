package llmprovider

import (
	"context"
	"errors"
)

// ProviderType identifies the LLM backend implementation.
type ProviderType string

const (
	ProviderTypeOpenAI    ProviderType = "openai"
	ProviderTypeAnthropic ProviderType = "anthropic"
	ProviderTypeDeepSeek  ProviderType = "deepseek"
	ProviderTypeCustom    ProviderType = "custom"
)

// Message represents a single message in a chat conversation.
type Message struct {
	Role    string `json:"role"`    // "system" | "user" | "assistant"
	Content string `json:"content"`
}

// ChatRequest holds the parameters for a synchronous chat completion call.
type ChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature"`
	MaxTokens   int       `json:"maxTokens"`
	TopP        float64   `json:"topP"`
}

// ChatResponse holds the result returned by a synchronous chat completion.
type ChatResponse struct {
	Content      string       `json:"content"`
	Model        string       `json:"model"`
	Provider     ProviderType `json:"provider"`
	InputTokens  int          `json:"inputTokens"`
	OutputTokens int          `json:"outputTokens"`
	TotalTokens  int          `json:"totalTokens"`
	LatencyMs    int64        `json:"latencyMs"`
	FinishReason string       `json:"finishReason"`
}

// StreamChunk is emitted over the stream channel.
type StreamChunk struct {
	Content string `json:"content"`
	Done    bool   `json:"done"`
	Error   error  `json:"-"`
}

// Error classification helpers returned by LLMProvider methods.
var (
	ErrProviderNotFound = errors.New("LLM provider not registered")
	ErrRateLimited      = errors.New("LLM request rate-limited")
	ErrInvalidAPIKey    = errors.New("LLM invalid API key")
	ErrInvalidModel     = errors.New("LLM invalid model")
	ErrEmptyContent     = errors.New("LLM response returned empty content")
	ErrTokenPoolExhausted = errors.New("LLM token pool exhausted")
)

// LLMProvider is the contract for any LLM backend adapter.
type LLMProvider interface {
	// Chat performs a synchronous chat completion and returns the response.
	Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error)
	// ChatStream returns a channel that yields stream chunks. Caller must close
	// the channel when done consuming (or wait for Done=true).
	ChatStream(ctx context.Context, req *ChatRequest) (<-chan *StreamChunk, error)
	// Name returns the provider type identifier.
	Name() ProviderType
}
