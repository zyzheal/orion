package models

import "time"

// PipelineVersion represents a versioned snapshot of a pipeline
type PipelineVersion struct {
	ID          string    `db:"id" json:"id"`
	PipelineID  string    `db:"pipeline_id" json:"pipeline_id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Version     string    `db:"version" json:"version"`
	YAMLConfig  string    `db:"yaml_config" json:"yaml_config"`
	Config      string    `db:"config" json:"config"`
	Changelog   string    `db:"changelog" json:"changelog"`
	IsActive    bool      `db:"is_active" json:"is_active"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// CreateVersionRequest is input for creating a new pipeline version
type CreateVersionRequest struct {
	Version    string `json:"version" binding:"required"`
	YAMLConfig string `json:"yaml_config"`
	Config     string `json:"config"`
	Changelog  string `json:"changelog"`
}

// PipelineRBAC defines role-based access for a pipeline
type PipelineRBAC struct {
	ID         string    `db:"id" json:"id"`
	PipelineID string    `db:"pipeline_id" json:"pipeline_id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	UserID     string    `db:"user_id" json:"user_id"`
	Role       string    `db:"role" json:"role"` // viewer, editor, admin, executor
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// RBAC roles
const (
	RoleViewer   = "viewer"
	RoleEditor   = "editor"
	RoleExecutor = "executor"
	RoleAdmin    = "admin"
)

// GrantAccessRequest is input for granting pipeline access
type GrantAccessRequest struct {
	UserID string `json:"user_id" binding:"required"`
	Role   string `json:"role" binding:"required"`
}

// ApprovalGate represents an approval checkpoint in a pipeline
type ApprovalGate struct {
	ID            string     `db:"id" json:"id"`
	RunID         string     `db:"run_id" json:"run_id"`
	StageID       string     `db:"stage_id" json:"stage_id"`
	PipelineID    string     `db:"pipeline_id" json:"pipeline_id"`
	Status        string     `db:"status" json:"status"` // pending, approved, rejected
	RequiredApprovals int   `db:"required_approvals" json:"required_approvals"`
	CurrentApprovals  int   `db:"current_approvals" json:"current_approvals"`
	Approvers     string    `db:"approvers" json:"approvers"` // JSON array of user IDs
	Comments      string    `db:"comments" json:"comments"`
	ApprovedBy    string    `db:"approved_by" json:"approved_by,omitempty"`
	ApprovedAt    *time.Time `db:"approved_at" json:"approved_at,omitempty"`
	RejectedBy    string    `db:"rejected_by" json:"rejected_by,omitempty"`
	RejectedAt    *time.Time `db:"rejected_at" json:"rejected_at,omitempty"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
}

// ApproveRequest is input for approving a gate
type ApproveRequest struct {
	Comments string `json:"comments"`
}

// RejectRequest is input for rejecting a gate
type RejectRequest struct {
	Reason string `json:"reason" binding:"required"`
}
