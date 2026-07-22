package models

import "time"

// ---------------------------------------------------------------------------
// Inference request / response
// ---------------------------------------------------------------------------

// InferenceRequest represents a request to the Python AI inference service.
type InferenceRequest struct {
	Service    string                 `json:"service"`    // "classify", "embedding", "anomaly"
	InputType  string                 `json:"inputType"`  // "image", "text", "data"
	ImageData  []byte                 `json:"imageData,omitempty"` // base64 or raw bytes
	Text       string                 `json:"text,omitempty"`
	DataPoints []map[string]interface{} `json:"dataPoints,omitempty"`
	Model      string                 `json:"model"`
	Options    map[string]interface{} `json:"options,omitempty"`
}

// InferenceResponse represents a response from the Python AI inference service.
type InferenceResponse struct {
	Success  bool                   `json:"success"`
	Data     map[string]interface{} `json:"data,omitempty"`
	Error    string                 `json:"error,omitempty"`
	Duration float64                `json:"duration"` // seconds
}

// DecisionRequest represents a request to the Python AI decision service.
type DecisionRequest struct {
	Type    string                 `json:"type"` // "deployment", "incident", "general"
	Context map[string]interface{} `json:"context"`
	Options []map[string]interface{} `json:"options,omitempty"`
}

// DecisionResponse represents a response from the Python AI decision service.
type DecisionResponse struct {
	Success    bool                   `json:"success"`
	Decision   map[string]interface{} `json:"decision,omitempty"`
	Confidence float64                `json:"confidence"`
	Error      string                 `json:"error,omitempty"`
}

// ---------------------------------------------------------------------------
// Audit / persistence models
// ---------------------------------------------------------------------------

// InferenceRecord is persisted in PostgreSQL to audit inference/decision calls.
type InferenceRecord struct {
	ID              string    `db:"id" json:"id"`
	TenantID        string    `db:"tenant_id" json:"tenant_id"`
	UserID          string    `db:"user_id" json:"user_id"`
	Service         string    `db:"service" json:"service"`         // "classify", "embedding", "anomaly"
	Type            string    `db:"type" json:"type"`               // "inference" or "decision"
	Model           string    `db:"model" json:"model"`
	InputType       string    `db:"input_type" json:"input_type"`   // "image", "text", "data"
	RequestPayload  string    `db:"request_payload" json:"request_payload"`   // JSON
	ResponsePayload string    `db:"response_payload" json:"response_payload"` // JSON
	Success         bool      `db:"success" json:"success"`
	Error           string    `db:"error" json:"error"`
	DurationSeconds float64   `db:"duration_seconds" json:"duration_seconds"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
}

// ListRecordFilter holds optional filters for listing inference history.
type ListRecordFilter struct {
	Type    *string
	Service *string
	Success *bool
}
