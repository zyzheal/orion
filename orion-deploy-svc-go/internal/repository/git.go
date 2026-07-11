package repository

import (
	"context"

	"orion-deploy-svc-go/internal/models"
	"orion/go-common/pkg/database"
)

// GitRepository handles git link and changelog operations.
type GitRepository struct {
	db *database.DB
}

func NewGitRepository(db *database.DB) *GitRepository {
	return &GitRepository{db: db}
}

// CreateLink inserts a git commit link.
func (r *GitRepository) CreateLink(ctx context.Context, tenantID string, link *models.GitLink) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO deployment_git_links
			(id, tenant_id, deployment_id, commit_sha, repo_url, branch, created_by, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
		link.ID, tenantID, link.DeploymentID, link.CommitSHA, link.RepoURL, link.Branch, link.CreatedBy,
	)
	return err
}

// GetLinksByDeployment returns all git links for a deployment.
func (r *GitRepository) GetLinksByDeployment(ctx context.Context, tenantID, deploymentID string) ([]models.GitLink, error) {
	var links []models.GitLink
	err := r.db.SelectContext(ctx, &links,
		`SELECT * FROM deployment_git_links
		 WHERE tenant_id = $1 AND deployment_id = $2
		 ORDER BY created_at DESC`, tenantID, deploymentID)
	return links, err
}

// GetChangelog returns the git changelog (via git_links joined with deployments) for a deployment.
func (r *GitRepository) GetChangelog(ctx context.Context, tenantID, deploymentID string) ([]models.GitLink, error) {
	var links []models.GitLink
	err := r.db.SelectContext(ctx, &links,
		`SELECT gl.*, d.app_name, d.environment
		 FROM deployment_git_links gl
		 JOIN deployments d ON d.id = gl.deployment_id
		 WHERE gl.deployment_id = $1 AND gl.tenant_id = $2 AND d.tenant_id = $2
		 ORDER BY gl.created_at DESC`, deploymentID, tenantID)
	return links, err
}
