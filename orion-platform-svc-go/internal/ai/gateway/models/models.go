package models

import "time"

// GatewayRequest represents a logged gateway request.
type GatewayRequest struct {
	Model       string  `json:"model" binding:"required"`
	Provider    string  `json:"provider"`
	Input       string  `json:"input" binding:"required"`
	MaxTokens   int     `json:"maxTokens"`
	Temperature float64 `json:"temperature"`
}

// GatewayResponse represents a persisted gateway response.
type GatewayResponse struct {
	ID        string    `json:"id"`
	Model     string    `json:"model"`
	Provider  string    `json:"provider"`
	Input     string    `json:"input"`
	Output    string    `json:"output"`
	Tokens    int       `json:"tokens"`
	LatencyMs int64     `json:"latencyMs"`
	CreatedAt time.Time `json:"createdAt"`
}

// ListQuery holds pagination/filtering parameters for listing requests.
type ListQuery struct {
	Provider string `json:"provider"`
	Limit    int    `json:"limit"`
}

// Message represents a single message in a chat conversation.
type Message struct {
	Role    string `json:"role"`    // "system" | "user" | "assistant"
	Content string `json:"content"`
}

// ChatRequest is the payload for the /chat endpoint.
type ChatRequest struct {
	Model       string    `json:"model" binding:"required"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature"`
	MaxTokens   int       `json:"maxTokens"`
	TopP        float64   `json:"topP"`
}

// ChatResponse is the payload returned by the /chat endpoint.
type ChatResponse struct {
	Content      string `json:"content"`
	Model        string `json:"model"`
	Provider     string `json:"provider"`
	InputTokens  int    `json:"inputTokens"`
	OutputTokens int    `json:"outputTokens"`
	TotalTokens  int    `json:"totalTokens"`
	LatencyMs    int64  `json:"latencyMs"`
	FinishReason string `json:"finishReason"`
}

// ProviderModel describes a registered LLM provider returned by /models.
type ProviderModel struct {
	Provider string `json:"provider"`
	Enabled  bool   `json:"enabled"`
}
