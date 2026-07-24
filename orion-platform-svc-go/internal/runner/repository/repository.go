// Package repository provides data access for all Runner entities.
// Implements PostgreSQL-backed storage via sqlx for runner_agents, runner_jobs,
// and runner_heartbeats tables.
//
// Translated from TS: JobRepository.ts (188 lines) — the TS blueprint used a
// IDbAdapter interface for the PG pool. This Go implementation uses sqlx.DB
// following the platform's established repository pattern (inception, skill).
package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/runner/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound  = sql.ErrNoRows
	ErrDuplicate = errors.New("duplicate key")
)

// Repository provides data access for runner agents, jobs, and heartbeats.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ===========================================================================
// Runner Agent CRUD
// ===========================================================================

// CreateAgent inserts a new runner agent. Generates UUID for id.
func (r *Repository) CreateAgent(ctx context.Context, a *models.RunnerAgent) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	a.CreatedAt = now
	a.UpdatedAt = now

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO runner_agents
			(id, agent_id, tenant_id, name, labels, endpoint, max_concurrent, status, metadata, last_heartbeat_at, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		a.ID, a.AgentID, a.TenantID, a.Name, a.Labels, a.Endpoint,
		a.MaxConcurrent, a.Status, a.Metadata, a.LastHeartbeatAt,
		a.CreatedAt, a.UpdatedAt,
	)
	return err
}

// GetAgentByAgentID returns an agent by its external agent_id.
func (r *Repository) GetAgentByAgentID(ctx context.Context, agentID string) (*models.RunnerAgent, error) {
	var a models.RunnerAgent
	err := r.db.GetContext(ctx, &a,
		`SELECT id, agent_id, tenant_id, name, labels, endpoint, max_concurrent,
		        status, metadata, last_heartbeat_at, created_at, updated_at
		 FROM runner_agents
		 WHERE agent_id = $1`,
		agentID,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// GetAgentByID returns an agent by its UUID.
func (r *Repository) GetAgentByID(ctx context.Context, id string) (*models.RunnerAgent, error) {
	var a models.RunnerAgent
	err := r.db.GetContext(ctx, &a,
		`SELECT id, agent_id, tenant_id, name, labels, endpoint, max_concurrent,
		        status, metadata, last_heartbeat_at, created_at, updated_at
		 FROM runner_agents
		 WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ListAgents returns paginated agents, optionally filtered by tenant and status.
func (r *Repository) ListAgents(ctx context.Context, tenantID, status string, offset, limit int) ([]models.RunnerAgent, error) {
	var items []models.RunnerAgent
	var err error

	if tenantID != "" && status != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, agent_id, tenant_id, name, labels, endpoint, max_concurrent,
			        status, metadata, last_heartbeat_at, created_at, updated_at
			 FROM runner_agents
			 WHERE tenant_id = $1 AND status = $2
			 ORDER BY created_at DESC
			 OFFSET $3 LIMIT $4`,
			tenantID, status, offset, limit,
		)
	} else if tenantID != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, agent_id, tenant_id, name, labels, endpoint, max_concurrent,
			        status, metadata, last_heartbeat_at, created_at, updated_at
			 FROM runner_agents
			 WHERE tenant_id = $1
			 ORDER BY created_at DESC
			 OFFSET $2 LIMIT $3`,
			tenantID, offset, limit,
		)
	} else if status != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, agent_id, tenant_id, name, labels, endpoint, max_concurrent,
			        status, metadata, last_heartbeat_at, created_at, updated_at
			 FROM runner_agents
			 WHERE status = $1
			 ORDER BY created_at DESC
			 OFFSET $2 LIMIT $3`,
			status, offset, limit,
		)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, agent_id, tenant_id, name, labels, endpoint, max_concurrent,
			        status, metadata, last_heartbeat_at, created_at, updated_at
			 FROM runner_agents
			 ORDER BY created_at DESC
			 OFFSET $1 LIMIT $2`,
			offset, limit,
		)
	}
	return items, err
}

// UpdateAgent updates an agent's mutable fields using dynamic SET clause.
func (r *Repository) UpdateAgent(ctx context.Context, id string, labels *models.JSONArray, maxConcurrent *int, status, metadata *models.JSONB) error {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if labels != nil {
		setClauses = append(setClauses, fmt.Sprintf("labels = $%d", argIdx))
		args = append(args, *labels)
		argIdx++
	}
	if maxConcurrent != nil {
		setClauses = append(setClauses, fmt.Sprintf("max_concurrent = $%d", argIdx))
		args = append(args, *maxConcurrent)
		argIdx++
	}
	if status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *status)
		argIdx++
	}
	if metadata != nil {
		setClauses = append(setClauses, fmt.Sprintf("metadata = $%d", argIdx))
		args = append(args, *metadata)
		argIdx++
	}

	if len(setClauses) == 0 {
		return nil
	}

	setClauses = append(setClauses, "updated_at = now()")
	query := fmt.Sprintf("UPDATE runner_agents SET %s WHERE id = $%d",
		joinStrings(setClauses, ", "), argIdx)
	args = append(args, id)

	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// UpdateAgentLastHeartbeat updates the last heartbeat timestamp for an agent.
func (r *Repository) UpdateAgentLastHeartbeat(ctx context.Context, agentID string, now time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE runner_agents
		 SET status = $1, last_heartbeat_at = $2, updated_at = $2
		 WHERE agent_id = $3`,
		string(models.AgentStatusOnline), now, agentID,
	)
	return err
}

// DeleteAgent removes an agent by ID.
func (r *Repository) DeleteAgent(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM runner_agents WHERE id = $1`,
		id,
	)
	return err
}

// CountAgents returns agent count, optionally filtered by tenant.
func (r *Repository) CountAgents(ctx context.Context, tenantID string) (int, error) {
	var count int
	if tenantID != "" {
		err := r.db.GetContext(ctx, &count,
			`SELECT COUNT(*) FROM runner_agents WHERE tenant_id = $1`,
			tenantID,
		)
		return count, err
	}
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM runner_agents`,
	)
	return count, err
}

// ===========================================================================
// Runner Job CRUD
// ===========================================================================

// CreateJob inserts a new job record with status=pending.
// Translated from TS JobRepository.create().
func (r *Repository) CreateJob(ctx context.Context, j *models.RunnerJob) error {
	if j.ID == "" {
		j.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	j.CreatedAt = now
	if j.Status == "" {
		j.Status = models.JobStatusPending
	}

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO runner_jobs
			(id, job_id, agent_id, tenant_id, task_type, task_parameters, status, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		j.ID, j.JobID, j.AgentID, j.TenantID, j.TaskType,
		j.Params, j.Status, j.CreatedAt,
	)
	return err
}

// GetJobByID returns a single job record by its UUID.
func (r *Repository) GetJobByID(ctx context.Context, id string) (*models.RunnerJob, error) {
	var j models.RunnerJob
	err := r.db.GetContext(ctx, &j,
		`SELECT id, job_id, agent_id, tenant_id, task_type, task_parameters,
		        status, result, stdout, stderr, exit_code, duration_ms, error_message,
		        started_at, completed_at, created_at
		 FROM runner_jobs
		 WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &j, nil
}

// GetJobByJobID returns a single job by its external job_id.
func (r *Repository) GetJobByJobID(ctx context.Context, jobID string) (*models.RunnerJob, error) {
	var j models.RunnerJob
	err := r.db.GetContext(ctx, &j,
		`SELECT id, job_id, agent_id, tenant_id, task_type, task_parameters,
		        status, result, stdout, stderr, exit_code, duration_ms, error_message,
		        started_at, completed_at, created_at
		 FROM runner_jobs
		 WHERE job_id = $1`,
		jobID,
	)
	if err != nil {
		return nil, err
	}
	return &j, nil
}

// ListJobs returns paginated jobs, optionally filtered by tenant, agent, and status.
func (r *Repository) ListJobs(ctx context.Context, tenantID, agentID, status string, offset, limit int) ([]models.RunnerJob, error) {
	var items []models.RunnerJob
	var err error

	if tenantID != "" && agentID != "" && status != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, job_id, agent_id, tenant_id, task_type, task_parameters,
			        status, result, stdout, stderr, exit_code, duration_ms, error_message,
			        started_at, completed_at, created_at
			 FROM runner_jobs
			 WHERE tenant_id = $1 AND agent_id = $2 AND status = $3
			 ORDER BY created_at DESC
			 OFFSET $4 LIMIT $5`,
			tenantID, agentID, status, offset, limit,
		)
	} else if tenantID != "" && agentID != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, job_id, agent_id, tenant_id, task_type, task_parameters,
			        status, result, stdout, stderr, exit_code, duration_ms, error_message,
			        started_at, completed_at, created_at
			 FROM runner_jobs
			 WHERE tenant_id = $1 AND agent_id = $2
			 ORDER BY created_at DESC
			 OFFSET $3 LIMIT $4`,
			tenantID, agentID, offset, limit,
		)
	} else if tenantID != "" {
		// Default: tenant-level query (multi-tenant safety)
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, job_id, agent_id, tenant_id, task_type, task_parameters,
			        status, result, stdout, stderr, exit_code, duration_ms, error_message,
			        started_at, completed_at, created_at
			 FROM runner_jobs
			 WHERE tenant_id = $1
			 ORDER BY created_at DESC
			 OFFSET $2 LIMIT $3`,
			tenantID, offset, limit,
		)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, job_id, agent_id, tenant_id, task_type, task_parameters,
			        status, result, stdout, stderr, exit_code, duration_ms, error_message,
			        started_at, completed_at, created_at
			 FROM runner_jobs
			 ORDER BY created_at DESC
			 OFFSET $1 LIMIT $2`,
			offset, limit,
		)
	}
	return items, err
}

// ListJobsByStatus returns paginated jobs filtered by status only.
func (r *Repository) ListJobsByStatus(ctx context.Context, status string, offset, limit int) ([]models.RunnerJob, error) {
	var items []models.RunnerJob
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, job_id, agent_id, tenant_id, task_type, task_parameters,
		        status, result, stdout, stderr, exit_code, duration_ms, error_message,
		        started_at, completed_at, created_at
		 FROM runner_jobs
		 WHERE status = $1
		 ORDER BY created_at DESC
		 OFFSET $2 LIMIT $3`,
		status, offset, limit,
	)
	return items, err
}

// ListJobsByAgent returns paginated jobs for a specific agent.
func (r *Repository) ListJobsByAgent(ctx context.Context, agentID string, offset, limit int) ([]models.RunnerJob, error) {
	var items []models.RunnerJob
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, job_id, agent_id, tenant_id, task_type, task_parameters,
		        status, result, stdout, stderr, exit_code, duration_ms, error_message,
		        started_at, completed_at, created_at
		 FROM runner_jobs
		 WHERE agent_id = $1
		 ORDER BY created_at DESC
		 OFFSET $2 LIMIT $3`,
		agentID, offset, limit,
	)
	return items, err
}

// MarkRunning transitions a job to running status with started_at.
// Translated from TS JobRepository.markRunning().
func (r *Repository) MarkRunning(ctx context.Context, id string) (*models.RunnerJob, error) {
	now := time.Now().UTC()
	return r.setJobStatus(ctx, id, string(models.JobStatusRunning), nil, nil, nil, nil, nil, nil, &now, nil)
}

// MarkComplete transitions a job to completed status with full result.
// Translated from TS JobRepository.markComplete().
func (r *Repository) MarkComplete(ctx context.Context, id string, result models.JSONB, stdout, stderr *string, exitCode, durationMs *int) (*models.RunnerJob, error) {
	now := time.Now().UTC()
	return r.setJobStatus(ctx, id, string(models.JobStatusCompleted), &result, stdout, stderr, exitCode, durationMs, nil, nil, &now)
}

// MarkFailed transitions a job to failed status with error info.
// Translated from TS JobRepository.markFailed().
func (r *Repository) MarkFailed(ctx context.Context, id string, errMsg string, stderr *string, durationMs *int) (*models.RunnerJob, error) {
	now := time.Now().UTC()
	return r.setJobStatus(ctx, id, string(models.JobStatusFailed), nil, nil, stderr, nil, durationMs, &errMsg, nil, &now)
}

// MarkCancelled transitions a job to cancelled status.
// Translated from TS JobRepository.markCancelled().
func (r *Repository) MarkCancelled(ctx context.Context, id string) (*models.RunnerJob, error) {
	return r.setJobStatus(ctx, id, string(models.JobStatusCancelled), nil, nil, nil, nil, nil, nil, nil, nil)
}

// setJobStatus is a shared helper that builds a dynamic UPDATE for status transitions.
func (r *Repository) setJobStatus(ctx context.Context, id string, status string, result *models.JSONB, stdout, stderr *string, exitCode, durationMs *int, errMsg *string, startedAt, completedAt *time.Time) (*models.RunnerJob, error) {
	// Build SET clauses dynamically
	setClauses := []string{"status = $1"}
	args := []interface{}{status}
	argIdx := 2

	if result != nil {
		setClauses = append(setClauses, fmt.Sprintf("result = $%d", argIdx))
		args = append(args, *result)
		argIdx++
	}
	if stdout != nil {
		setClauses = append(setClauses, fmt.Sprintf("stdout = $%d", argIdx))
		args = append(args, *stdout)
		argIdx++
	}
	if stderr != nil {
		setClauses = append(setClauses, fmt.Sprintf("stderr = $%d", argIdx))
		args = append(args, *stderr)
		argIdx++
	}
	if exitCode != nil {
		setClauses = append(setClauses, fmt.Sprintf("exit_code = $%d", argIdx))
		args = append(args, *exitCode)
		argIdx++
	}
	if durationMs != nil {
		setClauses = append(setClauses, fmt.Sprintf("duration_ms = $%d", argIdx))
		args = append(args, *durationMs)
		argIdx++
	}
	if errMsg != nil {
		msg := *errMsg
		setClauses = append(setClauses, fmt.Sprintf("error_message = $%d", argIdx))
		args = append(args, &msg)
		argIdx++
	}
	if startedAt != nil {
		setClauses = append(setClauses, fmt.Sprintf("started_at = $%d", argIdx))
		args = append(args, *startedAt)
		argIdx++
	}
	if completedAt != nil {
		setClauses = append(setClauses, fmt.Sprintf("completed_at = $%d", argIdx))
		args = append(args, *completedAt)
		argIdx++
	}

	query := fmt.Sprintf(
		`UPDATE runner_jobs SET %s WHERE id = $%d RETURNING id, job_id, agent_id, tenant_id,
		        task_type, task_parameters, status, result, stdout, stderr, exit_code, duration_ms,
		        error_message, started_at, completed_at, created_at`,
		joinStrings(setClauses, ", "), argIdx,
	)
	args = append(args, id)

	var j models.RunnerJob
	err := r.db.GetContext(ctx, &j, query, args...)
	if err != nil {
		return nil, err
	}
	return &j, nil
}

// DeleteJob removes a job record.
func (r *Repository) DeleteJob(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM runner_jobs WHERE id = $1`,
		id,
	)
	return err
}

// CountJobs returns total job count, optionally filtered by tenant.
func (r *Repository) CountJobs(ctx context.Context, tenantID string) (int, error) {
	var count int
	if tenantID != "" {
		err := r.db.GetContext(ctx, &count,
			`SELECT COUNT(*) FROM runner_jobs WHERE tenant_id = $1`,
			tenantID,
		)
		return count, err
	}
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM runner_jobs`,
	)
	return count, err
}

// CountJobsByAgent returns the number of jobs for a specific agent.
// Translated from TS JobRepository.countByRunner().
func (r *Repository) CountJobsByAgent(ctx context.Context, agentID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM runner_jobs WHERE agent_id = $1`,
		agentID,
	)
	return count, err
}

// CountActiveJobsByAgent counts currently running jobs for an agent.
func (r *Repository) CountActiveJobsByAgent(ctx context.Context, agentID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM runner_jobs WHERE agent_id = $1 AND status = $2`,
		agentID, string(models.JobStatusRunning),
	)
	return count, err
}

// ===========================================================================
// Runner Heartbeat
// ===========================================================================

// CreateHeartbeat inserts a new heartbeat record.
func (r *Repository) CreateHeartbeat(ctx context.Context, hb *models.RunnerHeartbeat) error {
	if hb.ID == "" {
		hb.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	hb.CreatedAt = now

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO runner_heartbeats
			(id, agent_id, active_jobs, cpu_usage, memory_usage, disk_usage, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		hb.ID, hb.AgentID, hb.ActiveJobs, hb.CPUUsage, hb.MemoryUsage, hb.DiskUsage, hb.CreatedAt,
	)
	return err
}

// ListHeartbeatsByAgent returns recent heartbeats for an agent (last N).
func (r *Repository) ListHeartbeatsByAgent(ctx context.Context, agentID string, limit int) ([]models.RunnerHeartbeat, error) {
	var items []models.RunnerHeartbeat
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, agent_id, active_jobs, cpu_usage, memory_usage, disk_usage, created_at
		 FROM runner_heartbeats
		 WHERE agent_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2`,
		agentID, limit,
	)
	return items, err
}

// PurgeExpiredHeartbeats deletes heartbeats older than the retention period.
func (r *Repository) PurgeExpiredHeartbeats(ctx context.Context, retention time.Duration) (int64, error) {
	cutoff := time.Now().UTC().Add(-retention)
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM runner_heartbeats WHERE created_at < $1`,
		cutoff,
	)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return n
}

// ===========================================================================
// Helpers
// ===========================================================================

func joinStrings(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
