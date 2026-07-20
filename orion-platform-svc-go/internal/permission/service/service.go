package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/permission/models"

	"github.com/google/uuid"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Count(ctx context.Context, tenantID string) (int, error)
	Create(ctx context.Context, p *models.Permission) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Permission, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Permission, error)
	Update(ctx context.Context, p *models.Permission) error
}

// Service provides permission management business logic.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service instance.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Create creates a new permission.
func (s *Service) Create(ctx context.Context, tenantID, userID string, req *models.CreatePermissionRequest) (*models.Permission, error) {
	if req.Code == "" {
		return nil, fmt.Errorf("code is required")
	}
	if req.Resource == "" {
		return nil, fmt.Errorf("resource is required")
	}
	if req.Action == "" {
		return nil, fmt.Errorf("action is required")
	}

	now := time.Now()
	p := &models.Permission{
		ID:   uuid.New().String(),
		Name: req.Name, Code: req.Code, Resource: req.Resource,
		Action: req.Action, Desc: req.Desc,
		TenantID: tenantID, UserID: userID,
		CreatedAt: now, UpdatedAt: now,
	}

	if err := s.repo.Create(ctx, p); err != nil {
		return nil, fmt.Errorf("failed to create permission: %w", err)
	}
	return p, nil
}

// List retrieves permissions for a tenant with optional filters and pagination.
func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Permission, error) {
	return s.repo.List(ctx, tenantID, filter, offset, limit)
}

// GetByID retrieves a permission by id.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Permission, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// Count returns the total number of permissions for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// Update modifies an existing permission.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdatePermissionRequest) (*models.Permission, error) {
	p, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		p.Name = *req.Name
	}
	if req.Code != nil {
		p.Code = *req.Code
	}
	if req.Resource != nil {
		p.Resource = *req.Resource
	}
	if req.Action != nil {
		p.Action = *req.Action
	}
	if req.Desc != nil {
		p.Desc = *req.Desc
	}

	if err := s.repo.Update(ctx, p); err != nil {
		return nil, fmt.Errorf("failed to update permission: %w", err)
	}
	return p, nil
}

// Delete removes a permission by id.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return sentinel.NotFound
	}
	return s.repo.Delete(ctx, tenantID, id)
}
