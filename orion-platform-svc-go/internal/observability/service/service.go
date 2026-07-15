package service

import (
	"context"

	"orion/platform-svc-go/internal/observability/models"
	"orion/platform-svc-go/internal/observability/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) RecordMetric(ctx context.Context, tenantID string, m *models.Metric) (*models.Metric, error) {
	return s.repo.CreateMetric(ctx, tenantID, m)
}

func (s *Service) GetMetric(ctx context.Context, tenantID, name string) (*models.Metric, error) {
	return s.repo.GetMetric(ctx, tenantID, name)
}

func (s *Service) ListMetrics(ctx context.Context, tenantID string, q models.MetricQuery) ([]models.Metric, error) {
	return s.repo.ListMetrics(ctx, tenantID, q)
}

func (s *Service) CreateAlertRule(ctx context.Context, tenantID string, rule *models.AlertRule) (*models.AlertRule, error) {
	return s.repo.CreateAlertRule(ctx, tenantID, rule)
}

func (s *Service) ListAlertRules(ctx context.Context, tenantID string) ([]models.AlertRule, error) {
	return s.repo.ListAlertRules(ctx, tenantID)
}
