package service

import (
	"context"

	"orion-build-env-svc-go/internal/models"
	"orion-build-env-svc-go/internal/build_logs/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ListLogs lists all build logs
func (s *Service) ListLogs(ctx context.Context, tenantID string, limit, offset int) ([]models.BuildLog, error) {
	return s.repo.ListLogs(ctx, tenantID, limit, offset)
}

// GetLog gets a build log by ID
func (s *Service) GetLog(ctx context.Context, tenantID, id string) (*models.BuildLog, error) {
	return s.repo.GetLog(ctx, tenantID, id)
}
