package repository

import (
	"context"
	"fmt"
	"orion/pipeline-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type StageRepository struct {
	db *sqlx.DB
}

func NewStageRepository(db *sqlx.DB) *StageRepository {
	return &StageRepository{db: db}
}

func (r *StageRepository) Create(ctx context.Context, stage *models.Stage) error {
	query := `
		INSERT INTO pipeline_stages (run_id, name, status, logs)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`
	err := r.db.QueryRowContext(ctx, query,
		stage.RunID, stage.Name, stage.Status, stage.Logs,
	).Scan(&stage.ID)
	return err
}

func (r *StageRepository) GetByRunID(ctx context.Context, runID string) ([]models.Stage, error) {
	var stages []models.Stage
	query := `SELECT id, run_id, name, status, started_at, completed_at, logs FROM pipeline_stages WHERE run_id = $1 ORDER BY id`
	err := r.db.SelectContext(ctx, &stages, query, runID)
	if err != nil {
		return nil, fmt.Errorf("stages not found: %w", err)
	}
	return stages, nil
}

func (r *StageRepository) UpdateStatus(ctx context.Context, id, status string) error {
	query := `UPDATE pipeline_stages SET status = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

func (r *StageRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM pipeline_stages WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *StageRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM pipeline_stages WHERE tenant_id=$1`, tenantID)
	return count, err
}
