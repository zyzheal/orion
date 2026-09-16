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

// GatewayResponse is scanned from SELECT *, so every returned column needs a
// destination and its db tag must be the snake_case column name. sqlx v1.4.0
// resolves a field by its db tag and otherwise by the LOWERCASED Go field
// name, so untagged LatencyMs looked for the column "latencyms" and CreatedAt
// for "createdat" while the table holds "latency_ms" and "created_at" — every
// read of ai_gateway_requests failed with "missing destination name". tenant_id
// is NOT NULL and Create is its only writer, so it needs a field as well.
type GatewayResponse struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Model     string    `json:"model" db:"model"`
	Provider  string    `json:"provider" db:"provider"`
	Input     string    `json:"input" db:"input"`
	Output    string    `json:"output" db:"output"`
	Tokens    int       `json:"tokens" db:"tokens"`
	LatencyMs int64     `json:"latencyMs" db:"latency_ms"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

// ListQuery holds pagination/filtering parameters for listing requests.
type ListQuery struct {
	Provider string `json:"provider"`
	Limit    int    `json:"limit"`
}

// Message represents a single message in a chat conversation.
type Message struct {
	Role    string `json:"role"` // "system" | "user" | "assistant"
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
