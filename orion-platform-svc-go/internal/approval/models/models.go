package models

import "time"

// ApprovalRequest represents a submitted approval request (multi-level / emergency).
type ApprovalRequest struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	Type          string    `json:"type" db:"type"`              // multi_level, emergency
	Status        string    `json:"status" db:"status"`          // pending, approved, rejected, withdrawn, cancelled
	Title         string    `json:"title" db:"title"`
	Description   string    `json:"description" db:"description"`
	ReqByID       string    `json:"req_by_id" db:"req_by_id"`
	ReqByName     string    `json:"req_by_name" db:"req_by_name"`
	TemplateID    string    `json:"template_id,omitempty" db:"template_id"`
	CurrentLevel  int       `json:"current_level" db:"current_level"`
	TotalLevels   int       `json:"total_levels" db:"total_levels"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// ApprovalLevel represents one step in a multi-level approval chain.
type ApprovalLevel struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	ApprovalID    string    `json:"approval_id" db:"approval_id"`
	Level         int       `json:"level" db:"level"`
	ApproverID    string    `json:"approver_id" db:"approver_id"`
	ApproverName  string    `json:"approver_name" db:"approver_name"`
	Status        string    `json:"status" db:"status"` // pending, approved, rejected, skipped
	Comment       string    `json:"comment" db:"comment"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// ApprovalHistory records one action taken on a request.
type ApprovalHistory struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	ApprovalID  string    `json:"approval_id" db:"approval_id"`
	Action      string    `json:"action" db:"action"`       // approve, reject, withdraw, cancel, delegate, reassign
	ActorID     string    `json:"actor_id" db:"actor_id"`
	ActorName   string    `json:"actor_name" db:"actor_name"`
	Comment     string    `json:"comment" db:"comment"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// ApprovalTemplate defines a reusable approval workflow template.
type ApprovalTemplate struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Levels      int       `json:"levels" db:"levels"`
	IsActive    bool      `json:"is_active" db:"is_active"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// ApprovalGate records a gate attached to a pipeline run/stage.
type ApprovalGate struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	RunID      string    `json:"run_id" db:"run_id"`
	StageID    string    `json:"stage_id" db:"stage_id"`
	Status     string    `json:"status" db:"status"` // pending, approved, rejected, skipped
	ActorID    string    `json:"actor_id" db:"actor_id"`
	ActorName  string    `json:"actor_name" db:"actor_name"`
	Comment    string    `json:"comment" db:"comment"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// --- Request bodies ---

type CreateApprovalRequest struct {
	Type        string `json:"type" binding:"required"`
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	TemplateID  string `json:"template_id"`
	Levels      int    `json:"levels"`
}

type ReviewApprovalRequest struct {
	Decision string `json:"decision" binding:"required"` // approve, reject
	Comment  string `json:"comment"`
}

type DelegateApprovalRequest struct {
	NewApproverID  string `json:"new_approver_id" binding:"required"`
	NewApproverName string `json:"new_approver_name"`
	Comment        string `json:"comment"`
}

type ReassignApprovalRequest struct {
	Level          int    `json:"level" binding:"required"`
	NewApproverID  string `json:"new_approver_id" binding:"required"`
	NewApproverName string `json:"new_approver_name"`
	Comment        string `json:"comment"`
}

type EmergencyApprovalRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description" binding:"required"`
	Reason      string `json:"reason" binding:"required"`
}

type CreateTemplateRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Levels      int    `json:"levels" binding:"required"`
}

type UpdateTemplateRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Levels      *int    `json:"levels"`
	IsActive    *bool   `json:"is_active"`
}

// --- Response helpers ---

type ApprovalStatistics struct {
	Total     int `json:"total"`
	Pending   int `json:"pending"`
	Approved  int `json:"approved"`
	Rejected  int `json:"rejected"`
	Withdrawn int `json:"withdrawn"`
	Cancelled int `json:"cancelled"`
}

type ApprovalTrendEntry struct {
	Date    string `json:"date"`
	Created int    `json:"created"`
	Approved int   `json:"approved"`
	Rejected int   `json:"rejected"`
}

type AgentAnalyzeRequest struct {
	ApprovalID string `json:"approval_id" binding:"required"`
}

type ListApprovalRequestsQuery struct {
	Type   string `form:"type"`
	Status string `form:"status"`
	Limit  int    `form:"limit"`
	Offset int    `form:"offset"`
}
