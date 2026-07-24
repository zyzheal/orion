package repository

import (
	"context"
	"orion/platform-svc-go/internal/graphviz/models"
)

// RepositoryInterface defines the data access contract for graphviz graphs.
type RepositoryInterface interface {
	Create(ctx context.Context, g *models.Graph) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Graph, error)
	List(ctx context.Context, tenantID string) ([]models.Graph, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Graph, error)
	Delete(ctx context.Context, tenantID, id string) error
}
