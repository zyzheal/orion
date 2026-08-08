package crud

import "context"

// RepositoryInterface defines the CRUD contract that domain repositories
// should implement to satisfy the shared service layer.
type RepositoryInterface interface {
	List(ctx context.Context, tenantID string) ([]Record, error)
	GetByID(ctx context.Context, tenantID, id string) (*Record, error)
	Create(ctx context.Context, tenantID string, req CreateRequest) (*Record, error)
	Update(ctx context.Context, tenantID, id string, req CreateRequest) (*Record, error)
	Delete(ctx context.Context, tenantID, id string) error
}
