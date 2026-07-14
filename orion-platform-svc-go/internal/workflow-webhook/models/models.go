package models

import "time"

// ---------------------------------------------------------------------------
// WebhookTrigger represents a workflow webhook trigger configuration.
// ---------------------------------------------------------------------------

// TriggerStrategy defines how the webhook triggers the workflow.
type TriggerStrategy string

const (
	StrategySync  TriggerStrategy = "sync"
	StrategyAsync TriggerStrategy = "async"
)

// WebhookTrigger is the core domain model persisted in PostgreSQL.
type WebhookTrigger struct {
	ID             string         `db:"id" json:"id"`
	TenantID       string         `db:"tenant_id" json:"tenantId"`
	WorkflowID     string         `db:"workflow_id" json:"workflowId"`
	Name           string         `db:"name" json:"name"`
	WebhookPath    string         `db:"webhook_path" json:"webhookPath"`
	WebhookSecret  string         `db:"webhook_secret" json:"webhookSecret"`
	TriggerStrategy TriggerStrategy `db:"trigger_strategy" json:"triggerStrategy"`
	Enabled        bool           `db:"enabled" json:"enabled"`
	CreatedAt      time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time      `db:"updated_at" json:"updatedAt"`
}

// ---------------------------------------------------------------------------
// WebhookTriggerLog records a single webhook trigger execution.
// ---------------------------------------------------------------------------

// WebhookTriggerLog stores the execution log for a webhook-triggered workflow.
type WebhookTriggerLog struct {
	ID           string     `db:"id" json:"id"`
	TriggerID    string     `db:"trigger_id" json:"triggerId"`
	EventType    string     `db:"event_type" json:"eventType"`
	EventPayload string     `db:"event_payload" json:"eventPayload"`
	Status       string     `db:"status" json:"status"`
	ErrorMessage string     `db:"error_message" json:"errorMessage"`
	DurationMs   int        `db:"duration_ms" json:"durationMs"`
	CreatedAt    time.Time  `db:"created_at" json:"createdAt"`
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

// CreateWebhookTriggerRequest is the request payload for creating a trigger.
type CreateWebhookTriggerRequest struct {
	Name           string `json:"name" binding:"required"`
	WorkflowID     string `json:"workflowId" binding:"required"`
	WebhookPath    string `json:"webhookPath" binding:"required"`
	WebhookSecret  string `json:"webhookSecret"`
	TriggerStrategy string `json:"triggerStrategy"`
	Enabled        bool   `json:"enabled"`
}

// UpdateWebhookTriggerRequest carries optional fields for partial updates.
type UpdateWebhookTriggerRequest struct {
	Name           *string `json:"name"`
	WorkflowID     *string `json:"workflowId"`
	WebhookPath    *string `json:"webhookPath"`
	WebhookSecret  *string `json:"webhookSecret"`
	TriggerStrategy *string `json:"triggerStrategy"`
	Enabled        *bool   `json:"enabled"`
}

// WebhookEvent is the payload received on the public webhook endpoint.
type WebhookEvent struct {
	WebhookPath string `json:"webhookPath"`
	Body        []byte `json:"body"`
}

// WebhookResponse is returned after processing a webhook trigger.
type WebhookResponse struct {
	InstanceID string `json:"instanceId"`
	Status     string `json:"status"`
}

// ListFilter carries optional filter criteria for listing triggers.
type ListFilter struct {
	WebhookPath *string `json:"webhookPath"`
	Enabled     *bool   `json:"enabled"`
}

// PaginatedResponse wraps paginated data for list endpoints.
type PaginatedResponse struct {
	Data     any    `json:"data"`
	Total    int    `json:"total"`
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
}