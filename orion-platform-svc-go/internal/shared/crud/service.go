package crud

import (
	"context"
)

// ServiceInterface defines the CRUD methods that domain services should
// implement so the shared CRUD handler can delegate to them.
type ServiceInterface interface {
	List(ctx context.Context, tenantID string) ([]Record, error)
	Get(ctx context.Context, tenantID, id string) (*Record, error)
	Create(ctx context.Context, tenantID string, req CreateRequest) (*Record, error)
	Update(ctx context.Context, tenantID, id string, req CreateRequest) (*Record, error)
	Delete(ctx context.Context, tenantID, id string) error
}

// BaseService is a thin passthrough to a shared RepositoryInterface, providing
// the canonical CRUD methods.
type BaseService struct {
	repo RepositoryInterface
}

// NewBaseService creates a new BaseService backed by the given repository.
func NewBaseService(repo RepositoryInterface) *BaseService {
	return &BaseService{repo: repo}
}

// List delegates to the repository.
func (s *BaseService) List(ctx context.Context, tenantID string) ([]Record, error) {
	return s.repo.List(ctx, tenantID)
}

// Get delegates to the repository.
func (s *BaseService) Get(ctx context.Context, tenantID, id string) (*Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// Create delegates to the repository.
func (s *BaseService) Create(ctx context.Context, tenantID string, req CreateRequest) (*Record, error) {
	return s.repo.Create(ctx, tenantID, req)
}

// Update delegates to the repository.
func (s *BaseService) Update(ctx context.Context, tenantID, id string, req CreateRequest) (*Record, error) {
	return s.repo.Update(ctx, tenantID, id, req)
}

// Delete delegates to the repository.
func (s *BaseService) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
