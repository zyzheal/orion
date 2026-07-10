package models

// EventBusEvent represents an event published to NATS JetStream.
type EventBusEvent struct {
	ID          string `json:"id"`
	TenantID    string `json:"tenant_id"`
	EventType   string `json:"event_type"`
	Source      string `json:"source"`
	Payload     string `json:"payload,omitempty"`
	Priority    int    `json:"priority"`
	PipelineID  string `json:"pipeline_id,omitempty"`
	PublishedAt string `json:"published_at"`
	CreatedAt   string `json:"created_at"`
}
