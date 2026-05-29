package models

import "time"

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
)

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
	Result            *string        `db:"result" json:"result,omitempty"`
	CompletedAt       *time.Time     `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt         time.Time      `db:"created_at" json:"created_at"`
}

// ApprovalStep represents a step in an approval workflow.
type ApprovalStep struct {
	ID         string     `db:"id" json:"id"`
	ApprovalID string     `db:"approval_id" json:"approval_id"`
	StepIndex  int        `db:"step_index" json:"step_index"`
	ApproverID *string    `db:"approver_id" json:"approver_id,omitempty"`
	Status     StepStatus `db:"status" json:"status"`
	Comment    *string    `db:"comment" json:"comment,omitempty"`
	ActedAt    *time.Time `db:"acted_at" json:"acted_at,omitempty"`
}

// CreateApprovalRequest is the input for creating an approval.
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
