package repository

import (
	"context"
	"fmt"
	"time"

	"orion/ci-cd-svc-go/internal/pipeline/models"

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
		INSERT INTO stages (run_id, name, sequence, status, depends_on, timeout_seconds, max_retries)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	err := r.db.QueryRowContext(ctx, query,
		stage.RunID, stage.Name, stage.Sequence, stage.Status, stage.DependsOn, stage.TimeoutSeconds, stage.MaxRetries,
	).Scan(&stage.ID, &stage.CreatedAt)
	return err
}

func (r *StageRepository) GetByID(ctx context.Context, id string) (*models.Stage, error) {
	var stage models.Stage
	query := `SELECT id, run_id, name, sequence, status, depends_on, timeout_seconds, retry_count, max_retries, logs, started_at, completed_at, created_at FROM stages WHERE id = $1`
	err := r.db.GetContext(ctx, &stage, query, id)
	if err != nil {
		return nil, fmt.Errorf("stage not found: %w", err)
	}
	return &stage, nil
}

func (r *StageRepository) GetByRunID(ctx context.Context, runID string) ([]models.Stage, error) {
	var stages []models.Stage
	query := `SELECT id, run_id, name, sequence, status, depends_on, timeout_seconds, retry_count, max_retries, logs, started_at, completed_at, created_at FROM stages WHERE run_id = $1 ORDER BY sequence, created_at`
	err := r.db.SelectContext(ctx, &stages, query, runID)
	if err != nil {
		return nil, fmt.Errorf("stages not found: %w", err)
	}
	return stages, nil
}

// UpdateStatus updates the status of a stage.
func (r *StageRepository) UpdateStatus(ctx context.Context, id string, status models.StageStatus) error {
	query := `UPDATE stages SET status = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

// MarkRunning marks a stage as running with a start timestamp.
func (r *StageRepository) MarkRunning(ctx context.Context, id string) error {
	query := `UPDATE stages SET status = 'running', started_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// MarkCompleted marks a stage as completed with the given final status.
func (r *StageRepository) MarkCompleted(ctx context.Context, id string, status models.StageStatus) error {
	query := `UPDATE stages SET status = $1, completed_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

// AppendLog appends text to a stage's log field.
func (r *StageRepository) AppendLog(ctx context.Context, id, logLine string) error {
	query := `UPDATE stages SET logs = COALESCE(logs, '') || $1 || E'\n' WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, logLine, id)
	return err
}

// SetLog sets the log field of a stage (overwrites).
func (r *StageRepository) SetLog(ctx context.Context, id, logs string) error {
	query := `UPDATE stages SET logs = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, logs, id)
	return err
}

// IncrementRetry increments the retry_count of a stage.
func (r *StageRepository) IncrementRetry(ctx context.Context, id string) error {
	query := `UPDATE stages SET retry_count = retry_count + 1 WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// GetPendingStages returns all pending stages for a run.
func (r *StageRepository) GetPendingStages(ctx context.Context, runID string) ([]models.Stage, error) {
	var stages []models.Stage
	query := `SELECT id, run_id, name, sequence, status, depends_on, timeout_seconds, retry_count, max_retries, logs, started_at, completed_at, created_at
		FROM stages WHERE run_id = $1 AND status = 'pending' ORDER BY sequence`
	err := r.db.SelectContext(ctx, &stages, query, runID)
	return stages, err
}

// GetStagesByStatus returns all stages for a run with a given status.
func (r *StageRepository) GetStagesByStatus(ctx context.Context, runID string, status models.StageStatus) ([]models.Stage, error) {
	var stages []models.Stage
	query := `SELECT id, run_id, name, sequence, status, depends_on, timeout_seconds, retry_count, max_retries, logs, started_at, completed_at, created_at
		FROM stages WHERE run_id = $1 AND status = $2 ORDER BY sequence`
	err := r.db.SelectContext(ctx, &stages, query, runID, status)
	return stages, err
}

// HasFailedStages checks if any stage in a run has failed.
func (r *StageRepository) HasFailedStages(ctx context.Context, runID string) (bool, error) {
	var count int
	query := `SELECT COUNT(*) FROM stages WHERE run_id = $1 AND status = 'failed'`
	err := r.db.GetContext(ctx, &count, query, runID)
	return count > 0, err
}

// AllStagesCompleted checks if all stages in a run have completed (success, failed, or skipped).
func (r *StageRepository) AllStagesCompleted(ctx context.Context, runID string) (bool, error) {
	var pending int
	query := `SELECT COUNT(*) FROM stages WHERE run_id = $1 AND status IN ('pending', 'running')`
	err := r.db.GetContext(ctx, &pending, query, runID)
	return pending == 0, err
}

// UpdateStageStatusWithTiming updates a stage's status with explicit timing.
func (r *StageRepository) UpdateStageStatusWithTiming(ctx context.Context, id string, status models.StageStatus, startedAt, completedAt *time.Time) error {
	query := `UPDATE stages SET status = $1, started_at = $2, completed_at = $3 WHERE id = $4`
	_, err := r.db.ExecContext(ctx, query, status, startedAt, completedAt, id)
	return err
}

func (r *StageRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM stages WHERE id=$1`, id)
	return err
}

func (r *StageRepository) Count(ctx context.Context, runID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM stages WHERE run_id=$1`, runID)
	return count, err
}
