package repository

import (
	"context"
	"orion/platform-svc-go/internal/artifact-ops/models"
)


// RepositoryInterface defines the data access contract for the artifact-ops module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateOperation(ctx context.Context, op *models.ArtifactOperation) error
	ListOperationsByArtifact(ctx context.Context, tenantID, artifactID string, limit, offset int) ([]models.ArtifactOperation, error)
	GetArtifactStats(ctx context.Context, tenantID, artifactID string) (*models.ArtifactStats, error)
	CreateScan(ctx context.Context, scan *models.ArtifactScan) error
	GetScanByID(ctx context.Context, tenantID, id string) (*models.ArtifactScan, error)
	ListScansByArtifact(ctx context.Context, tenantID, artifactID string) ([]models.ArtifactScan, error)
	UpdateScanStatus(ctx context.Context, tenantID, id, status, reportID, error string) error
	CreateScanReport(ctx context.Context, report *models.ScanReport) error
	GetScanReportByID(ctx context.Context, tenantID, id string) (*models.ScanReport, error)
	GetScanReportsByArtifact(ctx context.Context, tenantID, artifactID string) ([]models.ScanReport, error)
	CreatePolicy(ctx context.Context, policy *models.RetentionPolicy) error
	ListPolicies(ctx context.Context, tenantID string) ([]models.RetentionPolicy, error)
	GetPolicyByID(ctx context.Context, tenantID, id string) (*models.RetentionPolicy, error)
	DeletePolicy(ctx context.Context, tenantID, id string) error
	UpdatePolicyEnabled(ctx context.Context, tenantID, id string, enabled bool) error
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
