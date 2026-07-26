package service

import (
	"context"

	"orion/ai-svc-go/internal/aireview/models"
	"orion/ai-svc-go/internal/aireview/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateAIReviewRequest) (*models.AIReview, error) {
	m := &models.AIReview{TenantID: tenantID, Name: req.Name}
	return m, s.repo.Create(ctx, m)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.AIReview, error) {
	return s.repo.List(ctx, tenantID)
}
