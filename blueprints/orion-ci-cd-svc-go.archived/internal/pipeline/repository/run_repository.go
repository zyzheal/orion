package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/ci-cd-svc-go/internal/pipeline/models"

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
	query := `UPDATE pipeline_runs SET status = $1, completed_at = NOW(), duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

// CancelRun cancels a running pipeline run.
func (r *RunRepository) CancelRun(ctx context.Context, id string) error {
	query := `UPDATE pipeline_runs SET status = 'cancelled', completed_at = NOW(),
		duration_ms = CASE WHEN started_at IS NOT NULL THEN EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 ELSE 0 END
		WHERE id = $1 AND status IN ('pending', 'running')`
	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to cancel run: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("run not found or not in cancellable state")
	}
	return nil
}

// ListWithFilter lists runs with optional filtering by pipeline, tenant, status, trigger type.
func (r *RunRepository) ListWithFilter(ctx context.Context, filter models.PipelineRunFilter) ([]models.PipelineRun, int, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	if filter.PipelineID != "" {
		conditions = append(conditions, fmt.Sprintf("pipeline_id = $%d", argIdx))
		args = append(args, filter.PipelineID)
		argIdx++
	}
	if filter.TenantID != "" {
		conditions = append(conditions, fmt.Sprintf("tenant_id = $%d", argIdx))
		args = append(args, filter.TenantID)
		argIdx++
	}
	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, string(filter.Status))
		argIdx++
	}
	if filter.TriggerType != "" {
		conditions = append(conditions, fmt.Sprintf("trigger_type = $%d", argIdx))
		args = append(args, string(filter.TriggerType))
		argIdx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	limit := filter.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	// Count total
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM pipeline_runs %s", whereClause)
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, fmt.Errorf("failed to count runs: %w", err)
	}

	// Fetch page
	var runs []models.PipelineRun
	dataQuery := fmt.Sprintf(
		`SELECT id, pipeline_id, tenant_id, pipeline_version, trigger_type, trigger_by, environment, status, started_at, completed_at, duration_ms, context, created_at, updated_at
		 FROM pipeline_runs %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1,
	)
	args = append(args, limit, offset)
	if err := r.db.SelectContext(ctx, &runs, dataQuery, args...); err != nil {
		return nil, 0, fmt.Errorf("failed to list runs: %w", err)
	}

	return runs, total, nil
}

// GetRunLogs retrieves the logs for all stages in a run.
func (r *RunRepository) GetRunLogs(ctx context.Context, runID string) ([]models.RunLogEntry, error) {
	var entries []models.RunLogEntry
	query := `SELECT name AS stage_name, logs, status, started_at, completed_at
		FROM stages WHERE run_id = $1 ORDER BY sequence, created_at`
	err := r.db.SelectContext(ctx, &entries, query, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to get run logs: %w", err)
	}
	return entries, nil
}

// GetRunDuration returns the computed duration of a run in milliseconds.
func (r *RunRepository) GetRunDuration(ctx context.Context, runID string) (int64, error) {
	var durationMs int64
	query := `SELECT COALESCE(duration_ms, 0) FROM pipeline_runs WHERE id = $1`
	err := r.db.GetContext(ctx, &durationMs, query, runID)
	return durationMs, err
}

// SetRunContext updates the context JSONB field of a run.
func (r *RunRepository) SetRunContext(ctx context.Context, runID, runContext string) error {
	query := `UPDATE pipeline_runs SET context = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, runContext, runID)
	return err
}

// FindByStatus finds all runs with a given status.
func (r *RunRepository) FindByStatus(ctx context.Context, status string) ([]models.PipelineRun, error) {
	var runs []models.PipelineRun
	query := `SELECT id, pipeline_id, tenant_id, pipeline_version, trigger_type, trigger_by, environment, status, started_at, completed_at, duration_ms, context, created_at, updated_at
		FROM pipeline_runs WHERE status = $1 ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &runs, query, status)
	return runs, err
}

// ListByTenant lists runs for a tenant with pagination.
func (r *RunRepository) ListByTenant(ctx context.Context, tenantID string, offset, limit int) ([]models.PipelineRun, error) {
	var runs []models.PipelineRun
	query := `SELECT id, pipeline_id, tenant_id, pipeline_version, trigger_type, trigger_by, environment, status, started_at, completed_at, duration_ms, context, created_at, updated_at
		FROM pipeline_runs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &runs, query, tenantID, limit, offset)
	return runs, err
}

// UpdateStatusWithDuration updates run status with explicit duration calculation.
func (r *RunRepository) UpdateStatusWithDuration(ctx context.Context, id, status string, startedAt, completedAt *time.Time) error {
	var durationMs int64
	if startedAt != nil && completedAt != nil {
		durationMs = completedAt.Sub(*startedAt).Milliseconds()
	}
	query := `UPDATE pipeline_runs SET status = $1, started_at = $2, completed_at = $3, duration_ms = $4, updated_at = NOW() WHERE id = $5`
	_, err := r.db.ExecContext(ctx, query, status, startedAt, completedAt, durationMs, id)
	return err
}

// FinalizeRun marks a pipeline run as completed with the given status and duration.
func (r *RunRepository) FinalizeRun(ctx context.Context, id, status string, durationMs int64) error {
	query := `UPDATE pipeline_runs SET status = $1, completed_at = NOW(), duration_ms = $2, updated_at = NOW() WHERE id = $3`
	_, err := r.db.ExecContext(ctx, query, status, durationMs, id)
	return err
}
