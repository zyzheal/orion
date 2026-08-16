package models

import "time"

// QueryRequest is the payload for the assistant chat endpoint.
type QueryRequest struct {
	Question string `json:"question" binding:"required"`
	// Optional filters to scope the search.
	Intent   string   `json:"intent,omitempty"`   // auto, alert, ticket, pipeline, knowledge, change
	SpaceID  string   `json:"space_id,omitempty"` // knowledge space filter
	TopK     int      `json:"top_k,omitempty"`    // number of sources to retrieve per intent
	Metadata []string `json:"metadata,omitempty"` // additional context hints
}

// SourceResult is a single citation retrieved for the question.
type SourceResult struct {
	Source   string      `json:"source"`   // knowledge, alert, ticket, pipeline, change, faq
	Title    string      `json:"title"`
	Content  string      `json:"content"`
	SpaceID  string      `json:"space_id,omitempty"`
	Similarity float64   `json:"similarity,omitempty"`
	Meta     interface{} `json:"meta,omitempty"`
}

// QueryResponse is the assistant's reply.
type QueryResponse struct {
	Question  string         `json:"question"`
	Intent    string         `json:"intent"` // resolved intent
	Answer    string         `json:"answer"`
	Sources   []SourceResult `json:"sources,omitempty"`
	Generated bool           `json:"generated"` // true when produced by an LLM
	CreatedAt time.Time      `json:"createdAt"`
}

// (ActionKind, ActionRequest, ActionResult are defined in action.go for TR-09/TR-11.)

// Conversation is a persisted assistant session (optional, lightweight).
type Conversation struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	UserID    string    `json:"user_id"`
	Question  string    `json:"question"`
	Answer    string    `json:"answer"`
	Intent    string    `json:"intent"`
	CreatedAt time.Time `json:"created_at"`
}

// Session holds a multi-turn conversation with the assistant.
type Session struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	UserID    string    `json:"user_id"`
	Messages  []Message `json:"messages,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Message is a single turn in a conversation.
type Message struct {
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
}

// SessionRequest carries optional session_id for multi-turn context.
type SessionRequest struct {
	SessionID string `json:"session_id,omitempty"`
}

// SessionResponse wraps a QueryResponse with session info.
type SessionResponse struct {
	QueryResponse `json:",inline"`
	SessionID     string `json:"session_id"`
	TurnCount     int    `json:"turn_count"`
}