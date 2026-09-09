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

	// P0-MB Phase 2 — NamespaceBinding (L2)
	CreateNamespaceBinding(ctx context.Context, b *models.NamespaceBinding) error
	GetNamespaceBinding(ctx context.Context, tenantID, id string) (*models.NamespaceBinding, error)
	GetNamespaceBindingByBranchEnv(ctx context.Context, tenantID, branchProfileID, envName string) (*models.NamespaceBinding, error)
	ListNamespaceBindings(ctx context.Context, tenantID string, q models.NamespaceBindingQuery) ([]models.NamespaceBinding, error)
	DeleteNamespaceBinding(ctx context.Context, tenantID, id string) error

	// P0-MB Phase 3 — SyncPolicy (L4) + SyncRunLog
	CreateSyncPolicy(ctx context.Context, p *models.SyncPolicy) error
	GetSyncPolicy(ctx context.Context, tenantID, id string) (*models.SyncPolicy, error)
	ListSyncPolicies(ctx context.Context, tenantID string, q models.SyncPolicyQuery) ([]models.SyncPolicy, error)
	UpdateSyncPolicy(ctx context.Context, tenantID, id string, p *models.SyncPolicy) (*models.SyncPolicy, error)
	DeleteSyncPolicy(ctx context.Context, tenantID, id string) error
	CreateSyncRunLog(ctx context.Context, l *models.SyncRunLog) error
	UpdateSyncRunLog(ctx context.Context, tenantID, id string, l *models.SyncRunLog) (*models.SyncRunLog, error)
	ListSyncRunLogs(ctx context.Context, tenantID string, q models.SyncRunLogQuery) ([]models.SyncRunLog, error)

	// P0-MB Phase 4 — DeployEvent (L5) + rollback + audit trail
	CreateDeployEvent(ctx context.Context, evt *models.DeployEvent) error
	GetDeployEvent(ctx context.Context, tenantID, id string) (*models.DeployEvent, error)
	UpdateDeployEvent(ctx context.Context, tenantID, id string, evt *models.DeployEvent) (*models.DeployEvent, error)
	ListDeployEvents(ctx context.Context, tenantID string, q models.DeployEventQuery) ([]models.DeployEvent, error)
	ListDeployEventsByBranch(ctx context.Context, tenantID, branch string, limit int) ([]models.DeployEvent, error)
	ListDeployEventsByEnv(ctx context.Context, tenantID, env string, limit int) ([]models.DeployEvent, error)
	ListDeployEventsByActor(ctx context.Context, tenantID, actorID string, limit int) ([]models.DeployEvent, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
