package models

import "time"

// Tenant represents a multi-tenant workspace.
type Tenant struct {
	ID          int            `json:"id" db:"id"`
	Name        string         `json:"name" db:"name"`
	DisplayName *string        `json:"display_name" db:"display_name"`
	Status      string         `json:"status" db:"status"` // active, inactive, suspended
	Settings    map[string]any `json:"settings" db:"settings"`
	CreatedAt   time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at" db:"updated_at"`
}

// TenantUser represents a user-role mapping within a tenant.
type TenantUser struct {
	TenantID  int       `json:"tenant_id" db:"tenant_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Role      string    `json:"role" db:"role"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// TenantInvite represents a pending invitation to join a tenant.
type TenantInvite struct {
	ID        int       `json:"id" db:"id"`
	TenantID  int       `json:"tenant_id" db:"tenant_id"`
	Email     string    `json:"email" db:"email"`
	Role      string    `json:"role" db:"role"`
	InviteCode string   `json:"invite_code" db:"invite_code"`
	Status    string    `json:"status" db:"status"` // pending, accepted, expired, revoked
	InvitedBy string    `json:"invited_by" db:"invited_by"`
	ExpiresAt time.Time `json:"expires_at" db:"expires_at"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// NamespaceAllocation represents a namespace allocated to a tenant.
type NamespaceAllocation struct {
	ID            int       `json:"id" db:"id"`
	NamespaceName string    `json:"namespace_name" db:"namespace_name"`
	TenantID      int       `json:"tenant_id" db:"tenant_id"`
	Status        string    `json:"status" db:"status"` // allocated, released
	Purpose       string    `json:"purpose" db:"purpose"`
	RunnerCount   int       `json:"runner_count" db:"runner_count"`
	AllocatedAt   time.Time `json:"allocated_at" db:"allocated_at"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// TenantQuota represents resource quotas for a tenant.
type TenantQuota struct {
	TenantID                 int `json:"tenant_id"`
	MaxPipelines             int `json:"max_pipelines"`
	MaxPipelineRunsPerDay    int `json:"max_pipeline_runs_per_day"`
	MaxConcurrentRuns        int `json:"max_concurrent_runs"`
	MaxTasksPerPipeline      int `json:"max_tasks_per_pipeline"`
	MaxRunners               int `json:"max_runners"`
	MaxCpuCores              int `json:"max_cpu_cores"`
	MaxMemoryGb              int `json:"max_memory_gb"`
	MaxStorageGb             int `json:"max_storage_gb"`
	MaxNamespaces            int `json:"max_namespaces"`
	ApiRateLimit             int `json:"api_rate_limit"`
	ApiRateLimitWindowSeconds int `json:"api_rate_limit_window_seconds"`
}

// QuotaCheckResult indicates whether a quota check passed.
type QuotaCheckResult struct {
	Allowed bool   `json:"allowed"`
	Message string `json:"message"`
}

// NamespacePoolStatus shows the overall namespace pool state.
type NamespacePoolStatus struct {
	Total      int `json:"total"`
	Allocated  int `json:"allocated"`
	Available  int `json:"available"`
}

// NamespaceUsageDetail provides per-namespace usage breakdown.
type NamespaceUsageDetail struct {
	ID            int    `json:"id"`
	NamespaceName string `json:"namespaceName"`
	Status        string `json:"status"`
	AllocatedAt   string `json:"allocatedAt"`
	PipelineCount int    `json:"pipelineCount"`
	ActiveRuns    int    `json:"activeRuns"`
	RunnerCount   int    `json:"runnerCount"`
	CpuUsed       int    `json:"cpuUsed"`
	MemoryUsed    int    `json:"memoryUsed"`
}

// NamespaceUsageTotals aggregates usage across all namespaces.
type NamespaceUsageTotals struct {
	TotalNamespaces int `json:"totalNamespaces"`
	TotalPipelines  int `json:"totalPipelines"`
	TotalActiveRuns int `json:"totalActiveRuns"`
	TotalRunners    int `json:"totalRunners"`
}

// MiddlewareConfig holds tenant middleware settings.
type MiddlewareConfig struct {
	Enabled       bool   `json:"enabled"`
	HeaderName    string `json:"headerName"`
	JwtTenantClaim string `json:"jwtTenantClaim"`
}

// TenantQuotaAlert records a quota threshold breach notification.
type TenantQuotaAlert struct {
	ID               int    `json:"id"`
	TenantID         string `json:"tenantId"`
	ResourceType     string `json:"resourceType"`
	ThresholdPercent int    `json:"thresholdPercent"`
	CurrentUsage     int    `json:"currentUsage"`
	QuotaLimit       int    `json:"quotaLimit"`
	UsagePercent     int    `json:"usagePercent"`
	NotifyStatus     string `json:"notifyStatus"`
	CooldownUntil    string `json:"cooldownUntil"`
	CreatedAt        string `json:"createdAt"`
}

// --- Request bodies ---

// CreateTenantRequest is the body for POST /tenant.
type CreateTenantRequest struct {
	Name                 string            `json:"name" binding:"required"`
	DisplayName          *string           `json:"display_name"`
	Settings             map[string]any    `json:"settings"`
	AutoAllocateNamespace bool             `json:"autoAllocateNamespace"`
	InitialNamespaceCount int              `json:"initialNamespaceCount"`
	CustomQuota          *CustomQuotaBody  `json:"customQuota"`
}

// CustomQuotaBody embeds quota fields for tenant creation.
type CustomQuotaBody struct {
	MaxPipelines          *int `json:"maxPipelines"`
	MaxPipelineRunsPerDay *int `json:"maxPipelineRunsPerDay"`
	MaxConcurrentRuns     *int `json:"maxConcurrentRuns"`
	MaxRunners            *int `json:"maxRunners"`
	MaxCpuCores           *int `json:"maxCpuCores"`
	MaxMemoryGb           *int `json:"maxMemoryGb"`
	MaxStorageGb          *int `json:"maxStorageGb"`
	MaxNamespaces         *int `json:"maxNamespaces"`
}

// UpdateTenantRequest is the body for PUT /tenant/:id.
type UpdateTenantRequest struct {
	Name        *string        `json:"name"`
	DisplayName *string        `json:"display_name"`
	Status      *string        `json:"status"`
	Settings    map[string]any `json:"settings"`
}

// ListTenantRequest holds query params for listing tenants.
type ListTenantRequest struct {
	Page   int    `json:"page" form:"page"`
	Limit  int    `json:"limit" form:"limit"`
	Status *string `json:"status" form:"status"`
}

// NamespaceAllocateRequest is the body for POST /namespace/allocate.
type NamespaceAllocateRequest struct {
	TenantID string `json:"tenantId" binding:"required"`
}

// NamespaceReleaseRequest is the body for POST /namespace/release.
type NamespaceReleaseRequest struct {
	NamespaceName string `json:"namespaceName" binding:"required"`
}

// QuotaUpdateRequest is the body for PUT /quota.
type QuotaUpdateRequest struct {
	MaxPipelines          *int `json:"maxPipelines"`
	MaxPipelineRunsPerDay *int `json:"maxPipelineRunsPerDay"`
	MaxConcurrentRuns     *int `json:"maxConcurrentRuns"`
	MaxStorageGb          *int `json:"maxStorageGb"`
	MaxNamespaces         *int `json:"maxNamespaces"`
}

// QuotaCheckRequest is the body for POST /quota/check.
type QuotaCheckRequest struct {
	ResourceType string `json:"resourceType" binding:"required"`
	Amount       int    `json:"amount"`
}

// SplitTenantRequest is the body for POST /:id/split.
type SplitTenantRequest struct {
	NewTenantName       string   `json:"newTenantName" binding:"required"`
	NewTenantDisplayName *string `json:"newTenantDisplayName"`
	MigrateUsers        []string `json:"migrateUsers"`
	MigrateNamespaces   []string `json:"migrateNamespaces"`
	SplitResources      *struct {
		Pipelines []string `json:"pipelines"`
	} `json:"splitResources"`
	KeepOriginalUsers bool `json:"keepOriginalUsers"`
}

// InviteRequest is the body for POST /:id/invite.
type InviteRequest struct {
	Email         string `json:"email" binding:"required"`
	Role          string `json:"role"`
	Message       string `json:"message"`
	ExpiresInDays int    `json:"expiresInDays"`
}

// InviteResponse carries the created invite details back to the client.
type InviteResponse struct {
	ID           int       `json:"id"`
	InviteCode   string    `json:"inviteCode"`
	Email        string    `json:"email"`
	Role         string    `json:"role"`
	Status       string    `json:"status"`
	ExpiresAt    time.Time `json:"expiresAt"`
	CreatedAt    time.Time `json:"createdAt"`
	TenantName   string    `json:"tenantName"`
	Message      string    `json:"message"`
}

// AlertsQuery holds query params for GET /alerts.
type AlertsQuery struct {
	Page         int    `json:"page" form:"page"`
	Limit        int    `json:"limit" form:"limit"`
	ResourceType *string `json:"resourceType" form:"resourceType"`
	Status       *string `json:"status" form:"status"`
}

// --- Response wrappers ---

// TenantWithMeta wraps a list of tenants with pagination metadata.
type TenantWithMeta struct {
	Data       []Tenant `json:"data"`
	Total      int      `json:"total"`
	Page       int      `json:"page"`
	Limit      int      `json:"limit"`
	TotalPages int      `json:"totalPages"`
}
