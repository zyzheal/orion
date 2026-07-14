package service

import (
	"context"

	"orion/platform-svc-go/internal/slo/models"
	"orion/platform-svc-go/internal/slo/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateSLO(ctx context.Context, slo *models.SLODefinition) error {
	return s.repo.CreateSLO(ctx, slo)
}

func (s *Service) GetSLO(ctx context.Context, tenantID, id string) (*models.SLODefinition, error) {
	return s.repo.GetSLO(ctx, tenantID, id)
}

func (s *Service) ListSLOs(ctx context.Context, tenantID string, sloType string, enabled *bool) ([]models.SLODefinition, error) {
	return s.repo.ListSLOs(ctx, tenantID, sloType, enabled)
}

func (s *Service) UpdateSLO(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.SLODefinition, error) {
	return s.repo.UpdateSLO(ctx, tenantID, id, updates)
}

func (s *Service) DeleteSLO(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteSLO(ctx, tenantID, id)
}

func (s *Service) RecordSLI(ctx context.Context, m *models.SLIMeasurement) error {
	return s.repo.RecordSLI(ctx, m)
}

func (s *Service) GetSLIHistory(ctx context.Context, sloID, tenantID string, limit int) ([]models.SLIMeasurement, error) {
	return s.repo.GetSLIHistory(ctx, sloID, tenantID, limit)
}

func (s *Service) GetLatestErrorBudget(ctx context.Context, sloID, tenantID string) (*models.ErrorBudget, error) {
	return s.repo.GetLatestErrorBudget(ctx, sloID, tenantID)
}

func (s *Service) GetErrorBudgetHistory(ctx context.Context, sloID, tenantID string, limit int) ([]models.ErrorBudget, error) {
	return s.repo.GetErrorBudgetHistory(ctx, sloID, tenantID, limit)
}

func (s *Service) GetDashboard(ctx context.Context, tenantID string) ([]models.SLODefinition, error) {
	return s.repo.GetDashboard(ctx, tenantID)
}
