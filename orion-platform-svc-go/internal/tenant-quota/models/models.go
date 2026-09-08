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

	// Phase 306 additions: soft/hard limit policy.
	//
	// SoftLimit: 触发 warning 的绝对阈值。usage >= SoftLimit 但 < HardLimit
	//   → 返回 warning，仍允许通过。若为 0 则默认使用 per-metric hard limit × 0.8。
	// HardLimit: 触发 blocking 的绝对阈值。usage >= HardLimit → 依据 OverLimitAction
	//   决策 (block|warn|allow)。若为 0 则退回 per-metric limit。
	// OverLimitAction: 越过 HardLimit 时的策略。
	//   "block"  = 拒绝操作，返回 Blocking=true
	//   "warn"   = 允许但返回 Blocking=false, Warning 说明已超配
	//   "allow"  = 允许且不再发 warning（等价于忽略 hard limit）
	// WarnThresholds: 分档 warning 百分比（相对 HardLimit）。默认 [50, 80, 95]。
	SoftLimit       int64    `db:"soft_limit" json:"softLimit"`
	HardLimit       int64    `db:"hard_limit" json:"hardLimit"`
	OverLimitAction string   `db:"over_limit_action" json:"overLimitAction"`
	WarnThresholds  []int    `db:"-" json:"warnThresholds"` // stored as JSON string in migration
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
	Name                string  `json:"name" binding:"required"`
	Description         string  `json:"description"`
	APIRateLimitPerMin  int     `json:"apiRateLimitPerMin"`
	APIRateLimitPerHour int     `json:"apiRateLimitPerHour"`
	MaxCIs              int     `json:"maxCIs"`
	MaxUsers            int     `json:"maxUsers"`
	MaxStorageMB        int64   `json:"maxStorageMB"`
	MaxPipelines        int     `json:"maxPipelines"`
	MaxConcurrentJobs   int     `json:"maxConcurrentJobs"`
	MaxAlertsPerDay     int     `json:"maxAlertsPerDay"`
	SLATier             string  `json:"slaTier"`

	// Phase 306 additions
	SoftLimit       int64 `json:"softLimit"`
	HardLimit       int64 `json:"hardLimit"`
	OverLimitAction string  `json:"overLimitAction"` // block|warn|allow, default "block"
	WarnThresholds  []int   `json:"warnThresholds"`  // e.g. [50, 80, 95], default when nil
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

	// Phase 306 additions
	SoftLimit       *int64 `json:"softLimit"`
	HardLimit       *int64 `json:"hardLimit"`
	OverLimitAction *string `json:"overLimitAction"`
	WarnThresholds  []int   `json:"warnThresholds"`
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

// --- Phase 306: policy-aware check types ---

// CheckWithPolicyRequest is the request body for POST /tenant-quota/check-with-policy.
type CheckWithPolicyRequest struct {
	// Metric drives the per-metric limit lookup. Optional PlanID restricts
	// the check to a specific plan; when empty, the tenant's first plan is used.
	Metric string `json:"metric" binding:"required"`
	Amount int64  `json:"amount"` // defaults to 1 when 0
	PlanID string `json:"planId"`
}

// CheckWithPolicyResult extends QuotaCheckResult with soft/hard policy fields.
//
// Decision tree (see service.CheckQuotaWithPolicy):
//
//	if projected < SoftLimit                          → Allowed=true, Blocking=false, Warning=nil
//	else if SoftLimit <= projected < HardLimit         → Allowed=true, Blocking=false, Warning=[soft-threshold-msg]
//	else if projected >= HardLimit:
//	    OverLimitAction == "block" → Allowed=false, Blocking=true
//	    OverLimitAction == "warn"  → Allowed=true,  Blocking=false, Warning=[over-hard-warn]
//	    OverLimitAction == "allow" → Allowed=true,  Blocking=false, Warning=nil
//
// WarningThresholdsHit is populated for every WarnThresholds percentage crossed
// by `projected / HardLimit * 100` (in ascending order).
type CheckWithPolicyResult struct {
	Metric             string   `json:"metric"`
	CurrentValue       int64    `json:"currentValue"`
	ProjectedValue     int64    `json:"projectedValue"`
	SoftLimit          int64    `json:"softLimit"`
	HardLimit          int64    `json:"hardLimit"`
	UsagePct           float64  `json:"usagePct"`
	Allowed            bool     `json:"allowed"`
	Blocking           bool     `json:"blocking"`
	OverLimitAction    string   `json:"overLimitAction"`
	WarnThresholds     []int    `json:"warnThresholds"`
	WarnThresholdsHit  []int    `json:"warnThresholdsHit"`
	Warning            []string `json:"warning"`
	PlanID             string   `json:"planId"`
}
