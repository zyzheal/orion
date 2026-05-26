package repository

import (
	"context"
	"fmt"
	"orion/pipeline-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type RunRepository struct {
	db *sqlx.DB
}

func NewRunRepository(db *sqlx.DB) *RunRepository {
	return &RunRepository{db: db}
}

func (r *RunRepository) Create(ctx context.Context, run *models.PipelineRun) error {
	query := `
		INSERT INTO pipeline_runs (pipeline_id, trigger_type, trigger_by, status, context)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`
	err := r.db.QueryRowContext(ctx, query,
		run.PipelineID, run.TriggerType, run.TriggerBy, run.Status, run.Context,
	).Scan(&run.ID, &run.CreatedAt)
	return err
}

func (r *RunRepository) GetByID(ctx context.Context, id string) (*models.PipelineRun, error) {
	var run models.PipelineRun
	query := `SELECT id, pipeline_id, trigger_type, trigger_by, status, started_at, completed_at, context, created_at FROM pipeline_runs WHERE id = $1`
	err := r.db.GetContext(ctx, &run, query, id)
	if err != nil {
		return nil, fmt.Errorf("run not found: %w", err)
	}
	return &run, nil
}

func (r *RunRepository) ListByPipeline(ctx context.Context, pipelineID string, offset, limit int) ([]models.PipelineRun, error) {
	var runs []models.PipelineRun
	query := `SELECT id, pipeline_id, trigger_type, trigger_by, status, started_at, completed_at, context, created_at FROM pipeline_runs WHERE pipeline_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &runs, query, pipelineID, limit, offset)
	if err != nil {
		return nil, err
	}
	return runs, nil
}

func (r *RunRepository) UpdateStatus(ctx context.Context, id, status string) error {
	query := `UPDATE pipeline_runs SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

func (r *RunRepository) MarkStarted(ctx context.Context, id string) error {
	query := `UPDATE pipeline_runs SET status = 'running', started_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *RunRepository) MarkCompleted(ctx context.Context, id, status string) error {
	query := `UPDATE pipeline_runs SET status = $1, completed_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}
