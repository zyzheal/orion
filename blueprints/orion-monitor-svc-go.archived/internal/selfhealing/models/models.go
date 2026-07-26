package models

import (
	"time"

	"github.com/google/uuid"
)

// HealingAction represents a self-healing action.
type HealingAction struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	ActionType  string    `json:"action_type"`
	Target      string    `json:"target"`
	Command     string    `json:"command"`
	IsEnabled   bool      `json:"is_enabled"`
	RetryCount  int       `json:"retry_count"`
	RetryDelay  int       `json:"retry_delay"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// HealingTrigger represents a trigger condition for self-healing.
type HealingTrigger struct {
	ID           uuid.UUID  `json:"id"`
	TenantID     uuid.UUID  `json:"tenant_id"`
	ActionID     uuid.UUID  `json:"action_id"`
	Condition    string     `json:"condition"`
	Threshold    float64    `json:"threshold"`
	EvaluationSec int      `json:"evaluation_sec"`
	IsEnabled    bool       `json:"is_enabled"`
	CreatedAt    time.Time  `json:"created_at"`
}

// HealingHistory represents the execution history of a healing action.
type HealingHistory struct {
	ID          uuid.UUID  `json:"id"`
	TenantID    uuid.UUID  `json:"tenant_id"`
	ActionID    uuid.UUID  `json:"action_id"`
	TriggerID   *uuid.UUID `json:"trigger_id,omitempty"`
	Status      string     `json:"status"`
	Result      string     `json:"result"`
	Attempt     int        `json:"attempt"`
	TriggeredBy string     `json:"triggered_by"`
	StartedAt   time.Time  `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
}

// CreateHealingActionRequest for creating a healing action.
type CreateHealingActionRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	ActionType  string `json:"action_type" binding:"required,oneof=restart deploy rollback scale notify run_script"`
	Target      string `json:"target" binding:"required"`
	Command     string `json:"command"`
	IsEnabled   *bool  `json:"is_enabled"`
	RetryCount  int    `json:"retry_count"`
	RetryDelay  int    `json:"retry_delay"`
}

// HealingActionResponse wraps healing action query results.
type HealingActionResponse struct {
	Total int64          `json:"total"`
	Data  []HealingAction `json:"data"`
}

// HealingHistoryResponse wraps healing history query results.
type HealingHistoryResponse struct {
	Total int64            `json:"total"`
	Data  []HealingHistory `json:"data"`
}
