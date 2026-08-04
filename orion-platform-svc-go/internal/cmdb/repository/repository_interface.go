package repository

import (
	"context"
	"orion/platform-svc-go/internal/cmdb/models"
)


// RepositoryInterface defines the data access contract for the cmdb module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateCI(ctx context.Context, ci *models.CI) error
	GetCIByID(ctx context.Context, id string) (*models.CI, error)
	GetCIByCiId(ctx context.Context, ciID string, tenantID *string) (*models.CI, error)
	UpdateCI(ctx context.Context, id string, updates map[string]interface{}) (*models.CI, error)
	DeleteCI(ctx context.Context, id string) (bool, error)
	ListCIs(ctx context.Context, ciType *string, status *string, tenantID string, page, limit int) ([]models.CI, int, error)
	BatchCreateCIs(ctx context.Context, items []models.BatchCreateItem, tenantID string, createdBy string) (*models.BatchResult, error)
	BatchUpdateCIs(ctx context.Context, items []models.BatchUpdateItem, tenantID string) (*models.BatchResult, error)
	BatchDeleteCIs(ctx context.Context, ids []string, tenantID string) (*models.BatchResult, error)
	BatchQueryCIs(ctx context.Context, q *models.BatchQueryRequest, tenantID string) ([]models.CI, int, error)
	ExportCIByCiId(ctx context.Context, ciID string, tenantID string) (*models.CI, error)
	ExportCIs(ctx context.Context, ciType, status, environment, search *string, tenantID string, includeArchived bool) ([]models.CI, error)
	GetCIRelations(ctx context.Context, ciID string) ([]models.CIRelation, error)
	CreateRelation(ctx context.Context, rel *models.CIRelation) error
	DeleteRelation(ctx context.Context, relationID string, tenantID string) (bool, error)
	GetCIVersions(ctx context.Context, ciID string) ([]models.CIVersion, error)
	GetCurrentVersion(ctx context.Context, ciID string) (*models.CIVersion, error)
	CreateVersion(ctx context.Context, ciID string, version int, snapshot *string, createdBy string, tenantID string) error
	GetVersionSnapshot(ctx context.Context, ciID string, version int) (*string, error)
	GetTopologyNodes(ctx context.Context, ciType *string, tenantID string, limit int) ([]models.TopologyNode, error)
	GetTopologyEdges(ctx context.Context, tenantID string, limit int) ([]models.TopologyEdge, error)
	GetServiceDependencies(ctx context.Context, tenantID string, ciID string) ([]models.CIRelation, error)
	GetImpactAnalysis(ctx context.Context, tenantID string, ciID string) ([]models.CIRelation, error)
	SearchCIs(ctx context.Context, tenantID, query, domain string, limit, offset int) ([]models.CI, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
