package repository

import (
	"context"

	"orion/platform-svc-go/internal/data-catalog/models"
)

// RepositoryInterface defines the data access contract for the data-catalog module.
type RepositoryInterface interface {
	List(ctx context.Context, tenantID string) ([]models.Entry, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Entry, error)
	Create(ctx context.Context, tenantID string, req models.CreateEntryRequest) (*models.Entry, error)
	Update(ctx context.Context, tenantID, id string, req models.UpdateEntryRequest) (*models.Entry, error)
	Delete(ctx context.Context, tenantID, id string) error
	Search(ctx context.Context, tenantID string, q models.SearchRequest) ([]models.Entry, error)
	Count(ctx context.Context, tenantID string) (int, error)
	GetByTable(ctx context.Context, tenantID, tableName string) ([]models.Entry, error)
}
