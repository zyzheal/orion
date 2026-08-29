package service

import (
	"context"
	"fmt"
	"hash/fnv"
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
