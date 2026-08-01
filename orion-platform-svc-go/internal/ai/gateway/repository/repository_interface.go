package repository

import (
	"context"
	"orion/platform-svc-go/internal/ai-gateway/models"
)


// RepositoryInterface defines the data access contract for the ai-gateway module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, resp *models.GatewayResponse) (*models.GatewayResponse, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.GatewayResponse, error)
	List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.GatewayResponse, int, error)
	EnsureTable(ctx context.Context) error
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
