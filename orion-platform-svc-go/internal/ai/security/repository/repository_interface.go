package repository

import (
	"context"
	"orion/platform-svc-go/internal/ai-security/models"
)


// RepositoryInterface defines the data access contract for the ai-security module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error
	FindVulnerabilities(ctx context.Context, tenantID string, image string) (*models.ScanVulnerabilitiesResult, error)
	GetVulnerability(ctx context.Context, tenantID, cveID string) (*models.Vulnerability, error)
	ListVulnerabilities(ctx context.Context, tenantID string) ([]models.Vulnerability, error)
	FixVulnerability(ctx context.Context, tenantID, image string, cveIDs []string) (*models.FixVulnerabilityResult, error)
	CheckVulnerability(ctx context.Context, tenantID, cveID string) (*models.CheckVulnerabilityResult, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
