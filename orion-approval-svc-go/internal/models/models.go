package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ApprovalStatus represents the lifecycle of an approval.
type ApprovalStatus string

const (
	ApprovalPending  ApprovalStatus = "pending"
	ApprovalApproved ApprovalStatus = "approved"
	ApprovalRejected ApprovalStatus = "rejected"
	ApprovalCanceled ApprovalStatus = "canceled"
)

// StepStatus represents the lifecycle of an approval step.
type StepStatus string

const (
	StepPending  StepStatus = "pending"
	StepApproved StepStatus = "approved"
	StepRejected StepStatus = "rejected"
	StepSkipped  StepStatus = "skipped"
	StepWaiting  StepStatus = "waiting"
)

// ApprovalMode controls how multi-level approvals are processed.
type ApprovalMode string

const (
	ModeSerial   ApprovalMode = "serial"
	ModeParallel ApprovalMode = "parallel"
)

// LevelConfig holds per-level required approvals configuration.
type LevelConfig struct {
	Level             int `json:"level"`
	RequiredApprovals int `json:"required_approvals"`
}

// LevelConfigs is a slice of LevelConfig that implements sql.Scanner and driver.Valuer
// for JSONB database columns.
type LevelConfigs []LevelConfig

// Scan implements the sql.Scanner interface for reading JSONB from PostgreSQL.
func (lc *LevelConfigs) Scan(src interface{}) error {
	if src == nil {
		*lc = nil
		return nil
	}
	var data []byte
	switch v := src.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("LevelConfigs.Scan: unsupported type %T", src)
	}
	return json.Unmarshal(data, lc)
}

// Value implements the driver.Valuer interface for writing JSONB to PostgreSQL.
func (lc LevelConfigs) Value() (driver.Value, error) {
	if lc == nil {
		return nil, nil
	}
	data, err := json.Marshal(lc)
	if err != nil {
		return nil, fmt.Errorf("LevelConfigs.Value: %w", err)
	}
	return data, nil
}

// Approval represents an approval request.
type Approval struct {
	ID                string         `db:"id" json:"id"`
	TenantID          string         `db:"tenant_id" json:"tenant_id"`
	DefinitionID      *string        `db:"definition_id" json:"definition_id,omitempty"`
	ResourceType      string         `db:"resource_type" json:"resource_type"`
	ResourceID        string         `db:"resource_id" json:"resource_id"`
	Title             *string        `db:"title" json:"title,omitempty"`
	Status            ApprovalStatus `db:"status" json:"status"`
	RequestedBy       *string        `db:"requested_by" json:"requested_by,omitempty"`
	CurrentStep       int            `db:"current_step" json:"current_step"`
	TotalSteps        int            `db:"total_steps" json:"total_steps"`
	RequiredApprovals int            `db:"required_approvals" json:"required_approvals"`
	LevelConfigs      LevelConfigs   `db:"level_config" json:"level_config,omitempty"`
	Result            *string        `db:"result" json:"result,omitempty"`
	CompletedAt       *time.Time     `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt         time.Time      `db:"created_at" json:"created_at"`
}

// ApprovalStep represents a step in an approval workflow.
type ApprovalStep struct {
	ID         string     `db:"id" json:"id"`
	ApprovalID string     `db:"approval_id" json:"approval_id"`
	StepIndex  int        `db:"step_index" json:"step_index"`
	Level      int        `db:"level" json:"level"`
	ApproverID *string    `db:"approver_id" json:"approver_id,omitempty"`
	Status     StepStatus `db:"status" json:"status"`
	Comment    *string    `db:"comment" json:"comment,omitempty"`
	ActedAt    *time.Time `db:"acted_at" json:"acted_at,omitempty"`
}

// ApprovalLevel defines a single level in a multi-level approval workflow.
type ApprovalLevel struct {
	LevelIndex        int      `json:"level_index"`
	ApproverIDs       []string `json:"approver_ids"`
	RequiredApprovals int      `json:"required_approvals"`
}

// SubmitApprovalRequest is the input for submitting a multi-level approval.
type SubmitApprovalRequest struct {
	Title        string          `json:"title" binding:"required"`
	Description  *string         `json:"description"`
	ResourceType string          `json:"resource_type" binding:"required"`
	ResourceID   string          `json:"resource_id" binding:"required"`
	RequestedBy  string          `json:"requested_by" binding:"required"`
	Levels       []ApprovalLevel `json:"levels" binding:"required,min=1"`
	Mode         ApprovalMode    `json:"mode"`
}

// CreateApprovalRequest is the input for creating a simple approval.
type CreateApprovalRequest struct {
	ResourceType      string  `json:"resource_type" binding:"required"`
	ResourceID        string  `json:"resource_id" binding:"required"`
	Title             *string `json:"title"`
	RequestedBy       *string `json:"requested_by"`
	TotalSteps        int     `json:"total_steps"`
	RequiredApprovals int     `json:"required_approvals"`
}

// ApproveStepRequest is the input for approving a step.
type ApproveStepRequest struct {
	Comment *string `json:"comment"`
}

// RejectStepRequest is the input for rejecting a step.
type RejectStepRequest struct {
	Comment *string `json:"comment" binding:"required"`
}

// ApprovalWithSteps pairs an approval with its steps for API responses.
type ApprovalWithSteps struct {
	Approval *Approval      `json:"approval"`
	Steps    []ApprovalStep `json:"steps"`
}

// ApprovalStats holds aggregate approval statistics.
type ApprovalStats struct {
	Total    int `db:"total" json:"total"`
	Pending  int `db:"pending" json:"pending"`
	Approved int `db:"approved" json:"approved"`
	Rejected int `db:"rejected" json:"rejected"`
	Canceled int `db:"canceled" json:"canceled"`
}

// PaginatedRequest provides pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
