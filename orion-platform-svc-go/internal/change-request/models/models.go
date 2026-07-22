package models

import "time"

// ChangeRequest represents a change request entity.
type ChangeRequest struct {
	ID             string     `db:"id" json:"id"`
	TenantID       string     `db:"tenant_id" json:"tenantId"`
	Title          string     `db:"title" json:"title"`
	Description    *string    `db:"description" json:"description"`
	Type           string     `db:"type" json:"type"`
	RiskLevel      *string    `db:"risk_level" json:"riskLevel"`
	Status         string     `db:"status" json:"status"`
	ImpactScope    *string    `db:"impact_scope" json:"impactScope"`
	RollbackPlan   *string    `db:"rollback_plan" json:"rollbackPlan"`
	ScheduledStart *time.Time `db:"scheduled_start" json:"scheduledStart"`
	ScheduledEnd   *time.Time `db:"scheduled_end" json:"scheduledEnd"`
	CreatedBy      *string    `db:"created_by" json:"createdBy"`
	CreatedAt      time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateChangeRequestRequest is the request body for creating a change request.
type CreateChangeRequestRequest struct {
	Title          string     `json:"title" binding:"required"`
	Description    *string    `json:"description"`
	ChangeType     string     `json:"changeType" binding:"required"`
	RiskLevel      *string    `json:"riskLevel"`
	ImpactScope    *string    `json:"impactScope"`
	RollbackPlan   *string    `json:"rollbackPlan"`
	ScheduledStart *time.Time `json:"scheduledStart"`
	ScheduledEnd   *time.Time `json:"scheduledEnd"`
	CreatedBy      *string    `json:"createdBy"`
}

// UpdateChangeRequestRequest is the request body for updating a change request.
type UpdateChangeRequestRequest struct {
	Title          *string    `json:"title"`
	Description    *string    `json:"description"`
	RiskLevel      *string    `json:"riskLevel"`
	Status         *string    `json:"status"`
	ImpactScope    *string    `json:"impactScope"`
	RollbackPlan   *string    `json:"rollbackPlan"`
	ScheduledStart *time.Time `json:"scheduledStart"`
	ScheduledEnd   *time.Time `json:"scheduledEnd"`
}

// ListChangeRequestRequest is the request body for listing change requests.
type ListChangeRequestRequest struct {
	Status     *string `json:"status"`
	ChangeType *string `json:"changeType"`
	RiskLevel  *string `json:"riskLevel"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data       any   `json:"data"`
	Total      int   `json:"total"`
	Page       int   `json:"page"`
	PageSize   int   `json:"pageSize"`
}

// ChangeApproval represents an approval entry in the chain.
type ChangeApproval struct {
	ID         string    `db:"id" json:"id"`
	RequestID  string    `db:"request_id" json:"requestId"`
	ApproverID string    `db:"approver_id" json:"approverId"`
	Decision   string    `db:"decision" json:"decision"`
	Comments   *string   `db:"comments" json:"comments"`
	CreatedAt  time.Time `db:"created_at" json:"createdAt"`
}

// CreateApprovalRequest is the request body for creating an approval decision.
type CreateApprovalRequest struct {
	ApproverID string  `json:"approverId" binding:"required"`
	Comments   *string `json:"comment"`
}

// ExecutionStep represents a single execution step.
type ExecutionStep struct {
	ID        string            `db:"id" json:"id"`
	RequestID string            `db:"request_id" json:"requestId"`
	Status    string            `db:"status" json:"status"`
	StartedAt *time.Time        `db:"started_at" json:"startedAt"`
	CompletedAt *time.Time      `db:"completed_at" json:"completedAt"`
	Result    map[string]any    `db:"result" json:"result"`
	CreatedAt time.Time         `db:"created_at" json:"createdAt"`
}

// CreateExecutionStepRequest is the request body for creating an execution step.
type CreateExecutionStepRequest struct {
	StepName  string `json:"stepName" binding:"required"`
	StepOrder int    `json:"stepOrder" binding:"required"`
}

// StartExecutionRequest is the request body for starting execution.
type StartExecutionRequest struct {
	Steps []CreateExecutionStepRequest `json:"steps" binding:"required,min=1"`
}

// UpdateExecutionStepRequest is the request body for updating an execution step.
type UpdateExecutionStepRequest struct {
	Status      string            `json:"status" binding:"required"`
	Result      map[string]any    `json:"result"`
	StartedAt   *time.Time        `json:"startedAt"`
	CompletedAt *time.Time        `json:"completedAt"`
}

// ExecutionProgress represents the execution progress for a change request.
type ExecutionProgress struct {
	Steps []ExecutionStep `json:"steps"`
}
