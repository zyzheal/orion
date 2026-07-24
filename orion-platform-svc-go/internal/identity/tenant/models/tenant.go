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

// TenantNamespace represents a K8s namespace allocation for a tenant.
type TenantNamespace struct {
	ID           string            `db:"id" json:"id"`
	NamespaceName string           `db:"namespace_name" json:"namespace_name"`
	ClusterID    string            `db:"cluster_id" json:"cluster_id"`
	TenantID     *int64            `db:"tenant_id" json:"tenant_id"`
	Status       string            `db:"status" json:"status"` // available|allocated|reserved
	Purpose      *string           `db:"purpose" json:"purpose"`
	Labels       map[string]string `db:"labels" json:"labels"`
	AllocatedAt  *time.Time        `db:"allocated_at" json:"allocated_at,omitempty"`
	CreatedAt    time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time         `db:"updated_at" json:"updated_at"`
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
	TableName    string `db:"table_name" json:"table_name"`
	PolicyName   string `db:"policy_name" json:"policy_name"`
	SessionVariable string `db:"session_variable" json:"session_variable"`
	Enabled      bool   `db:"enabled" json:"enabled"`
}
