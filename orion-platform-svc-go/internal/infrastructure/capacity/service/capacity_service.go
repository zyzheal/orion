package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"orion/platform-svc-go/internal/infrastructure/capacity/models"
	"orion/platform-svc-go/internal/infrastructure/capacity/repository"

	"github.com/google/uuid"
)

var (
	ErrPoolNotFound     = errors.New("resource pool not found")
	ErrPolicyNotFound   = errors.New("scaling policy not found")
	ErrForecastNotFound = errors.New("capacity forecast not found")
	ErrAlertNotFound    = errors.New("capacity alert not found")
	ErrReportNotFound   = errors.New("capacity report not found")
)

// Service orchestrates all capacity-planning business logic.
type Service struct {
	poolRepo     *repository.PoolRepository
	forecastRepo *repository.ForecastRepository
	policyRepo   *repository.PolicyRepository
	metricRepo   *repository.MetricRepository
	alertRepo    *repository.AlertRepository
	reportRepo   *repository.ReportRepository
}

func NewService(
	poolRepo *repository.PoolRepository,
	forecastRepo *repository.ForecastRepository,
	policyRepo *repository.PolicyRepository,
	metricRepo *repository.MetricRepository,
	alertRepo *repository.AlertRepository,
	reportRepo *repository.ReportRepository,
) *Service {
	return &Service{
		poolRepo:     poolRepo,
		forecastRepo: forecastRepo,
		policyRepo:   policyRepo,
		metricRepo:   metricRepo,
		alertRepo:    alertRepo,
		reportRepo:   reportRepo,
	}
}

func (s *Service) CreatePool(ctx context.Context, tenantID string, req *models.CreatePoolRequest) (*models.ResourcePool, error) {
	pool := &models.ResourcePool{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Name:         req.Name,
		ResourceType: req.ResourceType,
		TotalCPU:     req.TotalCPU,
		TotalMemory:  req.TotalMemory,
		NodeCount:    req.NodeCount,
		Labels:       req.Labels,
	}
	if err := s.poolRepo.Create(ctx, pool); err != nil { return nil, err }
	return pool, nil
}

func (s *Service) ListPools(ctx context.Context, tenantID string, offset, limit int) ([]models.ResourcePool, error) {
	return s.poolRepo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetPool(ctx context.Context, tenantID, id string) (*models.ResourcePool, error) {
	return s.poolRepo.GetByID(ctx, tenantID, id)
}

func (s *Service) UpdatePool(ctx context.Context, tenantID, id string, req *models.CreatePoolRequest) (*models.ResourcePool, error) {
	pool, err := s.poolRepo.GetByID(ctx, tenantID, id)
	if err != nil { return nil, ErrPoolNotFound }
	pool.Name = req.Name
	pool.ResourceType = req.ResourceType
	pool.TotalCPU = req.TotalCPU
	pool.TotalMemory = req.TotalMemory
	pool.NodeCount = req.NodeCount
	pool.Labels = req.Labels
	if err := s.poolRepo.Update(ctx, pool); err != nil { return nil, err }
	return pool, nil
}

func (s *Service) ListForecasts(ctx context.Context, tenantID string, offset, limit int) ([]models.CapacityForecast, error) {
	return s.forecastRepo.List(ctx, tenantID, offset, limit)
}

func (s *Service) CreatePolicy(ctx context.Context, tenantID string, req *models.CreatePolicyRequest) (*models.ScalingPolicy, error) {
	policy := &models.ScalingPolicy{
		ID:                 uuid.New().String(),
		TenantID:           tenantID,
		Name:               req.Name,
		ResourceType:       req.ResourceType,
		MinReplicas:        req.MinReplicas,
		MaxReplicas:        req.MaxReplicas,
		ScaleUpThreshold:   req.ScaleUpThreshold,
		ScaleDownThreshold: req.ScaleDownThreshold,
		CooldownSec:        req.CooldownSec,
		Enabled:            true,
	}
	if err := s.policyRepo.Create(ctx, policy); err != nil { return nil, err }
	return policy, nil
}

func (s *Service) ListPolicies(ctx context.Context, tenantID string) ([]models.ScalingPolicy, error) {
	return s.policyRepo.List(ctx, tenantID)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.poolRepo.Delete(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.poolRepo.Count(ctx, tenantID)
}

// ---------------------------------------------------------------------------
// Metric operations
// ---------------------------------------------------------------------------

// RecordMetric persists a new capacity metric, computing utilization automatically.
func (s *Service) RecordMetric(ctx context.Context, tenantID string, req *models.RecordMetricRequest) (*models.CapacityMetric, error) {
	var utilization float64
	if req.MaxValue > 0 {
		utilization = math.Round((req.CurrentValue/req.MaxValue)*10000) / 100
	}
	m := &models.CapacityMetric{
		ID:                 uuid.New().String(),
		TenantID:           tenantID,
		ResourceType:       req.ResourceType,
		ResourceID:         req.ResourceID,
		MetricName:         req.MetricName,
		CurrentValue:       req.CurrentValue,
		MaxValue:           req.MaxValue,
		Unit:               req.Unit,
		UtilizationPercent: utilization,
		RecordedAt:         time.Now().UTC(),
	}
	if err := s.metricRepo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

// ListMetrics returns metrics for a tenant, optionally filtered by resourceType and metricName.
func (s *Service) ListMetrics(ctx context.Context, tenantID string, f *models.MetricFilter) ([]models.CapacityMetric, error) {
	var rt, mn string
	if f != nil {
		rt = f.ResourceType
		mn = f.MetricName
	}
	return s.metricRepo.List(ctx, tenantID, rt, mn)
}

// ---------------------------------------------------------------------------
// Forecast generation
// ---------------------------------------------------------------------------

// GenerateForecast reads latest metrics, produces 30/90-day projections, persists
// forecasts, and emits alerts for high-utilisation metrics.  Returns the newly
// created forecasts.
func (s *Service) GenerateForecast(ctx context.Context, tenantID string) ([]models.CapacityForecast, error) {
	latest, err := s.metricRepo.GetLatest(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	var newForecasts []models.CapacityForecast

	for _, m := range latest {
		// Simple linear growth projection (matches Node.js implementation)
		growthRate := 0.05 + randFloat()*0.1 // 5-15% monthly growth
		forecast30 := math.Min(m.UtilizationPercent*(1+growthRate), 100)
		_ = forecast30 // used for reference; forecast90 drives persistence
		forecast90 := math.Min(m.UtilizationPercent*(1+growthRate*3), 100)

		daysUntilFull := 0
		recommendation := ""
		if forecast90 >= 90 {
			if growthRate*m.UtilizationPercent > 0 {
				daysUntilFull = int(math.Ceil((100 - m.UtilizationPercent) / (growthRate * m.UtilizationPercent / 30)))
			}
			if m.UtilizationPercent >= 80 {
				recommendation = "立即扩容：资源使用率已超过 80%，预计短期内耗尽"
			} else {
				recommendation = "计划扩容：资源使用率增长较快，建议提前规划扩容"
			}
		}

		f := models.CapacityForecast{
			ID:             uuid.New().String(),
			TenantID:       tenantID,
			ResourceType:   m.ResourceType,
			CurrentUsage:   m.UtilizationPercent,
			Predicted:      math.Round(forecast90*100) / 100,
			Threshold:      80,
			DaysUntilFull:  daysUntilFull,
			Recommendation: recommendation,
			ForecastDate:   now,
		}
		if err := s.forecastRepo.Create(ctx, &f); err != nil {
			return nil, err
		}
		newForecasts = append(newForecasts, f)

		// Generate alerts for high utilization (>=80%)
		if m.UtilizationPercent >= 80 {
			severity := "warning"
			threshold := 80.0
			if m.UtilizationPercent >= 90 {
				severity = "critical"
				threshold = 90.0
			}
			a := &models.CapacityAlert{
				ID:                 uuid.New().String(),
				TenantID:           tenantID,
				ResourceID:         m.ResourceID,
				ResourceType:       m.ResourceType,
				MetricName:         m.MetricName,
				CurrentUtilization: m.UtilizationPercent,
				Threshold:          threshold,
				Severity:           severity,
				Message:            m.ResourceID + " 的 " + m.MetricName + " 使用率达 " + fmt.Sprintf("%.1f", m.UtilizationPercent) + "%",
				CreatedAt:          now,
			}
			// Ignore duplicate-alert insert errors to keep forecast generation going.
			_ = s.alertRepo.Create(ctx, a)
		}
	}

	return newForecasts, nil
}

// ---------------------------------------------------------------------------
// Alert operations
// ---------------------------------------------------------------------------

// ListAlerts returns alerts, optionally filtered by severity.
func (s *Service) ListAlerts(ctx context.Context, tenantID string, f *models.AlertFilter) ([]models.CapacityAlert, error) {
	sev := ""
	if f != nil {
		sev = f.Severity
	}
	return s.alertRepo.List(ctx, tenantID, sev)
}

// DeleteAlert removes an alert by ID.
func (s *Service) DeleteAlert(ctx context.Context, id string) error {
	return s.alertRepo.Delete(ctx, id)
}

// ---------------------------------------------------------------------------
// Report operations
// ---------------------------------------------------------------------------

// GenerateReport aggregates current alerts and forecasts into a capacity report.
func (s *Service) GenerateReport(ctx context.Context, tenantID, title string) (*models.CapacityReport, error) {
	alertList, err := s.alertRepo.List(ctx, tenantID, "")
	if err != nil {
		return nil, err
	}
	forecastList, err := s.forecastRepo.List(ctx, tenantID, 0, 1000)
	if err != nil {
		return nil, err
	}

	criticalCount := 0
	warningCount := 0
	seen := make(map[string]bool)
	for _, a := range alertList {
		seen[a.ResourceID] = true
		switch a.Severity {
		case "critical":
			criticalCount++
		case "warning":
			warningCount++
		}
	}
	uniqueResources := len(seen)
	healthyCount := uniqueResources - criticalCount - warningCount
	if healthyCount < 0 {
		healthyCount = 0
	}
	overallScore := 100
	if uniqueResources > 0 {
		overallScore = int(math.Round(float64(healthyCount) / float64(uniqueResources) * 100))
	}

	// Convert alerts and forecasts into JSONB snapshots.
	alertsJSON := make(JSONBList, len(alertList))
	for i, a := range alertList {
		alertsJSON[i] = models.JSONB{
			"id":                 a.ID,
			"resource_id":        a.ResourceID,
			"resource_type":      a.ResourceType,
			"metric_name":        a.MetricName,
			"current_utilization": a.CurrentUtilization,
			"threshold":          a.Threshold,
			"severity":           a.Severity,
			"message":            a.Message,
			"created_at":         a.CreatedAt,
		}
	}
	forecastsJSON := make(JSONBList, len(forecastList))
	for i, f := range forecastList {
		forecastsJSON[i] = models.JSONB{
			"id":              f.ID,
			"resource_type":   f.ResourceType,
			"current_usage":   f.CurrentUsage,
			"predicted":       f.Predicted,
			"threshold":       f.Threshold,
			"days_until_full": f.DaysUntilFull,
			"recommendation":  f.Recommendation,
			"forecast_date":   f.ForecastDate,
		}
	}

	report := &models.CapacityReport{
		ID:               uuid.New().String(),
		TenantID:         tenantID,
		Title:            title,
		TotalResources:   uniqueResources,
		HealthyCount:     healthyCount,
		WarningCount:     warningCount,
		CriticalCount:    criticalCount,
		OverallScore:     overallScore,
		AlertsSnapshot:   models.JSONB{"alerts": alertsJSON},
		ForecastsSnapshot: models.JSONB{"forecasts": forecastsJSON},
		GeneratedAt:      time.Now().UTC(),
	}
	if err := s.reportRepo.Create(ctx, report); err != nil {
		return nil, err
	}
	return report, nil
}

// ListReports returns reports for a tenant with pagination.
func (s *Service) ListReports(ctx context.Context, tenantID string, offset, limit int) ([]models.CapacityReport, error) {
	return s.reportRepo.List(ctx, tenantID, offset, limit)
}

// GetReport returns a single report by ID.
func (s *Service) GetReport(ctx context.Context, tenantID, id string) (*models.CapacityReport, error) {
	return s.reportRepo.GetByID(ctx, tenantID, id)
}

// ---------------------------------------------------------------------------
// Bottleneck analysis
// ---------------------------------------------------------------------------

// AnalyzeBottlenecks inspects the latest metrics and identifies resources whose
// utilisation exceeds 50%, ranking them by severity.
func (s *Service) AnalyzeBottlenecks(ctx context.Context, tenantID string) ([]models.Bottleneck, error) {
	latest, err := s.metricRepo.GetLatest(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	var bottlenecks []models.Bottleneck
	for _, m := range latest {
		if m.UtilizationPercent < 50 {
			continue
		}

		impact := "low"
		if m.UtilizationPercent >= 80 {
			impact = "high"
		} else if m.UtilizationPercent >= 60 {
			impact = "medium"
		}

		recommendation := bottleneckRecommendation(m.MetricName, m.UtilizationPercent)

		bottlenecks = append(bottlenecks, models.Bottleneck{
			ResourceID:     m.ResourceID,
			ResourceType:   m.ResourceType,
			MetricName:     m.MetricName,
			Utilization:    m.UtilizationPercent,
			Impact:         impact,
			Recommendation: recommendation,
		})
	}

	// Sort descending by utilisation (simple insertion sort; list is typically small).
	for i := 1; i < len(bottlenecks); i++ {
		for j := i; j > 0 && bottlenecks[j].Utilization > bottlenecks[j-1].Utilization; j-- {
			bottlenecks[j], bottlenecks[j-1] = bottlenecks[j-1], bottlenecks[j]
		}
	}
	return bottlenecks, nil
}

// bottleneckRecommendation matches the Node.js recommendation logic exactly.
func bottleneckRecommendation(metricName string, util float64) string {
	if util >= 80 {
		switch metricName {
		case "cpu":
			return "考虑水平扩展或增加 CPU 核心数"
		case "memory":
			return "检查内存泄漏或增加内存配置"
		case "disk":
			return "清理无用文件或扩容磁盘"
		case "iops":
			return "优化数据库查询或升级到 SSD"
		}
	}
	return "监控 " + metricName + " 使用趋势"
}

// JSONBList is a helper type used only inside the service to build report snapshots.
type JSONBList []models.JSONB

// randFloat returns a pseudo-random float64 in [0,1) using time-based seed.
// This is intentionally simple — it mirrors the Node.js Math.random() usage
// for forecast generation. Not cryptographically secure.
func randFloat() float64 {
	return float64(time.Now().UnixNano()%1000) / 1000.0
}
