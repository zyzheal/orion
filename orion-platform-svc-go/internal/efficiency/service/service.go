package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/efficiency/models"
	"orion/platform-svc-go/internal/efficiency/repository"
)

// ErrNotFound is returned when a resource is not found.
var ErrNotFound = repository.ErrNotFound

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// --- Metrics ---

func (s *Service) CreateMetric(ctx context.Context, tenantID string, req models.CreateMetricRequest) (*models.Metric, error) {
	metric := &models.Metric{
		TenantID:      tenantID,
		Name:          req.Name,
		Description:   req.Description,
		MetricType:    req.MetricType,
		Scope:         req.Scope,
		ScopeID:       req.ScopeID,
		BaselineValue: req.BaselineValue,
		CurrentValue:  req.BaselineValue,
		TargetValue:   req.TargetValue,
		Unit:          req.Unit,
		Status:        "active",
	}
	if err := s.repo.CreateMetric(ctx, metric); err != nil {
		return nil, err
	}
	return metric, nil
}

func (s *Service) GetMetric(ctx context.Context, tenantID, id string) (*models.Metric, error) {
	return s.repo.GetMetricByID(ctx, tenantID, id)
}

func (s *Service) ListMetrics(ctx context.Context, tenantID string, filter *models.MetricFilter) ([]models.Metric, int, error) {
	if filter == nil {
		filter = &models.MetricFilter{Limit: 20}
	}
	if filter.Limit <= 0 {
		filter.Limit = 20
	}
	return s.repo.ListMetrics(ctx, tenantID, filter)
}

func (s *Service) UpdateMetric(ctx context.Context, tenantID, id string, req models.UpdateMetricRequest) (*models.Metric, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.MetricType != nil {
		updates["metric_type"] = *req.MetricType
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.CurrentValue != nil {
		updates["current_value"] = *req.CurrentValue
	}
	return s.repo.UpdateMetric(ctx, tenantID, id, updates)
}

func (s *Service) DeleteMetric(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteMetric(ctx, tenantID, id)
}

// --- Scores ---

func (s *Service) CreateScore(ctx context.Context, tenantID string, req models.CreateScoreRequest) (*models.Score, error) {
	score := &models.Score{
		TenantID:  tenantID,
		MetricID:  req.MetricID,
		Score:     req.Score,
		ScoreDate: time.Now().UTC().Format("2006-01-02"),
		Notes:     req.Notes,
	}
	if err := s.repo.CreateScore(ctx, score); err != nil {
		return nil, err
	}
	return score, nil
}

func (s *Service) ListScoresByMetric(ctx context.Context, tenantID, metricID string) ([]models.Score, error) {
	return s.repo.ListScoresByMetric(ctx, tenantID, metricID)
}

// --- Recommendations ---

func (s *Service) CreateRecommendation(ctx context.Context, tenantID string, req models.CreateRecommendationRequest) (*models.Recommendation, error) {
	rec := &models.Recommendation{
		TenantID:            tenantID,
		Title:               req.Title,
		Description:         req.Description,
		ImpactLevel:         req.ImpactLevel,
		EstimatedSavings:    req.EstimatedSavings,
		ImplementationEffort: req.ImplementationEffort,
		Status:              "suggested",
	}
	if err := s.repo.CreateRecommendation(ctx, rec); err != nil {
		return nil, err
	}
	return rec, nil
}

func (s *Service) GetRecommendation(ctx context.Context, tenantID, id string) (*models.Recommendation, error) {
	return s.repo.GetRecommendationByID(ctx, tenantID, id)
}

func (s *Service) ListRecommendations(ctx context.Context, tenantID string, status *string) ([]models.Recommendation, error) {
	return s.repo.ListRecommendations(ctx, tenantID, status)
}

func (s *Service) UpdateRecommendation(ctx context.Context, tenantID, id, status string) (*models.Recommendation, error) {
	return s.repo.UpdateRecommendation(ctx, tenantID, id, status)
}

func (s *Service) DeleteRecommendation(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteRecommendation(ctx, tenantID, id)
}

// --- Stats ---

func (s *Service) GetStats(ctx context.Context, tenantID string) (*models.EfficiencyStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}
