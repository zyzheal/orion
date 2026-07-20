package service

import (
	"context"

	"orion/platform-svc-go/internal/privacy/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	DeleteConfig(ctx context.Context, tenantID string) error
	GetConfig(ctx context.Context, tenantID string) (*models.PrivacyConfig, error)
	ListComplianceStatus(ctx context.Context) ([]models.ComplianceStatus, error)
	UpdateConfig(ctx context.Context, tenantID string, updates map[string]interface{}) (*models.PrivacyConfig, error)
	UpsertConfig(ctx context.Context, tenantID string, cfg *models.PrivacyConfig) (*models.PrivacyConfig, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
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
