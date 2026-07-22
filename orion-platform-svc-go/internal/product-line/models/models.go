package models

import "time"

// Phase represents the lifecycle phase of a product line.
type Phase string

const (
	PhasePending   Phase = "Pending"
	PhaseActive    Phase = "Active"
	PhaseSuspended Phase = "Suspended"
)

// ProductLine is the canonical product-line entity.
type ProductLine struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Phase     Phase     `json:"phase" db:"phase"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// Condition represents a product-line status condition.
type Condition struct {
	Type    string `json:"type"`
	Status  string `json:"status"`
	Reason  string `json:"reason"`
	Message string `json:"message"`
}

// CreateProductLineRequest is the request body for creating a product line.
type CreateProductLineRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateProductLineRequest is the request body for updating a product line.
type UpdateProductLineRequest struct {
	Name *string `json:"name"`
}

// ==================== ReleaseTrain ====================

// ReleaseTrain is a scheduled release train for a product line.
type ReleaseTrain struct {
	ID               string      `json:"id" db:"id"`
	ProductLineID    string      `json:"product_line_id" db:"product_line_id"`
	Name             string      `json:"name" db:"name"`
	Schedule         string      `json:"schedule" db:"schedule"`
	TargetBranch     string      `json:"target_branch" db:"target_branch"`
	SourceBranch     string      `json:"source_branch" db:"source_branch"`
	AutoPromote      bool        `json:"auto_promote" db:"auto_promote"`
	ApprovalRequired bool        `json:"approval_required" db:"approval_required"`
	Approvers        string      `json:"approvers" db:"approvers"`
	State            string      `json:"state" db:"state"`
	CreatedAt        time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time   `json:"updated_at" db:"updated_at"`
}

// ReleaseTrainStatus is the runtime status of a release train.
type ReleaseTrainStatus struct {
	State     string `json:"state"`
	LastRun   string `json:"last_run,omitempty"`
	NextRun   string `json:"next_run,omitempty"`
	LastRelease string `json:"last_release,omitempty"`
}

// CreateReleaseTrainRequest is the request body for creating a release train.
type CreateReleaseTrainRequest struct {
	Name             string   `json:"name" binding:"required"`
	Schedule         string   `json:"schedule"`
	TargetBranch     string   `json:"target_branch"`
	SourceBranch     string   `json:"source_branch"`
	AutoPromote      bool     `json:"auto_promote"`
	ApprovalRequired *bool    `json:"approval_required"`
	Approvers        []string `json:"approvers"`
}

// ==================== EnvironmentMapping ====================

// EnvironmentMapping maps a branch pattern (regex) to a deployment environment
// for a product line. Mappings are evaluated in priority order (lower first);
// the first matching pattern wins.
type EnvironmentMapping struct {
	ID               string    `json:"id" db:"id"`
	ProductLineID    string    `json:"product_line_id" db:"product_line_id"`
	TenantID         string    `json:"tenant_id" db:"tenant_id"`
	BranchPattern    string    `json:"branch_pattern" db:"branch_pattern"`
	Environment      string    `json:"environment" db:"environment"`
	RequiresApproval bool      `json:"requires_approval" db:"requires_approval"`
	Priority         int       `json:"priority" db:"priority"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

// CreateEnvironmentMappingRequest is the request body for creating an
// environment mapping for a product line.
type CreateEnvironmentMappingRequest struct {
	BranchPattern    string `json:"branch_pattern" binding:"required"`
	Environment      string `json:"environment" binding:"required"`
	RequiresApproval *bool  `json:"requires_approval"`
	Priority         *int   `json:"priority"`
}

// ==================== HotfixChannel ====================

// HotfixChannel is an emergency fix channel for a product line.
type HotfixChannel struct {
	ID               string    `json:"id" db:"id"`
	ProductLineID    string    `json:"product_line_id" db:"product_line_id"`
	Name             string    `json:"name" db:"name"`
	Enabled          bool      `json:"enabled" db:"enabled"`
	BranchPattern    string    `json:"branch_pattern" db:"branch_pattern"`
	ApprovalRequired bool      `json:"approval_required" db:"approval_required"`
	ApprovalTimeout  int       `json:"approval_timeout" db:"approval_timeout"`
	AutoMerge        bool      `json:"auto_merge" db:"auto_merge"`
	NotifyOnCall     bool      `json:"notify_on_call" db:"notify_on_call"`
	MaxDuration      int       `json:"max_duration" db:"max_duration"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

// HotfixChannelStatus is the runtime status of a hotfix channel.
type HotfixChannelStatus struct {
	ActiveHotfixes int    `json:"active_hotfixes"`
	LastHotfix     string `json:"last_hotfix,omitempty"`
}

// CreateHotfixChannelRequest is the request body for creating a hotfix channel.
type CreateHotfixChannelRequest struct {
	Name             string   `json:"name" binding:"required"`
	Enabled          *bool    `json:"enabled"`
	BranchPattern    string   `json:"branch_pattern"`
	ApprovalRequired *bool    `json:"approval_required"`
	ApprovalTimeout  *int     `json:"approval_timeout"`
	AutoMerge        *bool    `json:"auto_merge"`
	NotifyOnCall     *bool    `json:"notify_on_call"`
	MaxDuration      *int     `json:"max_duration"`
}

// (EnvironmentMapping and CreateEnvironmentMappingRequest are defined above, see EnvironmentMapping section)
