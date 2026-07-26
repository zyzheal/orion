package service

import (
	"context"

	"orion/ai-svc-go/internal/aigateway/models"
	"orion/ai-svc-go/internal/aigateway/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateAIGatewayRequest) (*models.AIGateway, error) {
	m := &models.AIGateway{TenantID: tenantID, Name: req.Name}
	return m, s.repo.Create(ctx, m)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.AIGateway, error) {
	return s.repo.List(ctx, tenantID)
}
