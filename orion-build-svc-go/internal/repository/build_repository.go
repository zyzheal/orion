package repository

import (
	"context"
	"fmt"
	"orion/build-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type BuildRepository struct {
	db *sqlx.DB
}

func NewBuildRepository(db *sqlx.DB) *BuildRepository {
	return &BuildRepository{db: db}
}

func (r *BuildRepository) Create(ctx context.Context, b *models.Build) error {
	query := `
		INSERT INTO builds (tenant_id, repo_id, branch, commit_sha, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`
	err := r.db.QueryRowContext(ctx, query,
		b.TenantID, b.RepoID, b.Branch, b.CommitSHA, b.Status,
	).Scan(&b.ID, &b.CreatedAt)
	return err
}

func (r *BuildRepository) GetByID(ctx context.Context, tenantID, id string) (*models.Build, error) {
	var b models.Build
	query := `SELECT id, tenant_id, repo_id, branch, commit_sha, status, started_at, completed_at, logs, created_at FROM builds WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &b, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("build not found: %w", err)
	}
	return &b, nil
}

func (r *BuildRepository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Build, error) {
	var builds []models.Build
	query := `SELECT id, tenant_id, repo_id, branch, commit_sha, status, started_at, completed_at, logs, created_at FROM builds WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &builds, query, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return builds, nil
}

func (r *BuildRepository) Update(ctx context.Context, b *models.Build) error {
	query := `
		UPDATE builds SET repo_id = $1, branch = $2, commit_sha = $3, status = $4, started_at = $5, completed_at = $6, logs = $7
		WHERE id = $8 AND tenant_id = $9
	`
	_, err := r.db.ExecContext(ctx, query, b.RepoID, b.Branch, b.CommitSHA, b.Status, b.StartedAt, b.CompletedAt, b.Logs, b.ID, b.TenantID)
	return err
}

func (r *BuildRepository) UpdateStatus(ctx context.Context, tenantID, id, status string) error {
	query := `UPDATE builds SET status = $1 WHERE id = $2 AND tenant_id = $3`
	_, err := r.db.ExecContext(ctx, query, status, id, tenantID)
	return err
}

func (r *BuildRepository) Delete(ctx context.Context, tenantID, id string) error {
	query := `DELETE FROM builds WHERE id = $1 AND tenant_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, tenantID)
	return err
}

func (r *BuildRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM builds WHERE tenant_id=$1`, tenantID)
	return count, err
}
