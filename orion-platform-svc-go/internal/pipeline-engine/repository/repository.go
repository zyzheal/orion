package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/pipeline-engine/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound = errors.New("not found")
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// unixNow returns current unix seconds.
func unixNow() int64 {
	return time.Now().UTC().Unix()
}

// ts returns unix timestamp as *int64.
func ts(t time.Time) *int64 {
	v := t.Unix()
	return &v
}

// toJSON marshals a value to a JSON string.
func toJSON(v interface{}) (string, error) {
	b, err := json.Marshal(v)
	return string(b), err
}

// --- PipelineRun ---

func (r *Repository) CreateRun(ctx context.Context, run *models.PipelineRun) error {
	run.ID = uuid.New().String()
	now := unixNow()
	run.CreatedAt = now
	run.UpdatedAt = now
	if run.Context == "" {
		run.Context = "{}"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO pipeline_runs (id, pipeline_id, pipeline_version, trigger_type, trigger_by, status,
			environment, started_at, completed_at, duration_ms, context, tenant_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		run.ID, run.PipelineID, run.PipelineVersion, string(run.TriggerType),
		nullString(run.TriggerBy), string(run.Status), nullString(run.Environment),
		nullInt64(run.StartedAt), nullInt64(run.CompletedAt), nullInt64(run.DurationMs),
		run.Context, run.TenantID, now, now,
)
	return err
}

func (r *Repository) GetRun(ctx context.Context, tenantID, runID string) (*models.PipelineRun, error) {
	var run models.PipelineRun
	err := r.db.GetContext(ctx, &run,
		`SELECT id, pipeline_id, pipeline_version, trigger_type, trigger_by, status, environment,
			started_at, completed_at, duration_ms, context, tenant_id, created_at, updated_at
		 FROM pipeline_runs WHERE id=$1 AND tenant_id=$2`, runID, tenantID)
	if err != nil {
		return nil, err
	}
	return &run, nil
}

func (r *Repository) UpdateRunStatus(ctx context.Context, tenantID, runID string, status models.PipelineRunStatus, completedAt *int64, durationMs *int64) error {
	updated := unixNow()
	_, err := r.db.ExecContext(ctx,
		`UPDATE pipeline_runs SET status=$1, completed_at=$2, duration_ms=$3, updated_at=$4
		 WHERE id=$5 AND tenant_id=$6`,
		string(status), nullInt64(completedAt), nullInt64(durationMs), updated, runID, tenantID)
	return err
}

func (r *Repository) ListRuns(ctx context.Context, tenantID, pipelineID string, q models.ListRunsQuery) ([]models.PipelineRun, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	var query string
	var args []interface{}
	if q.Status != "" {
		query = `SELECT id, pipeline_id, pipeline_version, trigger_type, trigger_by, status, environment,
			started_at, completed_at, duration_ms, context, tenant_id, created_at, updated_at
			FROM pipeline_runs WHERE tenant_id=$1 AND pipeline_id=$2 AND status=$3 ORDER BY created_at DESC LIMIT $4 OFFSET $5`
		args = []interface{}{tenantID, pipelineID, q.Status, q.Limit, q.Offset}
	} else {
		query = `SELECT id, pipeline_id, pipeline_version, trigger_type, trigger_by, status, environment,
			started_at, completed_at, duration_ms, context, tenant_id, created_at, updated_at
			FROM pipeline_runs WHERE tenant_id=$1 AND pipeline_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
		args = []interface{}{tenantID, pipelineID, q.Limit, q.Offset}
	}
	runs := make([]models.PipelineRun, 0)
	err := r.db.SelectContext(ctx, &runs, query, args...)
	return runs, err
}

func (r *Repository) CountRuns(ctx context.Context, tenantID, pipelineID string, status string) (int, error) {
	var count int
	if status != "" {
		err := r.db.GetContext(ctx, &count,
			`SELECT COUNT(*) FROM pipeline_runs WHERE tenant_id=$1 AND pipeline_id=$2 AND status=$3`,
			tenantID, pipelineID, status)
		return count, err
	}
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM pipeline_runs WHERE tenant_id=$1 AND pipeline_id=$2`,
		tenantID, pipelineID)
	return count, err
}

// --- Stage ---

func (r *Repository) CreateStage(ctx context.Context, stage *models.Stage) error {
	stage.ID = uuid.New().String()
	now := unixNow()
	stage.CreatedAt = now
	stage.UpdatedAt = now
	if stage.DependsOn == "" {
		stage.DependsOn = "[]"
	}
	if stage.Targets == "" {
		stage.Targets = "[]"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO pipeline_stages (id, run_id, name, sequence, status, depends_on, condition,
			timeout_seconds, retry_count, max_retries, started_at, completed_at, duration_ms, result,
			error, targets, execution_mode, batch_size, tenant_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
		stage.ID, stage.RunID, stage.Name, stage.Sequence, string(stage.Status), stage.DependsOn,
		nullString(stage.Condition), stage.TimeoutSeconds, stage.RetryCount, stage.MaxRetries,
		nullInt64(stage.StartedAt), nullInt64(stage.CompletedAt), nullInt64(stage.DurationMs),
		nullString(stage.Result), nullString(stage.Error), stage.Targets,
		nullString(stage.ExecutionMode), stage.BatchSize,
		stage.TenantID, now, now,
)
	return err
}

func (r *Repository) GetStage(ctx context.Context, tenantID, stageID string) (*models.Stage, error) {
	var stage models.Stage
	err := r.db.GetContext(ctx, &stage,
		`SELECT id, run_id, name, sequence, status, depends_on, condition, timeout_seconds, retry_count, max_retries,
			started_at, completed_at, duration_ms, result, error, targets, execution_mode, batch_size, tenant_id, created_at, updated_at
			FROM pipeline_stages WHERE id=$1 AND tenant_id=$2`, stageID, tenantID)
	if err != nil {
		return nil, err
	}
	return &stage, nil
}

func (r *Repository) GetStagesByRun(ctx context.Context, tenantID, runID string) ([]models.Stage, error) {
	stages := make([]models.Stage, 0)
	err := r.db.SelectContext(ctx, &stages,
		`SELECT id, run_id, name, sequence, status, depends_on, condition, timeout_seconds, retry_count, max_retries,
			started_at, completed_at, duration_ms, result, error, targets, execution_mode, batch_size, tenant_id, created_at, updated_at
			FROM pipeline_stages WHERE run_id=$1 AND tenant_id=$2 ORDER BY sequence`, runID, tenantID)
	return stages, err
}

func (r *Repository) UpdateStageStatus(ctx context.Context, tenantID, stageID string, status string, completedAt *int64, durationMs *int64, errMsg *string) error {
	updated := unixNow()
	_, err := r.db.ExecContext(ctx,
		`UPDATE pipeline_stages SET status=$1, completed_at=$2, duration_ms=$3, error=$4, updated_at=$5
		 WHERE id=$6 AND tenant_id=$7`,
		status, nullInt64(completedAt), nullInt64(durationMs), nullString(errMsg), updated, stageID, tenantID)
	return err
}

func (r *Repository) GetStageIDsByRun(ctx context.Context, tenantID, runID string) ([]string, error) {
	var ids []string
	err := r.db.SelectContext(ctx, &ids,
		`SELECT id FROM pipeline_stages WHERE run_id=$1 AND tenant_id=$2`, runID, tenantID)
	return ids, err
}

func (r *Repository) GetStageStatusByRun(ctx context.Context, tenantID, runID string) (map[string]string, error) {
	result := make(map[string]string)
	rows, err := r.db.QueryContext(ctx,
		`SELECT name, status FROM pipeline_stages WHERE run_id=$1 AND tenant_id=$2`, runID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var name, status string
		if err := rows.Scan(&name, &status); err != nil {
			return nil, err
		}
		result[name] = status
	}
	return result, err
}

// --- Task ---

func (r *Repository) CreateTask(ctx context.Context, task *models.Task) error {
	task.ID = uuid.New().String()
	now := unixNow()
	task.CreatedAt = now
	task.UpdatedAt = now
	if task.Status == "" {
		task.Status = models.TaskStatusPending
	}
	if task.Config == "" {
		task.Config = "{}"
	}
	if task.Parameters == "" {
		task.Parameters = "{}"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO pipeline_tasks (id, stage_id, name, type, sequence, status, config, parameters,
			resource_quota, retry_count, max_retries, timeout_seconds, started_at, completed_at,
			duration_ms, result, log, error, tenant_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
		task.ID, task.StageID, task.Name, task.Type, task.Sequence, string(task.Status),
		task.Config, task.Parameters, nullString(task.ResourceQuota),
		task.RetryCount, task.MaxRetries, task.TimeoutSeconds,
		nullInt64(task.StartedAt), nullInt64(task.CompletedAt), nullInt64(task.DurationMs),
		nullString(task.Result), nullString(task.Log), nullString(task.Error),
		task.TenantID, now, now,
)
	return err
}

func (r *Repository) GetTask(ctx context.Context, tenantID, taskID string) (*models.Task, error) {
	var task models.Task
	err := r.db.GetContext(ctx, &task,
		`SELECT id, stage_id, name, type, sequence, status, config, parameters, resource_quota,
			retry_count, max_retries, timeout_seconds, started_at, completed_at, duration_ms, result, log, error, tenant_id, created_at, updated_at
			FROM pipeline_tasks WHERE id=$1 AND tenant_id=$2`, taskID, tenantID)
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *Repository) GetTasksByStage(ctx context.Context, tenantID, stageID string) ([]models.Task, error) {
	tasks := make([]models.Task, 0)
	err := r.db.SelectContext(ctx, &tasks,
		`SELECT id, stage_id, name, type, sequence, status, config, parameters, resource_quota,
			retry_count, max_retries, timeout_seconds, started_at, completed_at, duration_ms, result, log, error, tenant_id, created_at, updated_at
			FROM pipeline_tasks WHERE stage_id=$1 AND tenant_id=$2 ORDER BY sequence`, stageID, tenantID)
	return tasks, err
}

func (r *Repository) UpdateTaskStatus(ctx context.Context, tenantID, taskID string, status models.TaskStatus, completedAt *int64, durationMs *int64, errMsg *string, logMsg *string) error {
	updated := unixNow()
	_, err := r.db.ExecContext(ctx,
		`UPDATE pipeline_tasks SET status=$1, completed_at=$2, duration_ms=$3, error=$4, log=$5, updated_at=$6
		 WHERE id=$7 AND tenant_id=$8`,
		string(status), nullInt64(completedAt), nullInt64(durationMs), nullString(errMsg), nullString(logMsg), updated, taskID, tenantID)
	return err
}

// --- Checkpoint ---

func (r *Repository) CreateCheckpoint(ctx context.Context, cp *models.Checkpoint) error {
	cp.ID = uuid.New().String()
	cp.CreatedAt = unixNow()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO pipeline_checkpoints (id, run_id, stage_name, task_name, state, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		cp.ID, cp.RunID, cp.StageName, nullString(cp.TaskName), cp.State, cp.CreatedAt,
)
	return err
}

func (r *Repository) GetCheckpoint(ctx context.Context, tenantID, runID string) (*models.Checkpoint, error) {
	var cp models.Checkpoint
	err := r.db.GetContext(ctx, &cp,
		`SELECT id, run_id, stage_name, task_name, state, created_at
		 FROM pipeline_checkpoints WHERE run_id=$1 ORDER BY created_at DESC LIMIT 1`, runID)
	if err != nil {
		return nil, err
	}
	return &cp, nil
}

// GetCompletedStageNames returns all stage names with status=SUCCESS for a run.
func (r *Repository) GetCompletedStageNames(ctx context.Context, tenantID, runID string) ([]string, error) {
	var names []string
	err := r.db.SelectContext(ctx, &names,
		`SELECT name FROM pipeline_stages WHERE run_id=$1 AND tenant_id=$2 AND status='SUCCESS'`, runID, tenantID)
	return names, err
}

// GetFailedStageNames returns all stage names with status=FAILED for a run.
func (r *Repository) GetFailedStageNames(ctx context.Context, tenantID, runID string) ([]string, error) {
	var names []string
	err := r.db.SelectContext(ctx, &names,
		`SELECT name FROM pipeline_stages WHERE run_id=$1 AND tenant_id=$2 AND status='FAILED'`, runID, tenantID)
	return names, err
}

// GetRunTenantID retrieves the tenant_id for a run (for cross-repo validation).
func (r *Repository) GetRunTenantID(ctx context.Context, runID string) (string, error) {
	var tenantID string
	err := r.db.GetContext(ctx, &tenantID,
		`SELECT tenant_id FROM pipeline_runs WHERE id=$1`, runID)
	return tenantID, err
}

// --- null helpers ---

func nullString(s *string) *string {
	return s
}

func nullInt64(i *int64) *int64 {
	return i
}

// unused fmt for now
var _ = fmt.Sprintf
