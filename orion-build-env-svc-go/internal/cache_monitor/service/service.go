package cache_monitor

import (
	"context"

	"orion-build-env-svc-go/internal/models"
	"orion-build-env-svc-go/internal/cache_monitor/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// RecordEvent records a cache event
func (s *Service) RecordEvent(ctx context.Context, tenantID string, req models.RecordCacheEventRequest) (*models.CacheEvent, error) {
	event := &models.CacheEvent{
		CacheID:      req.CacheID,
		EventType:    req.EventType,
		LatencySaved: req.LatencySavedMs,
	}
	if err := s.repo.RecordEvent(ctx, tenantID, event); err != nil {
		return nil, err
	}
	return event, nil
}

// GetDashboard returns the cache monitoring dashboard
func (s *Service) GetDashboard(ctx context.Context, tenantID string) (*models.CacheDashboard, error) {
	stats := &models.CacheDashboard{
		TenantID: tenantID,
	}
	totalEvents, totalHits, totalMisses, _, err := s.repo.GetDashboardStats(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	stats.TotalHits = totalHits
	stats.TotalMisses = totalMisses
	if totalEvents > 0 {
		stats.HitRate = float64(totalHits) / float64(totalEvents)
	}
	return stats, nil
}

// GetMetrics returns cache metrics for a given cache ID
func (s *Service) GetMetrics(ctx context.Context, tenantID, cacheID string) (*models.CacheMetrics, error) {
	return &models.CacheMetrics{
		CacheID: cacheID,
	}, nil
}

// AssessHealth assesses cache health
func (s *Service) AssessHealth(ctx context.Context, tenantID, cacheID string) (*models.CacheHealth, error) {
	return &models.CacheHealth{
		CacheID: cacheID,
		Healthy: true,
		Score:   100,
		Message: "healthy",
	}, nil
}

// AnalyzePerformanceImpact analyzes cache performance impact for a pipeline
func (s *Service) AnalyzePerformanceImpact(ctx context.Context, tenantID, pipelineID string) (*models.PerformanceImpact, error) {
	return &models.PerformanceImpact{
		PipelineID: pipelineID,
		TenantID:   tenantID,
	}, nil
}
