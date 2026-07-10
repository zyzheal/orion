package service

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"orion/tenant-svc-go/internal/models"
	"orion/tenant-svc-go/internal/repository"

	"go.uber.org/zap"
)

var errQuotaService = errors.New("TenantQuotaRepository is required")

type QuotaUsage struct {
	TenantID     int64     `json:"tenant_id"`
	ResourceType string    `json:"resource_type"`
	ResourceKey  string    `json:"resource_key"`
	CurrentValue float64   `json:"current_value"`
	WindowStart  time.Time `json:"window_start"`
	WindowEnd    time.Time `json:"window_end"`
}

type QuotaCheckResult struct {
	Allowed       bool    `json:"allowed"`
	CurrentUsage  float64 `json:"current_usage"`
	QuotaLimit    float64 `json:"quota_limit"`
	Remaining     float64 `json:"remaining"`
	Message       string  `json:"message"`
}

type QuotaAlert struct {
	TenantID         int64     `json:"tenant_id"`
	ResourceType     string    `json:"resource_type"`
	CurrentUsage     float64   `json:"current_usage"`
	QuotaLimit       float64   `json:"quota_limit"`
	ThresholdPercent float64   `json:"threshold_percent"`
	Timestamp        time.Time `json:"timestamp"`
}

// TenantQuota represents the application-level quota view.
type TenantQuota struct {
	TenantID                  int64 `json:"tenant_id"`
	MaxPipelines              int64 `json:"max_pipelines"`
	MaxPipelineRunsPerDay     int64 `json:"max_pipeline_runs_per_day"`
	MaxConcurrentRuns         int64 `json:"max_concurrent_runs"`
	MaxTasksPerPipeline       int64 `json:"max_tasks_per_pipeline"`
	MaxRunners                int64 `json:"max_runners"`
	MaxCpuCores               int64 `json:"max_cpu_cores"`
	MaxMemoryGb               int64 `json:"max_memory_gb"`
	MaxStorageGb              int64 `json:"max_storage_gb"`
	MaxNamespaces             int64 `json:"max_namespaces"`
	ApiRateLimit              int64 `json:"api_rate_limit"`
	ApiRateLimitWindowSeconds int64 `json:"api_rate_limit_window_seconds"`
}

type QuotaService struct {
	repo             *repository.TenantRepository
	log              *zap.Logger
	mu               sync.RWMutex
	usage            map[string]*QuotaUsage
	alertThreshold   float64
	usageLoadedFromDB bool
}

func NewQuotaService(repo *repository.TenantRepository, log *zap.Logger) *QuotaService {
	if repo == nil {
		panic(errQuotaService.Error())
	}
	return &QuotaService{
		repo:           repo,
		log:            log,
		usage:          make(map[string]*QuotaUsage),
		alertThreshold: 80.0,
	}
}

// GetQuota retrieves quota for a tenant (defaults if not configured).
func (s *QuotaService) GetQuota(ctx context.Context, tenantID int64) (*TenantQuota, error) {
	var q *models.QuotaConfig
	var err error
	q, err = s.repo.FindQuotaByTenantID(ctx, fmt.Sprintf("%d", tenantID))
	if err != nil {
		return nil, err
	}
	if q != nil {
		return s.mapEntityToQuota(q), nil
	}
	// Default quota
	return defaultQuota(tenantID), nil
}

func defaultQuota(tenantID int64) *TenantQuota {
	return &TenantQuota{
		TenantID:                  tenantID,
		MaxPipelines:              100,
		MaxPipelineRunsPerDay:     1000,
		MaxConcurrentRuns:         10,
		MaxTasksPerPipeline:       50,
		MaxRunners:                5,
		MaxCpuCores:               16,
		MaxMemoryGb:               32,
		MaxStorageGb:              100,
		MaxNamespaces:             10,
		ApiRateLimit:              1000,
		ApiRateLimitWindowSeconds: 60,
	}
}

func (s *QuotaService) mapEntityToQuota(q *models.QuotaConfig) *TenantQuota {
	return &TenantQuota{
		TenantID:                  int64(q.TenantID[0] - '0'), // fallback for numeric IDs as string
		MaxPipelines:              int64(q.MaxPipelines),
		MaxPipelineRunsPerDay:     int64(q.MaxPipelineRunsPerDay),
		MaxConcurrentRuns:         int64(q.MaxConcurrentBuilds),
		MaxTasksPerPipeline:       int64(q.MaxTasksPerPipeline),
		MaxRunners:                int64(q.MaxRunners),
		MaxCpuCores:               int64(q.MaxCpuCores),
		MaxMemoryGb:               int64(q.MaxMemoryGb),
		MaxStorageGb:              int64(q.MaxStorageMb) / 1024,
		MaxNamespaces:             int64(q.MaxProjects),
		ApiRateLimit:              int64(q.ApiRateLimit),
		ApiRateLimitWindowSeconds: int64(q.ApiRateLimitWindowSeconds),
	}
}

// SetQuota saves quota configuration for a tenant.
func (s *QuotaService) SetQuota(ctx context.Context, q *TenantQuota) error {
	tenantID := fmt.Sprintf("%d", q.TenantID)
	existing, err := s.repo.FindQuotaByTenantID(ctx, tenantID)
	if err != nil {
		return err
	}

	if existing != nil {
		updates := map[string]any{
			"max_pipelines":                 q.MaxPipelines,
			"max_pipeline_runs_per_day":     q.MaxPipelineRunsPerDay,
			"max_concurrent_builds":         q.MaxConcurrentRuns,
			"max_tasks_per_pipeline":        q.MaxTasksPerPipeline,
			"max_runners":                   q.MaxRunners,
			"max_cpu_cores":                 q.MaxCpuCores,
			"max_memory_gb":                 q.MaxMemoryGb,
			"max_storage_mb":                q.MaxStorageGb * 1024,
			"max_projects":                  q.MaxNamespaces,
			"api_rate_limit":                q.ApiRateLimit,
			"api_rate_limit_window_seconds": q.ApiRateLimitWindowSeconds,
		}
		return s.repo.UpdateQuota(ctx, existing.ID, updates)
	}

	entity := &models.QuotaConfig{
		ID:                        fmt.Sprintf("quota_%d", q.TenantID),
		TenantID:                  tenantID,
		MaxPipelines:              int(q.MaxPipelines),
		MaxPipelineRunsPerDay:     int(q.MaxPipelineRunsPerDay),
		MaxConcurrentBuilds:       int(q.MaxConcurrentRuns),
		MaxTasksPerPipeline:       int(q.MaxTasksPerPipeline),
		MaxRunners:                int(q.MaxRunners),
		MaxCpuCores:               int(q.MaxCpuCores),
		MaxMemoryGb:               int(q.MaxMemoryGb),
		MaxStorageMb:              int(q.MaxStorageGb * 1024),
		MaxProjects:               int(q.MaxNamespaces),
		MaxUsers:                  100,
		ApiRateLimit:              int(q.ApiRateLimit),
		ApiRateLimitWindowSeconds: int(q.ApiRateLimitWindowSeconds),
		Usage:                     make(map[string]any),
	}
	return s.repo.CreateQuota(ctx, entity)
}

// CheckQuota checks whether a resource request is within quota.
func (s *QuotaService) CheckQuota(ctx context.Context, tenantID int64, resourceType string, requestedValue float64) (*QuotaCheckResult, error) {
	quota, err := s.GetQuota(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	currentUsage := s.getCurrentUsage(tenantID, resourceType)
	limit := s.getQuotaLimit(quota, resourceType)
	remaining := limit - currentUsage

	allowed := currentUsage+requestedValue <= limit

	usagePercent := 0.0
	if limit > 0 {
		usagePercent = (currentUsage / limit) * 100
	}
	if usagePercent >= s.alertThreshold && !allowed {
		s.emitAlert(tenantID, resourceType, currentUsage, limit, usagePercent)
	}

	msg := ""
	if !allowed {
		msg = fmt.Sprintf("Quota exceeded: %s limit is %.0f", resourceType, limit)
	}

	return &QuotaCheckResult{
		Allowed:      allowed,
		CurrentUsage: currentUsage,
		QuotaLimit:   limit,
		Remaining:    remaining,
		Message:      msg,
	}, nil
}

// IncrementUsage increments a usage counter.
func (s *QuotaService) IncrementUsage(tenantID int64, resourceType string, resourceKey string) float64 {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := fmt.Sprintf("%d:%s:%s", tenantID, resourceType, resourceKey)
	current := s.usage[key]
	var newValue float64
	var windowStart, windowEnd time.Time

	if current != nil {
		newValue = current.CurrentValue + 1
		windowStart = current.WindowStart
		windowEnd = current.WindowEnd
	} else {
		newValue = 1
		windowStart = time.Now()
		windowEnd = time.Now().Add(1 * time.Hour)
	}

	s.usage[key] = &QuotaUsage{
		TenantID:     tenantID,
		ResourceType: resourceType,
		ResourceKey:  resourceKey,
		CurrentValue: newValue,
		WindowStart:  windowStart,
		WindowEnd:    windowEnd,
	}

	return newValue
}

// GetCurrentUsage returns current usage for a resource type.
func (s *QuotaService) GetCurrentUsage(tenantID int64, resourceType string) float64 {
	return s.getCurrentUsage(tenantID, resourceType)
}

func (s *QuotaService) getCurrentUsage(tenantID int64, resourceType string) float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	prefix := fmt.Sprintf("%d:%s:", tenantID, resourceType)
	count := 0.0
	for key, usage := range s.usage {
		if strings.HasPrefix(key, prefix) {
			count += usage.CurrentValue
		}
	}
	return count
}

func (s *QuotaService) getQuotaLimit(quota *TenantQuota, resourceType string) float64 {
	switch resourceType {
	case "pipelines":
		return float64(quota.MaxPipelines)
	case "concurrent_runs":
		return float64(quota.MaxConcurrentRuns)
	case "runners":
		return float64(quota.MaxRunners)
	case "namespaces":
		return float64(quota.MaxNamespaces)
	case "pipeline_runs_per_day":
		return float64(quota.MaxPipelineRunsPerDay)
	case "tasks_per_pipeline":
		return float64(quota.MaxTasksPerPipeline)
	case "cpu_cores":
		return float64(quota.MaxCpuCores)
	case "memory_gb":
		return float64(quota.MaxMemoryGb)
	case "storage_gb":
		return float64(quota.MaxStorageGb)
	}
	return 0
}

func (s *QuotaService) emitAlert(tenantID int64, resourceType string, currentUsage, limit, thresholdPercent float64) {
	s.log.Warn("Quota alert",
		zap.Int64("tenant_id", tenantID),
		zap.String("resource_type", resourceType),
		zap.Float64("current_usage", currentUsage),
		zap.Float64("quota_limit", limit),
		zap.Float64("threshold_percent", thresholdPercent))
}

// GetUsageReport returns a usage report for a tenant.
func (s *QuotaService) GetUsageReport(ctx context.Context, tenantID int64) (map[string]float64, error) {
	_, err := s.GetQuota(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	s.mu.RLock()
	tenants := make(map[string]float64)
	prefix := fmt.Sprintf("%d:", tenantID)
	for key, usage := range s.usage {
		if strings.HasPrefix(key, prefix) {
			tenants[usage.ResourceType] += usage.CurrentValue
		}
	}
	s.mu.RUnlock()

	return tenants, nil
}
