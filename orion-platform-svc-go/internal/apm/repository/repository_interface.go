package repository

import (
	"context"
	"orion/platform-svc-go/internal/apm/models"
)


// RepositoryInterface defines the data access contract for the apm module.
type RepositoryInterface interface {
	Create(ctx context.Context, entity *models.ApmEntry) error
	GetByID(ctx context.Context, id, tenantID string) (*models.ApmEntry, error)
	List(ctx context.Context, tenantID string) ([]models.ApmEntry, error)
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ApmEntry, error)
	Delete(ctx context.Context, id, tenantID string) (bool, error)
	// Business: tracing / topology / slow queries (backed by trace_spans table)
}
