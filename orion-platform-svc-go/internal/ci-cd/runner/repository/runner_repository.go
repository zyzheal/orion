package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"orion/platform-svc-go/internal/ci-cd/runner/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides data access for all runner-svc entities.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ==================== Runner CRUD ====================

// Create inserts a new runner record.
func (r *Repository) Create(ctx context.Context, d *models.Runner) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO runners (id, tenant_id, name, type, status, endpoint, capacity, max_concurrent, current_jobs, labels, metadata, last_heartbeat)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		d.ID, d.TenantID, d.Name, d.Type, d.Status, d.Endpoint,
		d.Capacity, d.MaxConcurrent, d.CurrentJobs,
		d.Labels, d.Metadata, d.LastHeartbeat,
	)
	return err
}

// List returns runners for a tenant with pagination.
func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Runner, error) {
	var items []models.Runner
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM runners WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit,
	)
	return items, err
}

// GetByID returns a runner by ID, scoped to a tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Runner, error) {
	var d models.Runner
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM runners WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// FindByID returns a runner by ID without tenant filter (for internal use).
func (r *Repository) FindByID(ctx context.Context, id string) (*models.Runner, error) {
	var d models.Runner
	err := r.db.GetContext(ctx, &d, `SELECT * FROM runners WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// Delete removes a runner and its associated jobs.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	// Delete associated jobs first (cascade should handle it, but be explicit)
	_, _ = r.db.ExecContext(ctx, `DELETE FROM runner_jobs WHERE runner_id=$1`, id)
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM runners WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	return err
}

// Count returns the total number of runners for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM runners WHERE tenant_id=$1`, tenantID,
	)
	return count, err
}

// FindByStatus returns all runners with the given status.
func (r *Repository) FindByStatus(ctx context.Context, status string) ([]models.Runner, error) {
	var items []models.Runner
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM runners WHERE status=$1 ORDER BY last_heartbeat DESC`, status,
	)
	return items, err
}

// FindByLabels returns runners for a tenant that have ALL of the requested labels.
func (r *Repository) FindByLabels(ctx context.Context, tenantID string, labels []string) ([]models.Runner, error) {
	labelsJSON, err := json.Marshal(labels)
	if err != nil {
		return nil, err
	}
	var items []models.Runner
	err = r.db.SelectContext(ctx, &items,
		`SELECT * FROM runners WHERE tenant_id=$1 AND labels @> $2 ORDER BY last_heartbeat DESC`,
		tenantID, string(labelsJSON),
	)
	return items, err
}

// FindAvailableForTenant returns runners that are online and have capacity.
func (r *Repository) FindAvailableForTenant(ctx context.Context, tenantID string) ([]models.Runner, error) {
	var items []models.Runner
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM runners
		 WHERE tenant_id=$1 AND status='online' AND current_jobs < max_concurrent
		 ORDER BY (max_concurrent - current_jobs) DESC, last_heartbeat DESC`,
		tenantID,
	)
	return items, err
}

// Update modifies a runner's mutable fields.
func (r *Repository) Update(ctx context.Context, id string, req *models.UpdateRunnerRequest) (*models.Runner, error) {
	// Build dynamic SET clause
	setClauses := []string{}
	args := []interface{}{}
	idx := 2 // $1 is reserved for id

	if req.Status != nil {
		setClauses = append(setClauses, "status=$"+itoa(idx))
		args = append(args, *req.Status)
		idx++
	}
	if req.Endpoint != nil {
		setClauses = append(setClauses, "endpoint=$"+itoa(idx))
		args = append(args, *req.Endpoint)
		idx++
	}
	if req.MaxConcurrent != nil {
		setClauses = append(setClauses, "max_concurrent=$"+itoa(idx))
		args = append(args, *req.MaxConcurrent)
		idx++
	}
	if req.Labels != nil {
		labelsJSON, err := json.Marshal(req.Labels)
		if err != nil {
			return nil, err
		}
		setClauses = append(setClauses, "labels=$"+itoa(idx))
		args = append(args, string(labelsJSON))
		idx++
	}
	if req.Metadata != nil {
		metadataJSON, err := json.Marshal(req.Metadata)
		if err != nil {
			return nil, err
		}
		setClauses = append(setClauses, "metadata=$"+itoa(idx))
		args = append(args, string(metadataJSON))
		idx++
	}

	if len(setClauses) == 0 {
		return r.FindByID(ctx, id)
	}

	setClauses = append(setClauses, "updated_at=NOW()")

	query := "UPDATE runners SET "
	for i, clause := range setClauses {
		if i > 0 {
			query += ", "
		}
		query += clause
	}
	query += " WHERE id=$1 RETURNING *"

	args = append([]interface{}{id}, args...)

	var d models.Runner
	err := r.db.GetContext(ctx, &d, query, args...)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// UpdateHeartbeat refreshes the last_heartbeat timestamp for a runner.
func (r *Repository) UpdateHeartbeat(ctx context.Context, id string) (*models.Runner, error) {
	var d models.Runner
	err := r.db.GetContext(ctx, &d,
		`UPDATE runners SET last_heartbeat=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`, id,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// IncrementJobs increments current_jobs and sets status to 'busy' if at capacity.
func (r *Repository) IncrementJobs(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE runners SET
		 current_jobs = current_jobs + 1,
		 status = CASE WHEN current_jobs + 1 >= max_concurrent THEN 'busy' ELSE status END,
		 updated_at = NOW()
		 WHERE id = $1`, id,
	)
	return err
}

// DecrementJobs decrements current_jobs (minimum 0) and resets status to 'online' when idle.
func (r *Repository) DecrementJobs(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE runners SET
		 current_jobs = GREATEST(current_jobs - 1, 0),
		 status = CASE WHEN GREATEST(current_jobs - 1, 0) = 0 THEN 'online' ELSE status END,
		 updated_at = NOW()
		 WHERE id = $1`, id,
	)
	return err
}

// ==================== PipelineRun CRUD ====================

// CreateRun inserts a new pipeline run.
func (r *Repository) CreateRun(ctx context.Context, run *models.PipelineRun) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO pipeline_runs (id, tenant_id, pipeline_id, trigger_type, trigger_by, status, environment_name, config_snapshot)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		run.ID, run.TenantID, run.PipelineID, run.TriggerType, run.TriggerBy,
		run.Status, run.EnvironmentName, run.ConfigSnapshot,
	)
	return err
}

// GetRunByID returns a pipeline run by ID.
func (r *Repository) GetRunByID(ctx context.Context, id string) (*models.PipelineRun, error) {
	var run models.PipelineRun
	err := r.db.GetContext(ctx, &run, `SELECT * FROM pipeline_runs WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &run, nil
}

// ListRuns returns pipeline runs with optional filters.
func (r *Repository) ListRuns(ctx context.Context, tenantID string, filter *models.RunListFilter) ([]models.PipelineRun, error) {
	query := `SELECT * FROM pipeline_runs WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	idx := 2

	if filter != nil && filter.PipelineID != "" {
		query += " AND pipeline_id=$" + itoa(idx)
		args = append(args, filter.PipelineID)
		idx++
	}
	if filter != nil && filter.Status != "" {
		query += " AND status=$" + itoa(idx)
		args = append(args, filter.Status)
		idx++
	}
	if filter != nil && filter.TriggerType != "" {
		query += " AND trigger_type=$" + itoa(idx)
		args = append(args, filter.TriggerType)
		idx++
	}

	query += " ORDER BY created_at DESC"

	if filter != nil && filter.Limit > 0 {
		query += " LIMIT $" + itoa(idx)
		args = append(args, filter.Limit)
		idx++
	}
	if filter != nil && filter.Offset > 0 {
		query += " OFFSET $" + itoa(idx)
		args = append(args, filter.Offset)
		idx++
	}

	var items []models.PipelineRun
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// ListRunsByStatus returns all runs with a specific status (for crash recovery).
func (r *Repository) ListRunsByStatus(ctx context.Context, status string) ([]models.PipelineRun, error) {
	var items []models.PipelineRun
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM pipeline_runs WHERE status=$1 ORDER BY created_at DESC`, status,
	)
	return items, err
}

// UpdateRunStatus updates a pipeline run's status and related timestamps.
func (r *Repository) UpdateRunStatus(ctx context.Context, id, status string, startedAt, completedAt *time.Time, errorMessage *string) (*models.PipelineRun, error) {
	setClauses := []string{"status=$2"}
	args := []interface{}{id, status}
	idx := 3

	if startedAt != nil {
		setClauses = append(setClauses, "started_at=$"+itoa(idx))
		args = append(args, *startedAt)
		idx++
	}
	if completedAt != nil {
		setClauses = append(setClauses, "completed_at=$"+itoa(idx))
		args = append(args, *completedAt)
		idx++
		if startedAt != nil {
			duration := completedAt.Sub(*startedAt).Milliseconds()
			setClauses = append(setClauses, "duration_ms=$"+itoa(idx))
			args = append(args, duration)
			idx++
		}
	}
	if errorMessage != nil {
		setClauses = append(setClauses, "error_message=$"+itoa(idx))
		args = append(args, *errorMessage)
		idx++
	}

	query := "UPDATE pipeline_runs SET "
	for i, clause := range setClauses {
		if i > 0 {
			query += ", "
		}
		query += clause
	}
	query += " WHERE id=$1 RETURNING *"

	var run models.PipelineRun
	err := r.db.GetContext(ctx, &run, query, args...)
	if err != nil {
		return nil, err
	}
	return &run, nil
}

// CountRuns returns the total number of runs for a pipeline.
func (r *Repository) CountRuns(ctx context.Context, pipelineID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM pipeline_runs WHERE pipeline_id=$1`, pipelineID,
	)
	return count, err
}

// DeleteRun removes a pipeline run (cascade deletes stages and tasks).
func (r *Repository) DeleteRun(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM pipeline_runs WHERE id=$1`, id)
	return err
}

// ==================== StageExecution CRUD ====================

// CreateStageExecution inserts a new stage execution record.
func (r *Repository) CreateStageExecution(ctx context.Context, se *models.StageExecution) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO stage_executions (id, run_id, stage_id, stage_name, status)
		 VALUES ($1,$2,$3,$4,$5)`,
		se.ID, se.RunID, se.StageID, se.StageName, se.Status,
	)
	return err
}

// GetStageExecutionByID returns a stage execution by ID.
func (r *Repository) GetStageExecutionByID(ctx context.Context, id string) (*models.StageExecution, error) {
	var se models.StageExecution
	err := r.db.GetContext(ctx, &se, `SELECT * FROM stage_executions WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &se, nil
}

// ListStageExecutionsByRun returns all stage executions for a run, ordered by creation.
func (r *Repository) ListStageExecutionsByRun(ctx context.Context, runID string) ([]models.StageExecution, error) {
	var items []models.StageExecution
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM stage_executions WHERE run_id=$1 ORDER BY created_at`, runID,
	)
	return items, err
}

// UpdateStageExecutionStatus updates a stage execution's status and timestamps.
func (r *Repository) UpdateStageExecutionStatus(ctx context.Context, id, status string, startedAt, completedAt *time.Time, errorMessage, logs *string) (*models.StageExecution, error) {
	setClauses := []string{"status=$2"}
	args := []interface{}{id, status}
	idx := 3

	if startedAt != nil {
		setClauses = append(setClauses, "started_at=$"+itoa(idx))
		args = append(args, *startedAt)
		idx++
	}
	if completedAt != nil {
		setClauses = append(setClauses, "completed_at=$"+itoa(idx))
		args = append(args, *completedAt)
		idx++
		if startedAt != nil {
			duration := completedAt.Sub(*startedAt).Milliseconds()
			setClauses = append(setClauses, "duration_ms=$"+itoa(idx))
			args = append(args, duration)
			idx++
		}
	}
	if errorMessage != nil {
		setClauses = append(setClauses, "error_message=$"+itoa(idx))
		args = append(args, *errorMessage)
		idx++
	}
	if logs != nil {
		setClauses = append(setClauses, "logs=$"+itoa(idx))
		args = append(args, *logs)
		idx++
	}

	query := "UPDATE stage_executions SET "
	for i, clause := range setClauses {
		if i > 0 {
			query += ", "
		}
		query += clause
	}
	query += " WHERE id=$1 RETURNING *"

	var se models.StageExecution
	err := r.db.GetContext(ctx, &se, query, args...)
	if err != nil {
		return nil, err
	}
	return &se, nil
}

// ==================== TaskExecution CRUD ====================

// CreateTaskExecution inserts a new task execution record.
func (r *Repository) CreateTaskExecution(ctx context.Context, te *models.TaskExecution) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO task_executions (id, execution_id, task_name, task_type, status, input)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		te.ID, te.ExecutionID, te.TaskName, te.TaskType, te.Status, te.Input,
	)
	return err
}

// GetTaskExecutionByID returns a task execution by ID.
func (r *Repository) GetTaskExecutionByID(ctx context.Context, id string) (*models.TaskExecution, error) {
	var te models.TaskExecution
	err := r.db.GetContext(ctx, &te, `SELECT * FROM task_executions WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &te, nil
}

// ListTaskExecutionsByStage returns all task executions for a stage execution.
func (r *Repository) ListTaskExecutionsByStage(ctx context.Context, executionID string) ([]models.TaskExecution, error) {
	var items []models.TaskExecution
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM task_executions WHERE execution_id=$1 ORDER BY created_at`, executionID,
	)
	return items, err
}

// UpdateTaskExecutionStatus updates a task execution's status, output, timestamps, error, and logs.
func (r *Repository) UpdateTaskExecutionStatus(ctx context.Context, id string, updates map[string]interface{}) (*models.TaskExecution, error) {
	setClauses := []string{}
	args := []interface{}{id}
	idx := 2

	if v, ok := updates["status"]; ok {
		setClauses = append(setClauses, "status=$"+itoa(idx))
		args = append(args, v)
		idx++
	}
	if v, ok := updates["output"]; ok {
		outputJSON, err := json.Marshal(v)
		if err != nil {
			return nil, err
		}
		setClauses = append(setClauses, "output=$"+itoa(idx))
		args = append(args, string(outputJSON))
		idx++
	}
	if v, ok := updates["started_at"]; ok {
		setClauses = append(setClauses, "started_at=$"+itoa(idx))
		args = append(args, v)
		idx++
	}
	if v, ok := updates["completed_at"]; ok {
		setClauses = append(setClauses, "completed_at=$"+itoa(idx))
		args = append(args, v)
		idx++
	}
	if v, ok := updates["error_message"]; ok {
		setClauses = append(setClauses, "error_message=$"+itoa(idx))
		args = append(args, v)
		idx++
	}
	if v, ok := updates["logs"]; ok {
		setClauses = append(setClauses, "logs=$"+itoa(idx))
		args = append(args, v)
		idx++
	}
	if v, ok := updates["duration_ms"]; ok {
		setClauses = append(setClauses, "duration_ms=$"+itoa(idx))
		args = append(args, v)
		idx++
	}

	if len(setClauses) == 0 {
		return r.GetTaskExecutionByID(ctx, id)
	}

	query := "UPDATE task_executions SET "
	for i, clause := range setClauses {
		if i > 0 {
			query += ", "
		}
		query += clause
	}
	query += " WHERE id=$1 RETURNING *"

	var te models.TaskExecution
	err := r.db.GetContext(ctx, &te, query, args...)
	if err != nil {
		return nil, err
	}
	return &te, nil
}

// ==================== RunnerJob CRUD ====================

// CreateRunnerJob inserts a new runner job.
func (r *Repository) CreateRunnerJob(ctx context.Context, job *models.RunnerJob) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO runner_jobs (id, runner_id, task_id, stage_id, run_id, tenant_id, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		job.ID, job.RunnerID, job.TaskID, job.StageID, job.RunID, job.TenantID, job.Status,
	)
	return err
}

// GetRunnerJobByID returns a runner job by ID.
func (r *Repository) GetRunnerJobByID(ctx context.Context, id string) (*models.RunnerJob, error) {
	var job models.RunnerJob
	err := r.db.GetContext(ctx, &job, `SELECT * FROM runner_jobs WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

// ListRunnerJobsByRunner returns all jobs for a runner, ordered by creation.
func (r *Repository) ListRunnerJobsByRunner(ctx context.Context, runnerID string) ([]models.RunnerJob, error) {
	var items []models.RunnerJob
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM runner_jobs WHERE runner_id=$1 ORDER BY created_at DESC`, runnerID,
	)
	return items, err
}

// FindRunnerJobByTaskID returns a runner job by task ID.
func (r *Repository) FindRunnerJobByTaskID(ctx context.Context, taskID string) (*models.RunnerJob, error) {
	var job models.RunnerJob
	err := r.db.GetContext(ctx, &job,
		`SELECT * FROM runner_jobs WHERE task_id=$1 LIMIT 1`, taskID,
	)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

// MarkRunnerJobStarted marks a runner job as running with a started_at timestamp.
func (r *Repository) MarkRunnerJobStarted(ctx context.Context, id string) (*models.RunnerJob, error) {
	var job models.RunnerJob
	err := r.db.GetContext(ctx, &job,
		`UPDATE runner_jobs SET status='running', started_at=COALESCE(started_at, NOW()) WHERE id=$1 RETURNING *`, id,
	)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

// MarkRunnerJobComplete marks a runner job as completed with a result.
func (r *Repository) MarkRunnerJobComplete(ctx context.Context, id string, result map[string]interface{}) (*models.RunnerJob, error) {
	resultJSON, err := json.Marshal(result)
	if err != nil {
		return nil, err
	}
	var job models.RunnerJob
	err = r.db.GetContext(ctx, &job,
		`UPDATE runner_jobs SET status='completed', result=$2, completed_at=NOW() WHERE id=$1 RETURNING *`,
		id, string(resultJSON),
	)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

// MarkRunnerJobFailed marks a runner job as failed with an error message.
func (r *Repository) MarkRunnerJobFailed(ctx context.Context, id, errMsg string) (*models.RunnerJob, error) {
	var job models.RunnerJob
	err := r.db.GetContext(ctx, &job,
		`UPDATE runner_jobs SET status='failed', error=$2, completed_at=NOW() WHERE id=$1 RETURNING *`,
		id, errMsg,
	)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

// DeleteRunnerJob removes a runner job.
func (r *Repository) DeleteRunnerJob(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM runner_jobs WHERE id=$1`, id)
	return err
}

// ==================== Helpers ====================

// itoa converts an int to its string representation for building SQL placeholders.
func itoa(n int) string {
	if n < 10 {
		return string(rune('0' + n))
	}
	// Simple conversion for small numbers (up to 99 covers all practical cases)
	return string(rune('0'+n/10)) + string(rune('0'+n%10))
}

// NullString creates a sql.NullString from a string pointer.
func NullString(s *string) sql.NullString {
	if s == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *s, Valid: true}
}

// NullTime creates a sql.NullTime from a time pointer.
func NullTime(t *time.Time) sql.NullTime {
	if t == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *t, Valid: true}
}
