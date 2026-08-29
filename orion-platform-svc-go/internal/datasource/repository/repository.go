package repository

import (
	"context"
	"orion/platform-svc-go/internal/datasource/models"
)

// Interface defines the persistence layer contract for datasource CRUD.
type Interface interface {
	Create(ctx context.Context, ds *models.DataSource) error
	GetByID(ctx context.Context, id string) (*models.DataSource, error)
	List(ctx context.Context, tenantID string) ([]*models.DataSource, error)
	Update(ctx context.Context, ds *models.DataSource) error
	Delete(ctx context.Context, id string) error
}
