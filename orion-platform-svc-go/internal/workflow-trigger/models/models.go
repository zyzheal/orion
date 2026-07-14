package models

import (
	"errors"
	"time"
)

var (
	ErrTriggerNotFound  = errors.New("workflow trigger not found")
	ErrTriggerDisabled  = errors.New("workflow trigger is disabled")
)

// TriggerType represents the type of workflow trigger.
type TriggerType string

const (
	TriggerTypeEvent  TriggerType = "event"
	TriggerTypeCron   TriggerType = "cron"
	TriggerTypeManual TriggerType = "manual"
	TriggerTypeWebhook TriggerType = "webhook"
)

// TriggerStrategy represents the execution strategy for a trigger.
type TriggerStrategy string

const (
	StrategySync  TriggerStrategy = "sync"
	StrategyAsync TriggerStrategy = "async"
)

// WorkflowTrigger is the core domain model persisted in PostgreSQL.
type WorkflowTrigger struct {
	ID             string          `db:"id" json:"id"`
	TenantID       string          `db:"tenant_id" json:"tenant_id"`
	WorkflowID     string          `db:"workflow_id" json:"workflow_id"`
	Name           string          `db:"name" json:"name"`
	Type           TriggerType     `db:"type" json:"type"`
	Config         string          `db:"config" json:"config"`
	WebhookSecret  string          `db:"webhook_secret" json:"webhook_secret"`
	TriggerStrategy TriggerStrategy `db:"trigger_strategy" json:"trigger_strategy"`
	Enabled        bool            `db:"enabled" json:"enabled"`
	CreatedAt      time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time       `db:"updated_at" json:"updated_at"`
}

// CreateWorkflowTriggerRequest is the input for creating a new workflow trigger.
type CreateWorkflowTriggerRequest struct {
	WorkflowID      string          `json:"workflow_id" binding:"required"`
	Name            string          `json:"name" binding:"required"`
	Type            TriggerType     `json:"type" binding:"required"`
	Config          string          `json:"config"`
	WebhookSecret   string          `json:"webhook_secret"`
	TriggerStrategy TriggerStrategy `json:"trigger_strategy"`
}

// UpdateWorkflowTriggerRequest is the input for updating an existing workflow trigger.
type UpdateWorkflowTriggerRequest struct {
	WorkflowID      *string          `json:"workflow_id"`
	Name            *string          `json:"name"`
	Type            *TriggerType     `json:"type"`
	Config          *string          `json:"config"`
	WebhookSecret   *string          `json:"webhook_secret"`
	TriggerStrategy *TriggerStrategy `json:"trigger_strategy"`
	Enabled         *bool            `json:"enabled"`
}

// TriggerLog represents a record of a trigger execution.
type TriggerLog struct {
	ID             string    `db:"id" json:"id"`
	TriggerID      string    `db:"trigger_id" json:"trigger_id"`
	WorkflowID     string    `db:"workflow_id" json:"workflow_id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	Status         string    `db:"status" json:"status"`
	RequestPayload string    `db:"request_payload" json:"request_payload"`
	ResponseBody   string    `db:"response_body" json:"response_body"`
	ErrorMessage   string    `db:"error_message" json:"error_message"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

// PaginatedResponse wraps a list of items with pagination metadata.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
	Total    int         `json:"total"`
}

// ListFilter carries optional filter criteria for listing triggers.
type ListFilter struct {
	WorkflowID *string
	Type       *TriggerType
	Enabled    *bool
}