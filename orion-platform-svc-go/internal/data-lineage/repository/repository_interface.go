package repository

import (
	"context"
	"orion/platform-svc-go/internal/data-lineage/models"
)


// RepositoryInterface defines the data access contract for the data-lineage module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateLineage(ctx context.Context, lineage *models.Lineage) error
	GetLineageByID(ctx context.Context, tenantID, id string) (*models.Lineage, error)
	ListLineages(ctx context.Context, tenantID string, status *string) ([]models.Lineage, error)
	UpdateLineage(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Lineage, error)
	DeleteLineage(ctx context.Context, tenantID, id string) (bool, error)
	CreateNode(ctx context.Context, node *models.Node) error
	GetNodeByID(ctx context.Context, tenantID, id string) (*models.Node, error)
	ListNodesByLineage(ctx context.Context, tenantID, lineageID string) ([]models.Node, error)
	CreateRelationship(ctx context.Context, rel *models.Relationship) error
	ListRelationshipsByLineage(ctx context.Context, tenantID, lineageID string) ([]models.Relationship, error)
	GetStats(ctx context.Context, tenantID string) (*models.LineageStats, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
