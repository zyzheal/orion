package models

import "time"

// --- Quota Plan ---

type QuotaPlan struct {
	ID                  string    `db:"id" json:"id"`
	TenantID            string    `db:"tenant_id" json:"tenantId"`
	Name                string    `db:"name" json:"name"`
	Description         string    `db:"description" json:"description"`
	Status              string    `db:"status" json:"status"`
	APIRateLimitPerMin  int       `db:"api_rate_limit_per_min" json:"apiRateLimitPerMin"`
	APIRateLimitPerHour int       `db:"api_rate_limit_per_hour" json:"apiRateLimitPerHour"`
	MaxCIs              int       `db:"max_cis" json:"maxCIs"`
	MaxUsers            int       `db:"max_users" json:"maxUsers"`
	MaxStorageMB        int64     `db:"max_storages_mb" json:"maxStorageMB"`
	MaxPipelines        int       `db:"max_pipelines" json:"maxPipelines"`
	MaxConcurrentJobs   int       `db:"max_concurrent_jobs" json:"maxConcurrentJobs"`
	MaxAlertsPerDay     int       `db:"max_alerts_per_day" json:"maxAlertsPerDay"`
	SLATier             string    `db:"sla_tier" json:"slaTier"`
	CreatedAt           time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt           time.Time `db:"updated_at" json:"updatedAt"`
}

// --- Quota Usage ---

type QuotaUsage struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenantId"`
	Metric       string    `db:"metric" json:"metric"`
	CurrentValue int64     `db:"current_value" json:"currentValue"`
	PeakValue    int64     `db:"peak_value" json:"peakValue"`
	WindowStart  time.Time `db:"window_start" json:"windowStart"`
	WindowEnd    time.Time `db:"window_end" json:"windowEnd"`
	ResetAt      time.Time `db:"reset_at" json:"resetAt"`
	UpdatedAt    time.Time `db:"updated_at" json:"updatedAt"`
}

type QuotaUsageWithLimit struct {
	QuotaUsage
	Limit     int64   `json:"limit"`
	UsagePct  float64 `json:"usagePct"`
	Remaining int64   `json:"remaining"`
	Status    string  `json:"status"`
}

// --- Quota Alert ---

type QuotaAlert struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenantId"`
	Metric       string    `db:"metric" json:"metric"`
	CurrentValue int64     `db:"current_value" json:"currentValue"`
	LimitValue   int64     `db:"limit_value" json:"limitValue"`
	UsagePct     float64   `db:"usage_pct" json:"usagePct"`
	AlertLevel   string    `db:"alert_level" json:"alertLevel"`
	NotifiedAt   time.Time `db:"notified_at" json:"notifiedAt"`
}

// --- Request/Response types ---

type CreatePlanRequest struct {
	Name                string `json:"name" binding:"required"`
	Description         string `json:"description"`
	APIRateLimitPerMin  int    `json:"apiRateLimitPerMin"`
	APIRateLimitPerHour int    `json:"apiRateLimitPerHour"`
	MaxCIs              int    `json:"maxCIs"`
	MaxUsers            int    `json:"maxUsers"`
	MaxStorageMB        int64  `json:"maxStorageMB"`
	MaxPipelines        int    `json:"maxPipelines"`
	MaxConcurrentJobs   int    `json:"maxConcurrentJobs"`
	MaxAlertsPerDay     int    `json:"maxAlertsPerDay"`
	SLATier             string `json:"slaTier"`
}

type UpdatePlanRequest struct {
	Name                *string `json:"name"`
	Description         *string `json:"description"`
	Status              *string `json:"status"`
	APIRateLimitPerMin  *int    `json:"apiRateLimitPerMin"`
	APIRateLimitPerHour *int    `json:"apiRateLimitPerHour"`
	MaxCIs              *int    `json:"maxCIs"`
	MaxUsers            *int    `json:"maxUsers"`
	MaxStorageMB        *int64  `json:"maxStorageMB"`
	MaxPipelines        *int    `json:"maxPipelines"`
	MaxConcurrentJobs   *int    `json:"maxConcurrentJobs"`
	MaxAlertsPerDay     *int    `json:"maxAlertsPerDay"`
	SLATier             *string `json:"slaTier"`
}

type IncrementUsageRequest struct {
	Metric string `json:"metric" binding:"required"`
	Amount int64  `json:"amount" binding:"required"`
	Window string `json:"window"`
}

type QuotaCheckResult struct {
	Metric       string  `json:"metric"`
	CurrentValue int64   `json:"currentValue"`
	Limit        int64   `json:"limit"`
	Remaining    int64   `json:"remaining"`
	UsagePct     float64 `json:"usagePct"`
	Allowed      bool    `json:"allowed"`
	Exceeded     bool    `json:"exceeded"`
}
