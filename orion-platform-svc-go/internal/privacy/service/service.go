package service

import (
    "context"

    "orion/platform-svc-go/internal/privacy/models"
    "orion/platform-svc-go/internal/privacy/repository"
)

type Service struct {
    repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
    return &Service{repo: repo}
}

func (s *Service) GetPrivacyConfig(ctx context.Context, tenantID string) (*models.PrivacyConfig, error) {
    return s.repo.GetConfig(ctx, tenantID)
}

func (s *Service) UpdatePrivacyConfig(ctx context.Context, tenantID string, config *models.PrivacyConfig) error {
    return s.repo.UpdateConfig(ctx, tenantID, config)
}
