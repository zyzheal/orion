package models

// EventCategory represents the domain area of an event type.
type EventCategory string

const (
	CategoryPipeline EventCategory = "pipeline"
	CategoryCode     EventCategory = "code"
	CategoryDeploy   EventCategory = "deploy"
	CategoryConfig   EventCategory = "config"
	CategoryIncident EventCategory = "incident"
	CategoryWorkflow EventCategory = "workflow"
)

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

// WorkflowTrigger represents a registered trigger (event or cron based).
type WorkflowTrigger struct {
	ID             string  `json:"id" db:"id"`
	TenantID       string  `json:"tenantId" db:"tenant_id"`
	Name           string  `json:"name" db:"name"`
	Type           string  `json:"type" db:"type"` // "event" or "cron"
	WorkflowID     string  `json:"workflowId" db:"workflow_id"`
	EventType      string  `json:"eventType" db:"event_type"`     // e.g. "pipeline.run.started"
	EventFilter    string  `json:"eventFilter" db:"event_filter"` // JSON object
	CronExpression *string `json:"cronExpression,omitempty" db:"cron_expression"`
	Enabled        bool    `json:"enabled" db:"enabled"`
	CreatedAt      *int64  `json:"createdAt" db:"created_at"` // unix seconds
}

// ---------------------------------------------------------------------------
// Known event types
// ---------------------------------------------------------------------------

// EventTypeMeta describes a known event type and its schema.
type EventTypeMeta struct {
	Type          string                 `json:"type"`
	Category      string                 `json:"category"`
	Description   string                 `json:"description"`
	SamplePayload map[string]interface{} `json:"samplePayload"`
}

// OrionStream describes a published event stream.
type OrionStream struct {
	Name     string   `json:"name"`
	Subjects []string `json:"subjects"`
}

// ---------------------------------------------------------------------------
// Request / Response models
// ---------------------------------------------------------------------------

// CreateTriggerRequest is the request body for creating/updating a trigger.
type CreateTriggerRequest struct {
	Name           string  `json:"name" binding:"required"`
	Type           string  `json:"type" binding:"required"`
	WorkflowID     string  `json:"workflowId" binding:"required"`
	EventType      string  `json:"eventType"`
	EventFilter    string  `json:"eventFilter"`
	CronExpression *string `json:"cronExpression,omitempty"`
	Enabled        bool    `json:"enabled"`
}

// TestMatchRequest is the request body for testing event-trigger matching.
type TestMatchRequest struct {
	EventType    string                 `json:"eventType" binding:"required"`
	EventPayload map[string]interface{} `json:"eventPayload"`
	TriggerID    *string                `json:"triggerId"`
}

// SubscriptionSummary describes one active subscription (enabled event trigger).
type SubscriptionSummary struct {
	TriggerID   string      `json:"triggerId"`
	TriggerName string      `json:"triggerName"`
	EventType   string      `json:"eventType"`
	WorkflowID  string      `json:"workflowId"`
	Enabled     bool        `json:"enabled"`
	EventFilter interface{} `json:"eventFilter"`
	CreatedAt   *int64      `json:"createdAt"`
}

// TriggerMatchResult describes the result of matching a single trigger against an event.
type TriggerMatchResult struct {
	TriggerID     string                 `json:"triggerId"`
	TriggerName   string                 `json:"triggerName"`
	WorkflowID    string                 `json:"workflowId"`
	Matched       bool                   `json:"matched"`
	MatchDetails  string                 `json:"matchDetails"`
	MatchedFields map[string]interface{} `json:"matchedFields,omitempty"`
}

// TriggerStat describes a lightweight statistic for a trigger.
type TriggerStat struct {
	TriggerID      string  `json:"triggerId"`
	TriggerName    string  `json:"triggerName"`
	Type           string  `json:"type"`
	Enabled        bool    `json:"enabled"`
	EventType      string  `json:"eventType"`
	CronExpression *string `json:"cronExpression,omitempty"`
}

// ByTypeStat aggregates trigger counts grouped by type.
type ByTypeStat struct {
	Total   int `json:"total"`
	Enabled int `json:"enabled"`
}
