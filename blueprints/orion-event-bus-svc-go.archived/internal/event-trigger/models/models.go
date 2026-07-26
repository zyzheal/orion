package models

import (
	"time"
)

type EventTrigger struct {
	ID          string                 `json:"id" db:"id"`
	TenantID    string                 `json:"tenant_id" db:"tenant_id"`
	Name        string                 `json:"name" db:"name"`
	Description string                 `json:"description" db:"description"`
	EventType   string                 `json:"event_type" db:"event_type"`
	EventFilter map[string]interface{} `json:"event_filter" db:"event_filter"`
	Enabled     bool                   `json:"enabled" db:"enabled"`
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
}

type EventTriggerLog struct {
	ID           string     `json:"id" db:"id"`
	TenantID     string     `json:"tenant_id" db:"tenant_id"`
	TriggerID    string     `json:"trigger_id" db:"trigger_id"`
	EventType    string     `json:"event_type" db:"event_type"`
	EventPayload map[string]interface{} `json:"event_payload" db:"event_payload"`
	Result       string     `json:"result" db:"result"`
	Message      string     `json:"message" db:"message"`
	ExecutedAt   time.Time  `json:"executed_at" db:"executed_at"`
}

type CreateEventTriggerRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	EventType   string                 `json:"event_type" binding:"required"`
	EventFilter map[string]interface{} `json:"event_filter"`
	Enabled     *bool                  `json:"enabled"`
}

type UpdateEventTriggerRequest struct {
	Name        *string                `json:"name"`
	Description *string                `json:"description"`
	EventType   *string                `json:"event_type"`
	EventFilter map[string]interface{} `json:"event_filter"`
	Enabled     *bool                  `json:"enabled"`
}

type EvaluateEventRequest struct {
	Event    map[string]interface{} `json:"event" binding:"required"`
}

type EvaluateResult struct {
	TriggerID      string                 `json:"trigger_id"`
	TriggerName    string                 `json:"trigger_name"`
	EventType      string                 `json:"event_type"`
	Matched        bool                   `json:"matched"`
	ActionExecuted bool                   `json:"action_executed"`
	Message        string                 `json:"message"`
	Details        map[string]interface{} `json:"details"`
}
