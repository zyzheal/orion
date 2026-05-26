package service

import (
	"context"
	"orion/build-svc-go/internal/models"
	"orion/build-svc-go/internal/repository"
)

type BuildService struct {
	repo *repository.BuildRepository
}

func NewBuildService(repo *repository.BuildRepository) *BuildService {
	return &BuildService{repo: repo}
}

func (s *BuildService) Create(ctx context.Context, b *models.Build) error {
	if b.Status == "" {
		b.Status = "pending"
	}
	return s.repo.Create(ctx, b)
}

func (s *BuildService) GetByID(ctx context.Context, tenantID, id string) (*models.Build, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *BuildService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Build, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *BuildService) Update(ctx context.Context, b *models.Build) error {
	return s.repo.Update(ctx, b)
}

func (s *BuildService) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
