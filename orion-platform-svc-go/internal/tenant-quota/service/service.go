package service

import (
	"context"
	"fmt"
	"hash/fnv"
	"sort"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/tenant-quota/models"
)

type RepositoryInterface interface {
	CreatePlan(ctx context.Context, p *models.QuotaPlan) error
	GetPlan(ctx context.Context, id, tenantID string) (*models.QuotaPlan, error)
	ListPlans(ctx context.Context, tenantID string) ([]models.QuotaPlan, error)
	UpdatePlan(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.QuotaPlan, error)
	DeletePlan(ctx context.Context, id, tenantID string) (bool, error)

	GetUsage(ctx context.Context, tenantID, metric string) (*models.QuotaUsage, error)
	IncrementUsage(ctx context.Context, tenantID, metric string, amount int64, resetAt time.Time) (*models.QuotaUsage, error)
	ListUsage(ctx context.Context, tenantID string) ([]models.QuotaUsage, error)
	ResetUsage(ctx context.Context, tenantID string) error

	CreateAlert(ctx context.Context, a *models.QuotaAlert) error
	ListAlerts(ctx context.Context, tenantID string) ([]models.QuotaAlert, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- Plan CRUD ---

func (s *Service) CreatePlan(ctx context.Context, req *models.CreatePlanRequest, tenantID string) (*models.QuotaPlan, error) {
	p := &models.QuotaPlan{
		ID:                  generateID("qp"),
		TenantID:            tenantID,
		Name:                req.Name,
		Description:         req.Description,
		Status:              "active",
		APIRateLimitPerMin:  req.APIRateLimitPerMin,
		APIRateLimitPerHour: req.APIRateLimitPerHour,
		MaxCIs:              req.MaxCIs,
		MaxUsers:            req.MaxUsers,
		MaxStorageMB:        req.MaxStorageMB,
		MaxPipelines:        req.MaxPipelines,
		MaxConcurrentJobs:   req.MaxConcurrentJobs,
		MaxAlertsPerDay:     req.MaxAlertsPerDay,
		SLATier:             req.SLATier,
		SoftLimit:           req.SoftLimit,
		HardLimit:           req.HardLimit,
		OverLimitAction:     req.OverLimitAction,
		WarnThresholds:      req.WarnThresholds,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}
	applyDefaults(p)
	if err := s.repo.CreatePlan(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Service) GetPlan(ctx context.Context, id, tenantID string) (*models.QuotaPlan, error) {
	return s.repo.GetPlan(ctx, id, tenantID)
}

func (s *Service) ListPlans(ctx context.Context, tenantID string) ([]models.QuotaPlan, error) {
	plans, err := s.repo.ListPlans(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if plans == nil {
		return []models.QuotaPlan{}, nil
	}
	return plans, nil
}

func (s *Service) UpdatePlan(ctx context.Context, id, tenantID string, req *models.UpdatePlanRequest) (*models.QuotaPlan, error) {
	attrs := make(map[string]interface{})
	if req.Name != nil {
		attrs["name"] = *req.Name
	}
	if req.Description != nil {
		attrs["description"] = *req.Description
	}
	if req.Status != nil {
		attrs["status"] = *req.Status
	}
	if req.APIRateLimitPerMin != nil {
		attrs["api_rate_limit_per_min"] = *req.APIRateLimitPerMin
	}
	if req.APIRateLimitPerHour != nil {
		attrs["api_rate_limit_per_hour"] = *req.APIRateLimitPerHour
	}
	if req.MaxCIs != nil {
		attrs["max_cis"] = *req.MaxCIs
	}
	if req.MaxUsers != nil {
		attrs["max_users"] = *req.MaxUsers
	}
	if req.MaxStorageMB != nil {
		attrs["max_storages_mb"] = *req.MaxStorageMB
	}
	if req.MaxPipelines != nil {
		attrs["max_pipelines"] = *req.MaxPipelines
	}
	if req.MaxConcurrentJobs != nil {
		attrs["max_concurrent_jobs"] = *req.MaxConcurrentJobs
	}
	if req.MaxAlertsPerDay != nil {
		attrs["max_alerts_per_day"] = *req.MaxAlertsPerDay
	}
	if req.SLATier != nil {
		attrs["sla_tier"] = *req.SLATier
	}
	if req.SoftLimit != nil {
		attrs["soft_limit"] = *req.SoftLimit
	}
	if req.HardLimit != nil {
		attrs["hard_limit"] = *req.HardLimit
	}
	if req.OverLimitAction != nil {
		action := normalizeOverLimitAction(*req.OverLimitAction)
		attrs["over_limit_action"] = action
	}
	if req.WarnThresholds != nil {
		// Stored as comma-separated int string to keep the JSON schema simple.
		attrs["warn_thresholds"] = joinInts(req.WarnThresholds)
	}
	return s.repo.UpdatePlan(ctx, id, tenantID, attrs)
}

func (s *Service) DeletePlan(ctx context.Context, id, tenantID string) (bool, error) {
	return s.repo.DeletePlan(ctx, id, tenantID)
}

// --- Usage ---

func (s *Service) GetUsage(ctx context.Context, tenantID, metric string) (*models.QuotaUsage, error) {
	return s.repo.GetUsage(ctx, tenantID, metric)
}

func (s *Service) ListUsage(ctx context.Context, tenantID string) ([]models.QuotaUsageWithLimit, error) {
	usages, err := s.repo.ListUsage(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	plans, _ := s.ListPlans(ctx, tenantID)
	if len(plans) == 0 {
		return []models.QuotaUsageWithLimit{}, nil
	}
	plan := plans[0]

	var result []models.QuotaUsageWithLimit
	for _, u := range usages {
		limit := getLimitForMetric(&plan, u.Metric)
		pct := 0.0
		if limit > 0 {
			pct = float64(u.CurrentValue) / float64(limit) * 100
		}
		remaining := limit - u.CurrentValue
		if remaining < 0 {
			remaining = 0
		}
		status := "normal"
		if pct >= 90 {
			status = "critical"
		} else if pct >= 75 {
			status = "warning"
		}
		result = append(result, models.QuotaUsageWithLimit{
			QuotaUsage: u,
			Limit:      limit,
			UsagePct:   pct,
			Remaining:  remaining,
			Status:     status,
		})
	}
	return result, nil
}

func (s *Service) IncrementUsage(ctx context.Context, req *models.IncrementUsageRequest, tenantID string) (*models.QuotaUsageWithLimit, error) {
	window := req.Window
	if window == "" {
		window = "1m"
	}
	resetAt := parseWindow(window)

	updated, err := s.repo.IncrementUsage(ctx, tenantID, req.Metric, req.Amount, resetAt)
	if err != nil {
		return nil, err
	}

	plans, _ := s.ListPlans(ctx, tenantID)
	if len(plans) == 0 {
		return nil, fmt.Errorf("no quota plan found")
	}
	limit := getLimitForMetric(&plans[0], req.Metric)
	pct := 0.0
	if limit > 0 {
		pct = float64(updated.CurrentValue) / float64(limit) * 100
	}

	remaining := limit - updated.CurrentValue
	if remaining < 0 {
		remaining = 0
	}

	status := "normal"
	if pct >= 90 {
		status = "critical"
	} else if pct >= 75 {
		status = "warning"
	}

	// Create alert at 80% and 95%
	if pct >= 95 && pct < 100 {
		s.repo.CreateAlert(ctx, &models.QuotaAlert{
			ID:           generateID("qa"),
			TenantID:     tenantID,
			Metric:       req.Metric,
			CurrentValue: updated.CurrentValue,
			LimitValue:   limit,
			UsagePct:     pct,
			AlertLevel:   "critical",
			NotifiedAt:   time.Now(),
		})
	} else if pct >= 80 && pct < 95 {
		s.repo.CreateAlert(ctx, &models.QuotaAlert{
			ID:           generateID("qa"),
			TenantID:     tenantID,
			Metric:       req.Metric,
			CurrentValue: updated.CurrentValue,
			LimitValue:   limit,
			UsagePct:     pct,
			AlertLevel:   "warning",
			NotifiedAt:   time.Now(),
		})
	}

	return &models.QuotaUsageWithLimit{
		QuotaUsage: *updated,
		Limit:      limit,
		UsagePct:   pct,
		Remaining:  remaining,
		Status:     status,
	}, nil
}

func (s *Service) CheckQuota(ctx context.Context, tenantID, metric string, amount int64) (*models.QuotaCheckResult, error) {
	usage, err := s.repo.GetUsage(ctx, tenantID, metric)
	if err != nil {
		return nil, err
	}
	plans, _ := s.ListPlans(ctx, tenantID)
	if len(plans) == 0 {
		return nil, fmt.Errorf("no quota plan found")
	}
	limit := getLimitForMetric(&plans[0], metric)
	current := int64(0)
	if usage != nil {
		current = usage.CurrentValue
	}
	projected := current + amount
	pct := 0.0
	if limit > 0 {
		pct = float64(projected) / float64(limit) * 100
	}
	return &models.QuotaCheckResult{
		Metric:       metric,
		CurrentValue: current,
		Limit:        limit,
		Remaining:    limit - current,
		UsagePct:     pct,
		Allowed:      projected <= limit,
		Exceeded:     projected > limit,
	}, nil
}

// CheckQuotaWithPolicy is the Phase 306 policy-aware check.
//
// Resolution order for the effective hard limit:
//
//  1. plan.HardLimit > 0        → use it (explicit per-plan override)
//  2. plan metric limit > 0     → use it (existing per-metric limit)
//  3. plan.HardLimit == 0       → treat as "no cap"; always allow, no warning
//
// Soft limit resolution:
//
//  1. plan.SoftLimit > 0                       → use it
//  2. 0 < hard && plan.SoftLimit == 0          → hard * 0.8 (80% default)
//  3. hard == 0                                → soft = 0 (no soft)
//
// WarnThresholdsHit is populated for every threshold pct in WarnThresholds
// that is crossed by the projected usage percentage. Returned in ascending order.
func (s *Service) CheckQuotaWithPolicy(ctx context.Context, tenantID string, req *models.CheckWithPolicyRequest) (*models.CheckWithPolicyResult, error) {
	if req == nil || req.Metric == "" {
		return nil, fmt.Errorf("metric is required")
	}
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	amount := req.Amount
	if amount == 0 {
		amount = 1
	}

	plan, err := s.resolvePlan(ctx, tenantID, req.PlanID)
	if err != nil {
		return nil, err
	}
	usage, err := s.repo.GetUsage(ctx, tenantID, req.Metric)
	if err != nil {
		return nil, err
	}
	current := int64(0)
	if usage != nil {
		current = usage.CurrentValue
	}
	projected := current + amount

	metricLimit := getLimitForMetric(plan, req.Metric)
	hardLimit := resolveHardLimit(plan.HardLimit, metricLimit)
	softLimit := resolveSoftLimit(plan.SoftLimit, hardLimit)

	usagePct := 0.0
	if hardLimit > 0 {
		usagePct = float64(projected) / float64(hardLimit) * 100
	}

	result := &models.CheckWithPolicyResult{
		Metric:             req.Metric,
		CurrentValue:       current,
		ProjectedValue:     projected,
		SoftLimit:          softLimit,
		HardLimit:          hardLimit,
		UsagePct:           usagePct,
		OverLimitAction:    plan.OverLimitAction,
		WarnThresholds:     plan.WarnThresholds,
		WarnThresholdsHit:  computeThresholdHits(plan.WarnThresholds, projected, hardLimit),
		PlanID:             plan.ID,
		Allowed:            true,
		Blocking:           false,
		Warning:            make([]string, 0),
	}

	// Hard-cap decision.
	switch {
	case hardLimit <= 0:
		// No cap at all — allow and stop.
	case projected >= hardLimit:
		switch plan.OverLimitAction {
		case "block":
			result.Allowed = false
			result.Blocking = true
			result.Warning = append(result.Warning, fmt.Sprintf("over hard limit: projected=%d hard=%d", projected, hardLimit))
		case "warn":
			result.Warning = append(result.Warning, fmt.Sprintf("over hard limit (warn): projected=%d hard=%d", projected, hardLimit))
		case "allow":
			// Silent pass — caller opted into ignore-hard.
		}
	case softLimit > 0 && projected >= softLimit:
		result.Warning = append(result.Warning, fmt.Sprintf("over soft limit: projected=%d soft=%d hard=%d", projected, softLimit, hardLimit))
	default:
		// Below soft — quiet.
	}

	return result, nil
}

// resolvePlan picks the plan to apply.
// Priority: explicit planID → first plan for tenant.
func (s *Service) resolvePlan(ctx context.Context, tenantID, planID string) (*models.QuotaPlan, error) {
	if planID != "" {
		p, err := s.repo.GetPlan(ctx, planID, tenantID)
		if err != nil {
			return nil, err
		}
		if p == nil {
			return nil, fmt.Errorf("plan %q not found for tenant %q", planID, tenantID)
		}
		return p, nil
	}
	plans, err := s.repo.ListPlans(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if len(plans) == 0 {
		return nil, fmt.Errorf("no quota plan found")
	}
	p := plans[0]
	return &p, nil
}

// resolveHardLimit returns the effective hard cap for a check.
// Prefers explicit plan.HardLimit over per-metric limit.
func resolveHardLimit(planHard, metricLimit int64) int64 {
	if planHard > 0 {
		return planHard
	}
	if metricLimit > 0 {
		return metricLimit
	}
	return 0
}

// resolveSoftLimit returns the effective soft threshold.
// Default: 80% of hard when soft is not configured.
func resolveSoftLimit(planSoft, hard int64) int64 {
	if planSoft > 0 {
		return planSoft
	}
	if hard <= 0 {
		return 0
	}
	return hard * 4 / 5 // 80% via integer math to avoid float drift
}

// computeThresholdHits returns every threshold percentage in `thresholds`
// that the projected/hard ratio crosses. Empty when hard <= 0.
func computeThresholdHits(thresholds []int, projected, hard int64) []int {
	if len(thresholds) == 0 || hard <= 0 {
		return nil
	}
	pct := float64(projected) / float64(hard) * 100
	hits := make([]int, 0, len(thresholds))
	for _, t := range thresholds {
		if pct >= float64(t) {
			hits = append(hits, t)
		}
	}
	return hits
}

func (s *Service) ResetUsage(ctx context.Context, tenantID string) error {
	return s.repo.ResetUsage(ctx, tenantID)
}

func (s *Service) ListAlerts(ctx context.Context, tenantID string) ([]models.QuotaAlert, error) {
	alerts, err := s.repo.ListAlerts(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if alerts == nil {
		return []models.QuotaAlert{}, nil
	}
	return alerts, nil
}

// ListAlertsByLevel returns alerts matching a level ("warning" | "critical").
// Empty string level = no filter (equivalent to ListAlerts). Matching is
// case-insensitive with surrounding whitespace trimmed. Unknown levels return
// an empty slice (not an error), so a mistyped query param simply produces an
// empty table rather than blowing up the dashboard.
func (s *Service) ListAlertsByLevel(ctx context.Context, tenantID, level string) ([]models.QuotaAlert, error) {
	all, err := s.ListAlerts(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if level == "" {
		return all, nil
	}
	want := strings.ToLower(strings.TrimSpace(level))
	out := make([]models.QuotaAlert, 0, len(all))
	for _, a := range all {
		if strings.ToLower(a.AlertLevel) == want {
			out = append(out, a)
		}
	}
	return out, nil
}

// --- Helpers ---

func applyDefaults(p *models.QuotaPlan) {
	if p.APIRateLimitPerMin == 0 {
		p.APIRateLimitPerMin = 1000
	}
	if p.APIRateLimitPerHour == 0 {
		p.APIRateLimitPerHour = 50000
	}
	if p.MaxCIs == 0 {
		p.MaxCIs = 10000
	}
	if p.MaxUsers == 0 {
		p.MaxUsers = 500
	}
	if p.MaxStorageMB == 0 {
		p.MaxStorageMB = 10240
	}
	if p.MaxPipelines == 0 {
		p.MaxPipelines = 100
	}
	if p.MaxConcurrentJobs == 0 {
		p.MaxConcurrentJobs = 20
	}
	if p.MaxAlertsPerDay == 0 {
		p.MaxAlertsPerDay = 10000
	}
	if p.SLATier == "" {
		p.SLATier = "standard"
	}
	// Phase 306 policy defaults
	if p.OverLimitAction == "" {
		p.OverLimitAction = "block"
	} else {
		p.OverLimitAction = normalizeOverLimitAction(p.OverLimitAction)
	}
	if len(p.WarnThresholds) == 0 {
		p.WarnThresholds = []int{50, 80, 95}
	} else {
		p.WarnThresholds = normalizeWarnThresholds(p.WarnThresholds)
	}
}

// normalizeOverLimitAction accepts block|warn|allow case-insensitively.
// Unknown values fall back to "block" (fail-closed for tenant quota).
func normalizeOverLimitAction(action string) string {
	switch strings.ToLower(strings.TrimSpace(action)) {
	case "block":
		return "block"
	case "warn":
		return "warn"
	case "allow":
		return "allow"
	default:
		return "block"
	}
}

// normalizeWarnThresholds sorts ascending, dedups, and clamps to [0, 100].
func normalizeWarnThresholds(in []int) []int {
	if len(in) == 0 {
		return nil
	}
	out := make([]int, 0, len(in))
	seen := make(map[int]struct{}, len(in))
	for _, v := range in {
		if v < 0 {
			v = 0
		}
		if v > 100 {
			v = 100
		}
		if _, dup := seen[v]; dup {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	sort.Ints(out)
	return out
}

func joinInts(in []int) string {
	parts := make([]string, 0, len(in))
	for _, v := range in {
		parts = append(parts, strconv.Itoa(v))
	}
	return strings.Join(parts, ",")
}

func parseThresholds(s string) []int {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]int, 0, len(parts))
	for _, p := range parts {
		v, err := strconv.Atoi(strings.TrimSpace(p))
		if err != nil {
			continue
		}
		out = append(out, v)
	}
	return normalizeWarnThresholds(out)
}

func getLimitForMetric(plan *models.QuotaPlan, metric string) int64 {
	switch metric {
	case "api_rate_per_min":
		return int64(plan.APIRateLimitPerMin)
	case "api_rate_per_hour":
		return int64(plan.APIRateLimitPerHour)
	case "cis":
		return int64(plan.MaxCIs)
	case "users":
		return int64(plan.MaxUsers)
	case "storage_mb":
		return plan.MaxStorageMB
	case "pipelines":
		return int64(plan.MaxPipelines)
	case "concurrent_jobs":
		return int64(plan.MaxConcurrentJobs)
	case "alerts_per_day":
		return int64(plan.MaxAlertsPerDay)
	default:
		return 0
	}
}

func parseWindow(window string) time.Time {
	switch window {
	case "1h", "hour":
		return time.Now().Add(time.Hour)
	case "24h", "day":
		return time.Now().Add(24 * time.Hour)
	default:
		return time.Now().Add(time.Minute)
	}
}

func generateID(prefix string) string {
	h := fnv.New64a()
	h.Write([]byte(prefix + "-" + time.Now().Format("20060102150405") + "-" + fmt.Sprintf("%d", time.Now().UnixNano()%100000)))
	return fmt.Sprintf("%s-%x", prefix, h.Sum(nil)[:8])
}
