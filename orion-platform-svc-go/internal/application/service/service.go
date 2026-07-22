package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/application/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, a *models.Application) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Application, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Application, error)
	Update(ctx context.Context, a *models.Application) error
	Delete(ctx context.Context, tenantID, id string) error
}

// Service coordinates business logic for application management.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service instance.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Create creates a new application for the tenant.
func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateApplicationRequest) (*models.Application, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	now := time.Now()
	a := &models.Application{
		ID:        uuid.New().String(),
		Name:      req.Name,
		TenantID:  tenantID,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.repo.Create(ctx, a); err != nil {
		return nil, fmt.Errorf("failed to create application: %w", err)
	}
	return a, nil
}

// GetByID retrieves an application by id (tenant-scoped).
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Application, error) {
	a, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get application: %w", err)
	}
	return a, nil
}

// List retrieves applications for the tenant.
func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter) ([]models.Application, error) {
	items, err := s.repo.List(ctx, tenantID, filter, 0, 100)
	if err != nil {
		return nil, fmt.Errorf("failed to list applications: %w", err)
	}
	return items, nil
}

// Update updates an application's name.
func (s *Service) Update(ctx context.Context, tenantID, id string, name string) (*models.Application, error) {
	a, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get application: %w", err)
	}
	a.Name = name
	if err := s.repo.Update(ctx, a); err != nil {
		return nil, fmt.Errorf("failed to update application: %w", err)
	}
	return a, nil
}

// Delete removes an application by id (tenant-scoped).
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	if err := s.repo.Delete(ctx, tenantID, id); err != nil {
		return fmt.Errorf("failed to delete application: %w", err)
	}
	return nil
}
