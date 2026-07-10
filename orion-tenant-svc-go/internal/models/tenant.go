package models

import "time"

// Tenant represents a multi-tenant account in Orion.
type Tenant struct {
	ID          string            `db:"id" json:"id"`
	Name        string            `db:"name" json:"name"`
	DisplayName *string           `db:"display_name" json:"display_name"`
	Status      string            `db:"status" json:"status"`
	Settings    map[string]any    `db:"settings" json:"settings"`
	CreatedAt   time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time         `db:"updated_at" json:"updated_at"`
}

// TenantUser represents a user-tenant membership relationship.
type TenantUser struct {
	ID              string    `db:"id" json:"id"`
	TenantID        string    `db:"tenant_id" json:"tenant_id"`
	UserID          string    `db:"user_id" json:"user_id"`
	Role            string    `db:"role" json:"role"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time `db:"updated_at" json:"updated_at"`
	// Populated via LEFT JOIN with users table
	Username        *string `db:"username" json:"username"`
	Email           *string `db:"email" json:"email"`
	UserDisplayName *string `db:"display_name" json:"display_name"`
	UserStatus      *string `db:"user_status" json:"user_status"`
}

// TenantInvite represents a pending user invitation to a tenant.
type TenantInvite struct {
	ID                string     `db:"id" json:"id"`
	TenantID          string     `db:"tenant_id" json:"tenant_id"`
	Email             string     `db:"email" json:"email"`
	Role              string     `db:"role" json:"role"`
	InviteCode        string     `db:"invite_code" json:"invite_code"`
	Status            string     `db:"status" json:"status"`
	InvitedBy         *string    `db:"invited_by" json:"invited_by"`
	AcceptedBy        *string    `db:"accepted_by" json:"accepted_by"`
	ExpiresAt         time.Time  `db:"expires_at" json:"expires_at"`
	CreatedAt         time.Time  `db:"created_at" json:"created_at"`
	AcceptedAt        *time.Time `db:"accepted_at" json:"accepted_at,omitempty"`
	// Populated via JOIN with tenants table
	TenantName        *string `db:"tenant_name" json:"tenant_name"`
	TenantDisplayName *string `db:"tenant_display_name" json:"tenant_display_name"`
}

// QuotaAlert represents a quota usage alert for a tenant.
type QuotaAlert struct {
	ID               string     `db:"id" json:"id"`
	TenantID         string     `db:"tenant_id" json:"tenant_id"`
	ResourceType     string     `db:"resource_type" json:"resource_type"`
	ThresholdPercent float64    `db:"threshold_percent" json:"threshold_percent"`
	CurrentUsage     float64    `db:"current_usage" json:"current_usage"`
	QuotaLimit       float64    `db:"quota_limit" json:"quota_limit"`
	NotifyStatus     string     `db:"notify_status" json:"notify_status"`
	CooldownUntil    *time.Time `db:"cooldown_until" json:"cooldown_until,omitempty"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
}

// TenantNamespace represents a K8s namespace allocation for a tenant.
type TenantNamespace struct {
	ID            string            `db:"id" json:"id"`
	NamespaceName string            `db:"namespace_name" json:"namespace_name"`
	ClusterID     string            `db:"cluster_id" json:"cluster_id"`
	TenantID      *string           `db:"tenant_id" json:"tenant_id"`
	Status        string            `db:"status" json:"status"` // available|allocated|reserved
	Purpose       *string           `db:"purpose" json:"purpose"`
	Labels        map[string]string `db:"labels" json:"labels"`
	AllocatedAt   *time.Time        `db:"allocated_at" json:"allocated_at,omitempty"`
	CreatedAt     time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time         `db:"updated_at" json:"updated_at"`
}

// QuotaConfig holds quota limits for a tenant.
type QuotaConfig struct {
	ID                        string            `db:"id" json:"id"`
	TenantID                  string            `db:"tenant_id" json:"tenant_id"`
	MaxPipelines              int               `db:"max_pipelines" json:"max_pipelines"`
	MaxPipelineRunsPerDay     int               `db:"max_pipeline_runs_per_day" json:"max_pipeline_runs_per_day"`
	MaxConcurrentBuilds       int               `db:"max_concurrent_builds" json:"max_concurrent_builds"`
	MaxTasksPerPipeline       int               `db:"max_tasks_per_pipeline" json:"max_tasks_per_pipeline"`
	MaxRunners                int               `db:"max_runners" json:"max_runners"`
	MaxCpuCores               int               `db:"max_cpu_cores" json:"max_cpu_cores"`
	MaxMemoryGb               int               `db:"max_memory_gb" json:"max_memory_gb"`
	MaxStorageMb              int               `db:"max_storage_mb" json:"max_storage_mb"`
	MaxProjects               int               `db:"max_projects" json:"max_projects"`
	MaxUsers                  int               `db:"max_users" json:"max_users"`
	ApiRateLimit              int               `db:"api_rate_limit" json:"api_rate_limit"`
	ApiRateLimitWindowSeconds int               `db:"api_rate_limit_window_seconds" json:"api_rate_limit_window_seconds"`
	Usage                     map[string]any    `db:"usage" json:"usage"`
	CreatedAt                 time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt                 time.Time         `db:"updated_at" json:"updated_at"`
}

// RLSPolicy represents a PostgreSQL Row Level Security policy entry.
type RLSPolicy struct {
	ID              string `db:"id" json:"id"`
	TableName       string `db:"table_name" json:"table_name"`
	PolicyName      string `db:"policy_name" json:"policy_name"`
	SessionVariable string `db:"session_variable" json:"session_variable"`
	Enabled         bool   `db:"enabled" json:"enabled"`
}
