package repository

import (
	"context"
	"orion/platform-svc-go/internal/branch-policy/models"
)

// RepositoryInterface defines the data access contract for the branch-policy module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error

	// P0-MB Phase 1 — BranchProfile (L1) + BuildArtifact (L3)
	CreateBranchProfile(ctx context.Context, p *models.BranchProfile) error
	GetBranchProfile(ctx context.Context, tenantID, id string) (*models.BranchProfile, error)
	ListBranchProfiles(ctx context.Context, tenantID string, q models.BranchProfileQuery) ([]models.BranchProfile, error)
	UpdateBranchProfile(ctx context.Context, tenantID, id string, p *models.BranchProfile) (*models.BranchProfile, error)
	CreateBuildArtifact(ctx context.Context, a *models.BuildArtifact) error
	GetBuildArtifact(ctx context.Context, tenantID, id string) (*models.BuildArtifact, error)
	ListBuildArtifacts(ctx context.Context, tenantID string, q models.ArtifactQuery) ([]models.BuildArtifact, error)
	UpdateBuildArtifact(ctx context.Context, tenantID, id string, a *models.BuildArtifact) (*models.BuildArtifact, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
