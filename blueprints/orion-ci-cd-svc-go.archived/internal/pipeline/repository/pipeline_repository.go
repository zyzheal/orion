package repository

import (
	"context"
	"fmt"
	"orion/ci-cd-svc-go/internal/pipeline/models"

	"github.com/jmoiron/sqlx"
)

type PipelineRepository struct {
	db *sqlx.DB
}

func NewPipelineRepository(db *sqlx.DB) *PipelineRepository {
	return &PipelineRepository{db: db}
}

func (r *PipelineRepository) Create(ctx context.Context, p *models.Pipeline) error {
	query := `
		INSERT INTO pipelines (tenant_id, name, repo_id, branch, trigger_type, cron_expression, yaml_config, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at
	`
	err := r.db.QueryRowContext(ctx, query,
		p.TenantID, p.Name, p.RepoID, p.Branch, p.TriggerType, p.CronExpression, p.YAMLConfig, p.Status,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
	return err
}

func (r *PipelineRepository) GetByID(ctx context.Context, tenantID, id string) (*models.Pipeline, error) {
	var p models.Pipeline
	query := `SELECT id, tenant_id, name, repo_id, branch, trigger_type, cron_expression, yaml_config, status, created_at, updated_at FROM pipelines WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`
	err := r.db.GetContext(ctx, &p, query, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("pipeline not found: %w", err)
	}
	return &p, nil
}

func (r *PipelineRepository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Pipeline, error) {
	var pipelines []models.Pipeline
	query := `SELECT id, tenant_id, name, repo_id, branch, trigger_type, cron_expression, yaml_config, status, created_at, updated_at FROM pipelines WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &pipelines, query, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return pipelines, nil
}

func (r *PipelineRepository) Update(ctx context.Context, p *models.Pipeline) error {
	query := `
		UPDATE pipelines SET name = $1, repo_id = $2, branch = $3, trigger_type = $4, cron_expression = $5, yaml_config = $6, status = $7, updated_at = NOW()
		WHERE id = $8 AND tenant_id = $9
	`
	_, err := r.db.ExecContext(ctx, query, p.Name, p.RepoID, p.Branch, p.TriggerType, p.CronExpression, p.YAMLConfig, p.Status, p.ID, p.TenantID)
	return err
}

func (r *PipelineRepository) Delete(ctx context.Context, tenantID, id string) error {
	query := `UPDATE pipelines SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, tenantID)
	return err
}

func (r *PipelineRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM pipelines WHERE tenant_id=$1 AND deleted_at IS NULL`, tenantID)
	return count, err
}

// GetStats returns aggregate run statistics for a pipeline.
func (r *PipelineRepository) GetStats(ctx context.Context, pipelineID string) (*models.PipelineStats, error) {
	var stats models.PipelineStats
	query := `
		SELECT
			COUNT(*)::int AS total_runs,
			COUNT(CASE WHEN status = 'success' THEN 1 END)::int AS success_runs,
			COUNT(CASE WHEN status = 'failed' THEN 1 END)::int AS failed_runs,
			COUNT(CASE WHEN status = 'running' THEN 1 END)::int AS running_runs,
			COALESCE(AVG(CASE WHEN duration_ms > 0 THEN duration_ms END), 0)::float AS avg_duration
		FROM pipeline_runs
		WHERE pipeline_id = $1
	`
	err := r.db.GetContext(ctx, &stats, query, pipelineID)
	if err != nil {
		return nil, fmt.Errorf("failed to get pipeline stats: %w", err)
	}
	return &stats, nil
}

// Search searches pipelines by name within a tenant.
func (r *PipelineRepository) Search(ctx context.Context, tenantID, name string, offset, limit int) ([]models.Pipeline, error) {
	var pipelines []models.Pipeline
	query := `SELECT id, tenant_id, name, description, repo_id, branch, trigger_type, cron_expression, yaml_config, status, created_at, updated_at
		FROM pipelines
		WHERE tenant_id = $1 AND deleted_at IS NULL AND name ILIKE '%' || $2 || '%'
		ORDER BY created_at DESC LIMIT $3 OFFSET $4`
	err := r.db.SelectContext(ctx, &pipelines, query, tenantID, name, limit, offset)
	if err != nil {
		return nil, err
	}
	return pipelines, nil
}
