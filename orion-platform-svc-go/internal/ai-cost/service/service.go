package service

import (
	"context"

	"orion/platform-svc-go/internal/ai-cost/models"
	"orion/platform-svc-go/internal/ai-cost/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetCostRecord(ctx context.Context, tenantID, id string) (*models.CostRecord, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) ListCostRecords(ctx context.Context, tenantID string, f models.CostFilter) ([]models.CostRecord, error) {
	return s.repo.List(ctx, tenantID, f)
}

func (s *Service) GetCostSummary(ctx context.Context, tenantID string, f models.CostFilter) (*models.CostSummary, error) {
	return s.repo.GetSummary(ctx, tenantID, f)
}

func (s *Service) RecordCost(ctx context.Context, tenantID string, record *models.CostRecord) (*models.CostRecord, error) {
	return s.repo.Create(ctx, tenantID, record)
}
