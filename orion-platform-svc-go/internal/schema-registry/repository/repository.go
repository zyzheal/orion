package repository

import (
	"context"

	"orion/platform-svc-go/internal/schema-registry/models"
)

// Interface abstracts schema persistence.
type Interface interface {
	CreateSchema(ctx context.Context, s *models.Schema) error
	GetSchema(ctx context.Context, namespace, name string) (*models.Schema, error)
	ListSchemas(ctx context.Context, namespace string) ([]*models.Schema, error)
	QuerySchemas(ctx context.Context, q *models.QueryRequest) ([]*models.Schema, int, error)
	UpdateSchema(ctx context.Context, s *models.Schema) error
	DeleteSchema(ctx context.Context, namespace, name string) error

	GetLatestVersion(ctx context.Context, namespace, name string) (int, error)
	AppendVersion(ctx context.Context, namespace, name string, v *models.SchemaVersion) error
	GetVersionHistory(ctx context.Context, namespace, name string, limit int) ([]*models.SchemaVersion, error)
	GetVersion(ctx context.Context, namespace, name string, version int) (*models.SchemaVersion, error)

	GetCompatibility(ctx context.Context, namespace, name string) (models.CompatibilityMode, error)
}
