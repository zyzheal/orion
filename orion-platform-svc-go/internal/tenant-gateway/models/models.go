package models

// --- Enums ---

// TenantTier represents the billing tier of a tenant.
type TenantTier string

const (
	TierFree       TenantTier = "free"
	TierBasic      TenantTier = "basic"
	TierStandard   TenantTier = "standard"
	TierPremium    TenantTier = "premium"
	TierPro        TenantTier = "pro"
	TierEnterprise TenantTier = "enterprise"
)

// TenantStatus represents the operational status of a tenant.
type TenantStatus string

const (
	StatusActive    TenantStatus = "active"
	StatusSuspended TenantStatus = "suspended"
	StatusDeleted   TenantStatus = "deleted"
)

// --- Core domain model ---

// Tenant is the managed tenant entity stored in PostgreSQL.
type Tenant struct {
	ID              string       `json:"id" db:"id"`
	Name            string       `json:"name" db:"name"`
	DisplayName     string       `json:"display_name" db:"display_name"`
	TenantTier      TenantTier   `json:"tier" db:"tier"`
	Status          TenantStatus `json:"status" db:"status"`
	NamespacePoolID string       `json:"namespace_pool_id" db:"namespace_pool_id"`
	OwnerEmail      string       `json:"owner_email" db:"owner_email"`
	BusinessUnit    string       `json:"business_unit" db:"business_unit"`
	CostCenter      string       `json:"cost_center" db:"cost_center"`
	TenantID        string       `json:"tenant_id" db:"tenant_id"` // isolation key
	CreatedAt       *int64       `json:"created_at" db:"created_at"`
	UpdatedAt       *int64       `json:"updated_at" db:"updated_at"`
	ExpiresAt       *int64       `json:"expires_at" db:"expires_at"`
}

// --- Request/Response models ---

// CreateTenantRequest is the body for POST /tenants.
type CreateTenantRequest struct {
	Name         string     `json:"name" binding:"required"`
	DisplayName  string     `json:"display_name"`
	Tier         TenantTier `json:"tier"`
	OwnerEmail   string     `json:"owner_email"`
	BusinessUnit string     `json:"business_unit"`
	CostCenter   string     `json:"cost_center"`
	ExpiresAt    *int64     `json:"expires_at"`
}

// UpdateTenantRequest is the body for PUT /tenants/:id.
type UpdateTenantRequest struct {
	Name         *string       `json:"name"`
	DisplayName  *string       `json:"display_name"`
	Tier         *TenantTier   `json:"tier"`
	Status       *TenantStatus `json:"status"`
	OwnerEmail   *string       `json:"owner_email"`
	BusinessUnit *string       `json:"business_unit"`
	CostCenter   *string       `json:"cost_center"`
	ExpiresAt    *int64        `json:"expires_at"`
}

// QuotaChanges represents the adjustable quota fields.
type QuotaChanges struct {
	CPULimit          *int `json:"cpu_limit"`
	MemoryLimit       *int `json:"memory_limit"`
	ConcurrentRunners *int `json:"concurrent_runners"`
	QueueDepth        *int `json:"queue_depth"`
	DailyTokenQuota   *int `json:"daily_token_quota"`
	APIQps            *int `json:"api_qps"`
	// Extended quota fields for platform-level limits.
	RequestsPerMinute *int `json:"requests_per_minute"`
	MaxStorageGB      *int `json:"max_storage_gb"`
	MaxAgents         *int `json:"max_agents"`
	MaxDeployments    *int `json:"max_deployments"`
}

// QuotaAdjustmentRequest is the body for POST /tenants/:id/quota.
type QuotaAdjustmentRequest struct {
	AdjustmentType string       `json:"adjustmentType" binding:"required"` // permanent | temporary
	Changes        QuotaChanges `json:"changes"`
	Reason         string       `json:"reason" binding:"required"`
	EffectiveDate  *int64       `json:"effectiveDate"`
}

// TenantQuota represents default quotas per tier.
type TenantQuota struct {
	CPURequest        int `json:"cpuRequest" db:"cpu_request"`
	CPULimit          int `json:"cpuLimit" db:"cpu_limit"`
	MemoryRequest     int `json:"memoryRequest" db:"memory_request"`
	MemoryLimit       int `json:"memoryLimit" db:"memory_limit"`
	Storage           int `json:"storage" db:"storage"`
	ConcurrentRunners int `json:"concurrentRunners" db:"concurrent_runners"`
	QueueDepth        int `json:"queueDepth" db:"queue_depth"`
	DailyTokenQuota   int `json:"dailyTokenQuota" db:"daily_token_quota"`
	APIQps            int `json:"apiQps" db:"api_qps"`
	DailyHoursQuota   int `json:"dailyHoursQuota" db:"daily_hours_quota"`
	// Extended quota fields for platform-level limits.
	RequestsPerMinute int `json:"requestsPerMinute" db:"requests_per_minute"`
	MaxStorageGB      int `json:"maxStorageGb" db:"max_storage_gb"`
	MaxAgents         int `json:"maxAgents" db:"max_agents"`
	MaxDeployments    int `json:"maxDeployments" db:"max_deployments"`
}

// ListQuery is the filter/pagination model for GET /tenants.
type ListQuery struct {
	Status          *TenantStatus `json:"status"`
	Tier            *TenantTier   `json:"tier"`
	NamespacePoolID *string       `json:"namespace_pool_id"`
	Limit           int           `json:"limit"`
	Offset          int           `json:"offset"`
}

// TenantListResponse wraps a paginated list.
type TenantListResponse struct {
	Tenants []Tenant `json:"tenants"`
	Total   int      `json:"total"`
}

// QuotaStatusResponse is the result for GET /tenants/:id/quota.
type QuotaStatusResponse struct {
	TenantID string      `json:"tenantId"`
	Tier     TenantTier  `json:"tier"`
	Quota    TenantQuota `json:"quota"`
	Usage    string      `json:"usage"`  // JSONB stored, returned as string
	Alerts   string      `json:"alerts"` // JSONB stored, returned as string
}

// MaxInt is the largest positive int, treated as "unlimited" for Enterprise.
const MaxInt = int(^uint(0) >> 1)

// DefaultQuotas returns the built-in quota defaults per tier.
func DefaultQuotas() map[TenantTier]TenantQuota {
	return map[TenantTier]TenantQuota{
		TierFree: {
			CPURequest:        100,
			CPULimit:          200,
			MemoryRequest:     128,
			MemoryLimit:       256,
			Storage:           1,
			ConcurrentRunners: 2,
			QueueDepth:        20,
			DailyTokenQuota:   10000,
			APIQps:            10,
			DailyHoursQuota:   10,
			RequestsPerMinute: 100,
			MaxStorageGB:      1,
			MaxAgents:         1,
			MaxDeployments:    5,
		},
		TierBasic: {
			CPURequest:        200,
			CPULimit:          400,
			MemoryRequest:     256,
			MemoryLimit:       512,
			Storage:           5,
			ConcurrentRunners: 3,
			QueueDepth:        50,
			DailyTokenQuota:   50000,
			APIQps:            50,
			DailyHoursQuota:   50,
			RequestsPerMinute: 1000,
			MaxStorageGB:      10,
			MaxAgents:         5,
			MaxDeployments:    50,
		},
		TierStandard: {
			CPURequest:        500,
			CPULimit:          1000,
			MemoryRequest:     512,
			MemoryLimit:       1024,
			Storage:           10,
			ConcurrentRunners: 5,
			QueueDepth:        100,
			DailyTokenQuota:   100000,
			APIQps:            100,
			DailyHoursQuota:   100,
			RequestsPerMinute: 1000,
			MaxStorageGB:      10,
			MaxAgents:         5,
			MaxDeployments:    50,
		},
		TierPremium: {
			CPURequest:        2000,
			CPULimit:          4000,
			MemoryRequest:     2048,
			MemoryLimit:       8192,
			Storage:           100,
			ConcurrentRunners: 50,
			QueueDepth:        1000,
			DailyTokenQuota:   1000000,
			APIQps:            1000,
			DailyHoursQuota:   1000,
			RequestsPerMinute: 10000,
			MaxStorageGB:      100,
			MaxAgents:         20,
			MaxDeployments:    500,
		},
		TierPro: {
			CPURequest:        4000,
			CPULimit:          8000,
			MemoryRequest:     4096,
			MemoryLimit:       16384,
			Storage:           500,
			ConcurrentRunners: 100,
			QueueDepth:        5000,
			DailyTokenQuota:   5000000,
			APIQps:            5000,
			DailyHoursQuota:   5000,
			RequestsPerMinute: 10000,
			MaxStorageGB:      100,
			MaxAgents:         20,
			MaxDeployments:    500,
		},
		TierEnterprise: {
			CPURequest:        MaxInt,
			CPULimit:          MaxInt,
			MemoryRequest:     MaxInt,
			MemoryLimit:       MaxInt,
			Storage:           MaxInt,
			ConcurrentRunners: MaxInt,
			QueueDepth:        MaxInt,
			DailyTokenQuota:   MaxInt,
			APIQps:            MaxInt,
			DailyHoursQuota:   MaxInt,
			RequestsPerMinute: MaxInt,
			MaxStorageGB:      MaxInt,
			MaxAgents:         MaxInt,
			MaxDeployments:    MaxInt,
		},
	}
}
