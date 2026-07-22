package repository

import (
	"context"
	"orion/platform-svc-go/internal/deploy/models"
)


// RepositoryInterface defines the data access contract for the deploy module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.Deployment) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Deployment, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.Deployment, error)
	UpdateStatus(ctx context.Context, tenantID, id, status string) error
	CompleteDeployment(ctx context.Context, tenantID, id, status string) error
	LatestByApp(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error)
	Metrics(ctx context.Context, tenantID string) (*models.DeploymentMetrics, error)
	CreateRollback(ctx context.Context, tenantID, deploymentID, fromVersion, toVersion, reason string) (*models.Rollback, error)
	ListRollbacks(ctx context.Context, tenantID, deploymentID string) ([]models.Rollback, error)
	CreateAuditEntry(ctx context.Context, deploymentID, action, userID, details string) error
	ListAuditEntries(ctx context.Context, tenantID, deploymentID string) ([]models.AuditEntry, error)
	CreateReleaseNote(ctx context.Context, tenantID, deploymentID, content string) (*models.ReleaseNote, error)
	GetReleaseNotes(ctx context.Context, tenantID, deploymentID string) (*models.ReleaseNote, error)
	ListReleaseNotesByTenant(ctx context.Context, tenantID string) ([]models.ReleaseNote, error)
	LinkGitCommit(ctx context.Context, deploymentID, commitSHA, branch string) error
	ListChangelog(ctx context.Context, tenantID, deploymentID string) ([]models.GitChangelogEntry, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
