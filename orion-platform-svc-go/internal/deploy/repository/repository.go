package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/deploy/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- CRUD ---

func (r *Repository) Create(ctx context.Context, m *models.Deployment) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	now := time.Now().UTC()
	m.StartedAt = &now
	query := `INSERT INTO deployments (id, tenant_id, app_name, environment, status, version, commit_sha,
		started_at, completed_at, created_at, updated_at)
		VALUES (:id, :tenant_id, :app_name, :environment, :status, :version, :commit_sha,
		:started_at, :completed_at, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	var m models.Deployment
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM deployments WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.Deployment, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Deployment
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM deployments WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE deployments SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		status, id, tenantID)
	return err
}

func (r *Repository) CompleteDeployment(ctx context.Context, tenantID, id, status string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE deployments SET status=$1, completed_at=$2, updated_at=NOW() WHERE id=$3 AND tenant_id=$4`,
		status, now, id, tenantID)
	return err
}

// LatestByApp returns the most recent deployment for a given app and environment.
func (r *Repository) LatestByApp(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error) {
	var m models.Deployment
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM deployments WHERE tenant_id=$1 AND app_name=$2 AND environment=$3
		ORDER BY created_at DESC LIMIT 1`,
		tenantID, appName, environment)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// Metrics returns deployment counts per status for the tenant.
func (r *Repository) Metrics(ctx context.Context, tenantID string) (*models.DeploymentMetrics, error) {
	var m models.DeploymentMetrics
	err := r.db.GetContext(ctx, &m,
		`SELECT
			COUNT(*) AS total,
			SUM(CASE WHEN status='succeeded' THEN 1 ELSE 0 END) AS succeeded,
			SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
			SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) AS running,
			SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled,
			SUM(CASE WHEN status='rollback' THEN 1 ELSE 0 END) AS rollback
		FROM deployments WHERE tenant_id=$1`,
		tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// --- Rollbacks ---

func (r *Repository) CreateRollback(ctx context.Context, tenantID, deploymentID, fromVersion, toVersion, reason string) (*models.Rollback, error) {
	rb := &models.Rollback{
		ID:           uuid.New().String(),
		DeploymentID: deploymentID,
		FromVersion:  fromVersion,
		ToVersion:    toVersion,
		Status:       "pending",
		Reason:       reason,
		CreatedAt:    time.Now().UTC(),
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO rollback_records (id, deployment_id, from_version, to_version, status, reason, created_at)
		VALUES (:id, :deployment_id, :from_version, :to_version, :status, :reason, :created_at)`,
		rb)
	return rb, err
}

func (r *Repository) ListRollbacks(ctx context.Context, tenantID, deploymentID string) ([]models.Rollback, error) {
	var items []models.Rollback
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM rollback_records WHERE deployment_id=$1 AND deployment_id IN
			(SELECT id FROM deployments WHERE tenant_id=$2)
		ORDER BY created_at DESC`,
		deploymentID, tenantID)
	return items, err
}

// --- Audit trail ---

func (r *Repository) CreateAuditEntry(ctx context.Context, deploymentID, action, userID, details string) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO deployment_audit_logs (id, deployment_id, action, user_id, details, created_at)
		VALUES (:id, :deployment_id, :action, :user_id, :details, :created_at)`,
		map[string]interface{}{
			"id":            uuid.New().String(),
			"deployment_id": deploymentID,
			"action":        action,
			"user_id":       userID,
			"details":       details,
			"created_at":    time.Now().UTC(),
		})
	return err
}

func (r *Repository) ListAuditEntries(ctx context.Context, tenantID, deploymentID string) ([]models.AuditEntry, error) {
	var items []models.AuditEntry
	err := r.db.SelectContext(ctx, &items,
		`SELECT dal.* FROM deployment_audit_logs dal
			INNER JOIN deployments d ON dal.deployment_id = d.id
			WHERE dal.deployment_id=$1 AND d.tenant_id=$2
			ORDER BY dal.created_at DESC`,
		deploymentID, tenantID)
	return items, err
}

// --- Release notes ---

func (r *Repository) CreateReleaseNote(ctx context.Context, tenantID, deploymentID, content string) (*models.ReleaseNote, error) {
	rn := &models.ReleaseNote{
		ID:           uuid.New().String(),
		DeploymentID: deploymentID,
		Content:      content,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO deployment_release_notes (id, deployment_id, content, created_at, updated_at)
		VALUES (:id, :deployment_id, :content, :created_at, :updated_at)`,
		rn)
	return rn, err
}

func (r *Repository) GetReleaseNotes(ctx context.Context, tenantID, deploymentID string) (*models.ReleaseNote, error) {
	var rn models.ReleaseNote
	err := r.db.GetContext(ctx, &rn,
		`SELECT drn.* FROM deployment_release_notes drn
			INNER JOIN deployments d ON drn.deployment_id = d.id
			WHERE drn.deployment_id=$1 AND d.tenant_id=$2
			ORDER BY drn.created_at DESC LIMIT 1`,
		deploymentID, tenantID)
	if err != nil {
		return nil, err
	}
	return &rn, nil
}

func (r *Repository) ListReleaseNotesByTenant(ctx context.Context, tenantID string) ([]models.ReleaseNote, error) {
	var items []models.ReleaseNote
	err := r.db.SelectContext(ctx, &items,
		`SELECT drn.* FROM deployment_release_notes drn
			INNER JOIN deployments d ON drn.deployment_id = d.id
			WHERE d.tenant_id=$1 ORDER BY drn.created_at DESC`,
		tenantID)
	return items, err
}

// --- Git integration ---

func (r *Repository) LinkGitCommit(ctx context.Context, deploymentID, commitSHA, branch string) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO deployment_git_links (id, deployment_id, commit_sha, branch, created_at)
		VALUES (:id, :deployment_id, :commit_sha, :branch, :created_at)
		ON CONFLICT (deployment_id) DO UPDATE SET commit_sha=EXCLUDED.commit_sha, branch=EXCLUDED.branch`,
		map[string]interface{}{
			"id":            uuid.New().String(),
			"deployment_id": deploymentID,
			"commit_sha":    commitSHA,
			"branch":        branch,
			"created_at":    time.Now().UTC(),
		})
	return err
}

func (r *Repository) ListChangelog(ctx context.Context, tenantID, deploymentID string) ([]models.GitChangelogEntry, error) {
	var items []models.GitChangelogEntry
	err := r.db.SelectContext(ctx, &items,
		`SELECT dc.commit_sha, dc.message, dc.author, dc.created_at FROM deployment_changelog dc
			INNER JOIN deployments d ON dc.deployment_id = d.id
			WHERE dc.deployment_id=$1 AND d.tenant_id=$2
			ORDER BY dc.created_at DESC`,
		deploymentID, tenantID)
	return items, err
}

// NotFound returns the canonical not-found error.
func NotFound(id string) error {
	return fmt.Errorf("deployment %q not found", id)
}
