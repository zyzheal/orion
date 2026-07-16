package service

import (
	"context"

	"orion/platform-svc-go/internal/webhook/store/models"
	"orion/platform-svc-go/internal/webhook/store/repository"
)

// Service provides domain-scoped config entry CRUD.
type Service struct {
	repo *repository.Repository
}

// NewService creates a new Service.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// Create creates a new config entry for the given domain.
func (s *Service) Create(ctx context.Context, tenantID, domain string, req *models.CreateConfigEntryRequest) (*models.ConfigEntry, error) {
	e := &models.ConfigEntry{
		TenantID: tenantID,
		Domain:   domain,
		Name:     req.Name,
		Value:    req.Value,
		Enabled:  req.Enabled,
	}
	if err := s.repo.Create(ctx, e); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, e.ID)
}

// Get retrieves a single config entry.
func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.ConfigEntry, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// ListByDomain returns all config entries for a tenant and domain.
func (s *Service) ListByDomain(ctx context.Context, tenantID, domain string) ([]models.ConfigEntry, error) {
	return s.repo.ListByDomain(ctx, tenantID, domain)
}

// ListAll returns all config entries for a tenant across all domains.
func (s *Service) ListAll(ctx context.Context, tenantID string) ([]models.ConfigEntry, error) {
	return s.repo.ListAll(ctx, tenantID)
}

// Update applies partial updates to a config entry.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateConfigEntryRequest) (*models.ConfigEntry, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Value != nil {
		updates["value"] = *req.Value
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	return s.repo.Update(ctx, tenantID, id, updates)
}

// Delete removes a config entry.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}