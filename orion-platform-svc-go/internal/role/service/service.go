package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/role/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Count(ctx context.Context, tenantID string) (int, error)
	Create(ctx context.Context, role *models.Role) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Role, error)
	List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Role, error)
	Update(ctx context.Context, role *models.Role) error
	UpdatePermissions(ctx context.Context, tenantID, id string, permissions models.Permissions) error
}

var (
	ErrRoleNotFound  = errors.New("role not found")
	ErrDuplicateName = errors.New("role with this name already exists")
)

// Service implements the role business logic.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service instance.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// Create creates a new role after validating uniqueness of name within tenant.
func (s *Service) Create(ctx context.Context, tenantID, createdBy string, req *models.CreateRoleRequest) (*models.Role, error) {
	now := time.Now()

	role := &models.Role{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Permissions: models.Permissions(req.Permissions),
		Status:      models.RoleStatusActive,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.Create(ctx, role); err != nil {
		return nil, fmt.Errorf("failed to create role: %w", err)
	}
	return role, nil
}

// GetByID retrieves a role by id.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Role, error) {
	role, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrRoleNotFound
	}
	return role, nil
}

// List retrieves roles with optional status filter and pagination.
func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Role, error) {
	return s.repo.List(ctx, tenantID, filter, offset, limit)
}

// Update modifies an existing role using partial update semantics.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateRoleRequest) (*models.Role, error) {
	role, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrRoleNotFound
	}

	if req.Name != nil {
		role.Name = *req.Name
	}
	if req.Description != nil {
		role.Description = *req.Description
	}
	if req.Status != nil {
		role.Status = *req.Status
	}

	role.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, role); err != nil {
		return nil, fmt.Errorf("failed to update role: %w", err)
	}
	return role, nil
}

// Delete removes a role by id.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Count returns the total number of roles for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// SetPermissions replaces all permissions for a role.
func (s *Service) SetPermissions(ctx context.Context, tenantID, id string, req *models.SetPermissionsRequest) (*models.Role, error) {
	role, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrRoleNotFound
	}

	permissions := models.Permissions(req.Permissions)
	if err := s.repo.UpdatePermissions(ctx, tenantID, id, permissions); err != nil {
		return nil, fmt.Errorf("failed to set permissions: %w", err)
	}

	role.Permissions = permissions
	role.UpdatedAt = time.Now()
	return role, nil
}

// GetPermissions returns the permissions for a role.
func (s *Service) GetPermissions(ctx context.Context, tenantID, id string) (*models.Role, error) {
	role, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrRoleNotFound
	}
	return role, nil
}
