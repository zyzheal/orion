package models

import "time"

// MultiModalTrigger represents a multi-modal-trigger record.
type MultiModalTrigger struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Value     string    `json:"value" db:"value"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type CreateMultiModalTriggerRequest struct {
	Name    string `json:"name" binding:"required"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

type UpdateMultiModalTriggerRequest struct {
	Name    *string `json:"name"`
	Value   *string `json:"value"`
	Enabled *bool   `json:"enabled"`
}

// TriggerExecuteRequest is the request body for executing a trigger.
type TriggerExecuteRequest struct {
	Payload map[string]interface{} `json:"payload"`
}

// TriggerEvaluateRequest is the request body for evaluating a trigger.
type TriggerEvaluateRequest struct {
	Context map[string]interface{} `json:"context"`
}

// TriggerExecution is the result of executing a trigger.
type TriggerExecution struct {
	TriggerID     string `json:"triggerId"`
	Status        string `json:"status"`
	PipelineRunID string `json:"pipelineRunId,omitempty"`
}

// TriggerEvaluation is the result of evaluating a trigger.
type TriggerEvaluation struct {
	TriggerID string `json:"triggerId"`
	Matched   bool   `json:"matched"`
	Reason    string `json:"reason"`
}

// WebhookProcessRequest is the request body for processing a webhook event.
type WebhookProcessRequest struct {
	Source  string                 `json:"source"`
	Event   string                 `json:"event"`
	Payload map[string]interface{} `json:"payload"`
}

// WebhookProcessResult is the result of processing a webhook event.
type WebhookProcessResult struct {
	Status            string   `json:"status"`
	TriggeredTriggers []string `json:"triggeredTriggers"`
}
