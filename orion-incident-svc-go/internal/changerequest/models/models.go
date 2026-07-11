package models

import "time"

// ==================== Change Request (RFC Approval Chain) ====================

type ChangeRequest struct {
	ID            string     `db:"id" json:"id"`
	TenantID      string     `db:"tenant_id" json:"tenant_id"`
	Title         string     `db:"title" json:"title"`
	Description   *string    `db:"description" json:"description,omitempty"`
	ChangeType    string     `db:"change_type" json:"change_type"` // standard, normal, emergency
	RiskLevel     string     `db:"risk_level" json:"risk_level"`
	ImpactScope   *string    `db:"impact_scope" json:"impact_scope,omitempty"`
	RollbackPlan  *string    `db:"rollback_plan" json:"rollback_plan,omitempty"`
	Status        string     `db:"status" json:"status"`
	ScheduledStart *time.Time `db:"scheduled_start" json:"scheduled_start,omitempty"`
	ScheduledEnd  *time.Time `db:"scheduled_end" json:"scheduled_end,omitempty"`
	CreatedBy     string     `db:"created_by" json:"created_by"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updated_at"`
}

type CreateChangeRequestRequest struct {
	Title          string     `json:"title" binding:"required"`
	Description    *string    `json:"description"`
	ChangeType     string     `json:"change_type" binding:"required"`
	RiskLevel      *string    `json:"risk_level"`
	ImpactScope    *string    `json:"impact_scope"`
	RollbackPlan   *string    `json:"rollback_plan"`
	ScheduledStart *time.Time `json:"scheduled_start"`
	ScheduledEnd   *time.Time `json:"scheduled_end"`
	CreatedBy      string     `json:"created_by"`
}

type UpdateChangeRequestRequest struct {
	Title          *string    `json:"title"`
	Description    *string    `json:"description"`
	ChangeType     *string    `json:"change_type"`
	RiskLevel      *string    `json:"risk_level"`
	ImpactScope    *string    `json:"impact_scope"`
	RollbackPlan   *string    `json:"rollback_plan"`
	Status         *string    `json:"status"`
	ScheduledStart *time.Time `json:"scheduled_start"`
	ScheduledEnd   *time.Time `json:"scheduled_end"`
}

// ==================== Approval ====================

type Approval struct {
	ID             string    `db:"id" json:"id"`
	ChangeRequestID string   `db:"change_request_id" json:"change_request_id"`
	ApproverID     string    `db:"approver_id" json:"approver_id"`
	Status         string    `db:"status" json:"status"` // pending, approved, rejected
	Comment        *string   `db:"comment" json:"comment,omitempty"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	RespondedAt    *time.Time `db:"responded_at" json:"responded_at,omitempty"`
}

type ApproveRequest struct {
	ApproverID string  `json:"approver_id" binding:"required"`
	Comment    *string `json:"comment"`
}

type RejectRequest struct {
	ApproverID string  `json:"approver_id" binding:"required"`
	Comment    *string `json:"comment"`
}

// ==================== Execution Step ====================

type ExecutionStep struct {
	ID             string    `db:"id" json:"id"`
	ChangeRequestID string   `db:"change_request_id" json:"change_request_id"`
	StepName       string    `db:"step_name" json:"step_name"`
	StepOrder      int       `db:"step_order" json:"step_order"`
	Status         string    `db:"status" json:"status"` // pending, running, completed, failed
	StartedAt      *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt    *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updated_at"`
}

type CreateExecutionStepRequest struct {
	StepName  string `json:"step_name" binding:"required"`
	StepOrder int    `json:"step_order" binding:"required"`
}

type UpdateExecutionStepRequest struct {
	Status  *string `json:"status"`
	Result  *string `json:"result"`
}

type ExecutionProgress struct {
	ID      string           `json:"id"`
	Status  string           `json:"status"`
	Steps   []ExecutionStep  `json:"steps"`
}