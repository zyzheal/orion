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

// HealingStrategy represents a named collection of healing actions for an incident.
type HealingStrategy struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// HealingIncident represents an active self-healing incident.
type HealingIncident struct {
	ID          uuid.UUID  `json:"id"`
	TenantID    uuid.UUID  `json:"tenant_id"`
	StrategyID  uuid.UUID  `json:"strategy_id"`
	Trigger     string     `json:"trigger"`
	Status      string     `json:"status"`
	StartedAt   time.Time  `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// HistoryQuery filters for healing incident list queries.
type HistoryQuery struct {
	Status  *string    `json:"status"`
	From    *time.Time `json:"from"`
	To      *time.Time `json:"to"`
	Limit   int        `json:"limit"`
	Offset  int        `json:"offset"`
}

// EffectivenessQuery filters for healing effectiveness queries.
type EffectivenessQuery struct {
	StrategyID *uuid.UUID `json:"strategy_id"`
	From       *time.Time `json:"from"`
	To         *time.Time `json:"to"`
}

// CreateIncidentRequest is the request payload for creating a healing incident.
type CreateIncidentRequest struct {
	StrategyID uuid.UUID `json:"strategy_id" binding:"required"`
	Trigger    string    `json:"trigger" binding:"required"`
}

// ApprovalRequest represents a manual approval step for a healing action.
type ApprovalRequest struct {
	ID          uuid.UUID  `json:"id"`
	IncidentID  uuid.UUID  `json:"incident_id"`
	Title       string     `json:"title"`
	Status      string     `json:"status"` // pending, approved, rejected, expired
	RiskLevel   string     `json:"risk_level"`
	ExpiresAt   *time.Time `json:"expires_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

// RespondApprovalRequest is the request payload for responding to an approval request.
type RespondApprovalRequest struct {
	Approved bool   `json:"approved"`
	Comment  string `json:"comment"`
}

// HealingEffectiveness aggregates execution metrics for a healing strategy.
type HealingEffectiveness struct {
	StrategyID         uuid.UUID `json:"strategy_id"`
	TotalIncidents     int64     `json:"total_incidents"`
	ResolvedIncidents  int64     `json:"resolved_incidents"`
	ResolutionRate     float64   `json:"resolution_rate"`
	AvgResolutionSecs  int64     `json:"avg_resolution_secs"`
}

// RegisterStrategyRequest is the request payload for registering a new healing strategy.
type RegisterStrategyRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
}
