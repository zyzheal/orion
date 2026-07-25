package models

import "time"

// WorkerPolicy defines a dispatch policy for assigning work to workers.
type WorkerPolicy struct {
	ID        string `json:"id" db:"id"`
	TenantID  string `json:"tenant_id" db:"tenant_id"`
	Name      string `json:"name" db:"name"`
	Type      string `json:"type" db:"type"` // round_robin, least_loaded, skill_match, role_based, department_based, weight, custom
	Config    string `json:"config" db:"config"`
	Priority  int    `json:"priority" db:"priority"`
	Enabled   bool   `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// WorkerAssignment records the result of a dispatch decision.
type WorkerAssignment struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	PolicyID    string    `json:"policy_id" db:"policy_id"`
	TargetType  string    `json:"target_type" db:"target_type"` // ticket, task, incident, change
	TargetID    string    `json:"target_id" db:"target_id"`
	WorkerID    string    `json:"worker_id" db:"worker_id"`
	WorkerType  string    `json:"worker_type" db:"worker_type"` // user, role, group, auto
	Status      string    `json:"status" db:"status"`           // assigned, in_progress, completed, cancelled
	AssignedAt  time.Time `json:"assigned_at" db:"assigned_at"`
	CompletedAt *time.Time `json:"completed_at" db:"completed_at"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// WorkerCapability describes a worker's skills and capacity limits.
type WorkerCapability struct {
	ID         string `json:"id" db:"id"`
	TenantID   string `json:"tenant_id" db:"tenant_id"`
	WorkerID   string `json:"worker_id" db:"worker_id"`
	WorkerType string `json:"worker_type" db:"worker_type"`
	Skill      string `json:"skill" db:"skill"`
	Level      int    `json:"level" db:"level"`   // 1-5
	Weight     int    `json:"weight" db:"weight"` // 0-100
	MaxLoad    int    `json:"max_load" db:"max_load"`
	Enabled    bool   `json:"enabled" db:"enabled"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// --- Request bodies ---

type CreatePolicyRequest struct {
	Name     string `json:"name" binding:"required"`
	Type     string `json:"type" binding:"required"`
	Config   string `json:"config"`
	Priority int    `json:"priority"`
	Enabled  bool   `json:"enabled"`
}

type UpdatePolicyRequest struct {
	Name     *string `json:"name"`
	Type     *string `json:"type"`
	Config   *string `json:"config"`
	Priority *int    `json:"priority"`
	Enabled  *bool   `json:"enabled"`
}

type CreateCapabilityRequest struct {
	WorkerID   string `json:"worker_id" binding:"required"`
	WorkerType string `json:"worker_type" binding:"required"`
	Skill      string `json:"skill" binding:"required"`
	Level      int    `json:"level"`
	Weight     int    `json:"weight"`
	MaxLoad    int    `json:"max_load"`
	Enabled    bool   `json:"enabled"`
}

type DispatchRequest struct {
	TargetType string            `json:"target_type" binding:"required"`
	TargetID   string            `json:"target_id" binding:"required"`
	PolicyType string            `json:"policy_type"`
	Context    map[string]string `json:"context"`
}

type ListPoliciesQuery struct {
	Type   string `form:"type"`
	Enabled string `form:"enabled"`
	Limit  int    `form:"limit"`
	Offset int    `form:"offset"`
}

// --- Response helpers ---

type WorkerLoadInfo struct {
	WorkerID      string `json:"worker_id"`
	WorkerType    string `json:"worker_type"`
	CurrentLoad   int    `json:"current_load"`
	MaxLoad       int    `json:"max_load"`
	AvailableLoad int    `json:"available_load"`
}

type DispatchResult struct {
	Assignment *WorkerAssignment `json:"assignment"`
}
