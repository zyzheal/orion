package service

import (
	"context"
	"orion/platform-svc-go/internal/execution-mode-engine/models"
	"orion/platform-svc-go/internal/execution-mode-engine/repository"
)

type ExecutionModeService struct {
	repo repository.ExecutionModeRepository
}

func NewExecutionModeService(repo repository.ExecutionModeRepository) *ExecutionModeService {
	return &ExecutionModeService{repo: repo}
}

func (s *ExecutionModeService) Create(ctx context.Context, config *models.ExecutionModeConfig) error {
	return s.repo.Create(ctx, config)
}

func (s *ExecutionModeService) Get(ctx context.Context, tenantID, id string) (*models.ExecutionModeConfig, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *ExecutionModeService) List(ctx context.Context, tenantID string) ([]models.ExecutionModeConfig, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *ExecutionModeService) Update(ctx context.Context, config *models.ExecutionModeConfig) error {
	return s.repo.Update(ctx, config)
}

func (s *ExecutionModeService) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
