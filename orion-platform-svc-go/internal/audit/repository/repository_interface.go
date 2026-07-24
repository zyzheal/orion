package repository

import (
	"context"
	"orion/platform-svc-go/internal/audit/models"
)


// RepositoryInterface defines the data access contract for the audit module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLog, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.AuditLog, error)
	List(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, int, error)
	Count(ctx context.Context, tenantID string, q models.AuditLogQuery) (int, error)
	Export(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, error)
	GetActions(ctx context.Context, tenantID string) ([]string, error)
	GetResourceTypes(ctx context.Context, tenantID string) ([]string, error)
	GetLatest(ctx context.Context, tenantID string) (*models.AuditLog, error)
	VerifyChain(ctx context.Context, tenantID string) (int, bool, error)
	CoverageStats(ctx context.Context, tenantID string) (models.AuditCoverageStats, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
