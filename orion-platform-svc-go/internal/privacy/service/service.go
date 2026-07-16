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

// GetPrivacyConfig retrieves the privacy configuration for a tenant.
func (s *Service) GetPrivacyConfig(ctx context.Context, tenantID string) (*models.PrivacyConfig, error) {
	return s.repo.GetConfig(ctx, tenantID)
}

// UpsertPrivacyConfig creates or updates the privacy configuration for a tenant.
func (s *Service) UpsertPrivacyConfig(ctx context.Context, tenantID string, config *models.PrivacyConfig) (*models.PrivacyConfig, error) {
	return s.repo.UpsertConfig(ctx, tenantID, config)
}

// UpdatePrivacyConfig patches specific fields of the privacy configuration.
func (s *Service) UpdatePrivacyConfig(ctx context.Context, tenantID string, updates map[string]interface{}) (*models.PrivacyConfig, error) {
	return s.repo.UpdateConfig(ctx, tenantID, updates)
}

// DeletePrivacyConfig removes the privacy configuration for a tenant.
func (s *Service) DeletePrivacyConfig(ctx context.Context, tenantID string) error {
	return s.repo.DeleteConfig(ctx, tenantID)
}

// ListComplianceStatus returns compliance status across all tenants.
func (s *Service) ListComplianceStatus(ctx context.Context) ([]models.ComplianceStatus, error) {
	return s.repo.ListComplianceStatus(ctx)
}
