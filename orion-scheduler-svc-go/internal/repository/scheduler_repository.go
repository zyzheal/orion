package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/scheduler-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// SchedulerRepository provides all SQL operations for the scheduler domain.
type SchedulerRepository struct {
	db *sqlx.DB
}

func NewSchedulerRepository(db *sqlx.DB) *SchedulerRepository {
	return &SchedulerRepository{db: db}
}

// ═══════════════════════════════════════════════════════════════════════════
// Job CRUD
// ═══════════════════════════════════════════════════════════════════════════

// CreateJob inserts a new scheduled job and returns the generated ID/timestamps.
func (r *SchedulerRepository) CreateJob(ctx context.Context, j *models.Job) error {
	query := `
		INSERT INTO jobs (tenant_id, name, description, type, cron_expr, interval_sec, status, next_run_at, max_runs)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRowContext(ctx, query,
		j.TenantID, j.Name, j.Description, j.Type, j.CronExpr,
		j.IntervalSec, j.Status, j.NextRunAt, j.MaxRuns,
	).Scan(&j.ID, &j.CreatedAt, &j.UpdatedAt)
}

// GetJobByID fetches a single job scoped to the given tenant.
func (r *SchedulerRepository) GetJobByID(ctx context.Context, tenantID, id string) (*models.Job, error) {
	var j models.Job
	query := `SELECT * FROM jobs WHERE tenant_id = $1 AND id = $2`
	if err := r.db.GetContext(ctx, &j, query, tenantID, id); err != nil {
		return nil, fmt.Errorf("job not found: %w", err)
	}
	return &j, nil
}

// ListJobs returns a page of jobs for the given tenant, ordered by creation time descending.
func (r *SchedulerRepository) ListJobs(ctx context.Context, tenantID string, offset, limit int) ([]models.Job, error) {
	var jobs []models.Job
	query := `SELECT * FROM jobs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	if err := r.db.SelectContext(ctx, &jobs, query, tenantID, limit, offset); err != nil {
		return nil, err
	}
	return jobs, nil
}

// UpdateJobStatus changes the status of a job, scoped to tenant.
func (r *SchedulerRepository) UpdateJobStatus(ctx context.Context, tenantID, id string, status models.JobStatus) error {
	query := `UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`
	_, err := r.db.ExecContext(ctx, query, status, id, tenantID)
	return err
}

// UpdateJob applies partial updates from an UpdateJobRequest.
func (r *SchedulerRepository) UpdateJob(ctx context.Context, tenantID, id string, req *models.UpdateJobRequest) error {
	// Fetch current job to merge partial fields.
	job, err := r.GetJobByID(ctx, tenantID, id)
	if err != nil {
		return err
	}

	if req.Name != nil {
		job.Name = *req.Name
	}
	if req.Description != nil {
		job.Description = *req.Description
	}
	if req.CronExpr != nil {
		job.CronExpr = req.CronExpr
	}
	if req.IntervalSec != nil {
		job.IntervalSec = req.IntervalSec
	}
	if req.MaxRuns != nil {
		job.MaxRuns = req.MaxRuns
	}
	if req.Status != nil {
		job.Status = *req.Status
	}

	query := `
		UPDATE jobs
		SET name = $1, description = $2, cron_expr = $3, interval_sec = $4,
		    max_runs = $5, status = $6, updated_at = NOW()
		WHERE id = $7 AND tenant_id = $8`
	_, err = r.db.ExecContext(ctx, query,
		job.Name, job.Description, job.CronExpr, job.IntervalSec,
		job.MaxRuns, job.Status, id, tenantID,
	)
	return err
}

// UpdateJobNextRun sets the next_run_at timestamp for a job, scoped to tenant.
func (r *SchedulerRepository) UpdateJobNextRun(ctx context.Context, tenantID, id string, nextRun time.Time) error {
	query := `UPDATE jobs SET next_run_at = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`
	_, err := r.db.ExecContext(ctx, query, nextRun, id, tenantID)
	return err
}

// UpdateJobRunInfo bumps run_count and sets last_run_at after an execution, scoped to tenant.
func (r *SchedulerRepository) UpdateJobRunInfo(ctx context.Context, tenantID, id string) error {
	query := `UPDATE jobs SET last_run_at = NOW(), run_count = run_count + 1, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`
	_, err := r.db.ExecContext(ctx, query, id, tenantID)
	return err
}

// Delete removes a job and its cascading runs.
func (r *SchedulerRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM jobs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// Count returns the total number of jobs for a tenant.
func (r *SchedulerRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM jobs WHERE tenant_id = $1`, tenantID)
	return count, err
}

// FindJobsDueForExecution returns all enabled jobs for a tenant whose next_run_at is at or before the given time.
func (r *SchedulerRepository) FindJobsDueForExecution(ctx context.Context, tenantID string, before time.Time) ([]models.Job, error) {
	var jobs []models.Job
	query := `SELECT * FROM jobs WHERE tenant_id = $1 AND status = 'active' AND next_run_at IS NOT NULL AND next_run_at <= $2`
	if err := r.db.SelectContext(ctx, &jobs, query, tenantID, before); err != nil {
		return nil, err
	}
	return jobs, nil
}

// GetDistinctTenantIDs returns all distinct tenant IDs that have active jobs.
// Used by the tick loop to iterate per-tenant for proper RLS scoping.
func (r *SchedulerRepository) GetDistinctTenantIDs(ctx context.Context) ([]string, error) {
	var tenantIDs []string
	query := `SELECT DISTINCT tenant_id FROM jobs WHERE status = 'active' AND tenant_id IS NOT NULL`
	if err := r.db.SelectContext(ctx, &tenantIDs, query); err != nil {
		return nil, err
	}
	return tenantIDs, nil
}

// ═══════════════════════════════════════════════════════════════════════════
// Job Runs
// ═══════════════════════════════════════════════════════════════════════════

// CreateJobRun inserts a new execution record with status "running".
func (r *SchedulerRepository) CreateJobRun(ctx context.Context, jr *models.JobRun) error {
	query := `
		INSERT INTO job_runs (job_id, status, started_at)
		VALUES ($1, $2, NOW())
		RETURNING id`
	return r.db.QueryRowContext(ctx, query, jr.JobID, jr.Status).Scan(&jr.ID)
}

// CompleteJobRun marks an execution as finished (success or failed).
func (r *SchedulerRepository) CompleteJobRun(ctx context.Context, id, status string, errStr *string, durationMs int64) error {
	query := `UPDATE job_runs SET status = $1, error = $2, ended_at = NOW(), duration_ms = $3 WHERE id = $4`
	_, err := r.db.ExecContext(ctx, query, status, errStr, durationMs, id)
	return err
}

// GetJobRuns returns the most recent executions for a job.
func (r *SchedulerRepository) GetJobRuns(ctx context.Context, jobID string, limit int) ([]models.JobRun, error) {
	var runs []models.JobRun
	query := `SELECT * FROM job_runs WHERE job_id = $1 ORDER BY started_at DESC LIMIT $2`
	if err := r.db.SelectContext(ctx, &runs, query, jobID, limit); err != nil {
		return nil, err
	}
	return runs, nil
}

// GetExecutionHistory returns executions for a tenant, optionally filtered by job ID.
func (r *SchedulerRepository) GetExecutionHistory(ctx context.Context, tenantID, jobID string, limit int) ([]models.JobRun, error) {
	var runs []models.JobRun
	if jobID != "" {
		query := `SELECT jr.* FROM job_runs jr JOIN jobs j ON jr.job_id = j.id WHERE j.tenant_id = $1 AND jr.job_id = $2 ORDER BY jr.started_at DESC LIMIT $3`
		if err := r.db.SelectContext(ctx, &runs, query, tenantID, jobID, limit); err != nil {
			return nil, err
		}
	} else {
		query := `SELECT jr.* FROM job_runs jr JOIN jobs j ON jr.job_id = j.id WHERE j.tenant_id = $1 ORDER BY jr.started_at DESC LIMIT $2`
		if err := r.db.SelectContext(ctx, &runs, query, tenantID, limit); err != nil {
			return nil, err
		}
	}
	return runs, nil
}

// ═══════════════════════════════════════════════════════════════════════════
// On-Call Schedules
// ═══════════════════════════════════════════════════════════════════════════

// CreateSchedule inserts a new on-call rotation schedule.
func (r *SchedulerRepository) CreateSchedule(ctx context.Context, s *models.OnCallSchedule) error {
	membersJSON, err := json.Marshal(s.TeamMembers)
	if err != nil {
		return fmt.Errorf("marshal team_members: %w", err)
	}
	escJSON, err := json.Marshal(s.Escalations)
	if err != nil {
		return fmt.Errorf("marshal escalations: %w", err)
	}

	query := `
		INSERT INTO oncall_schedules (id, tenant_id, name, timezone, rotation_type, rotation_start_hour,
		                              team_members, start_date, end_date, escalations)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at, updated_at`
	return r.db.QueryRowContext(ctx, query,
		s.ID, s.TenantID, s.Name, s.Timezone, s.RotationType, s.RotationStartHour,
		membersJSON, s.StartDate, s.EndDate, escJSON,
	).Scan(&s.CreatedAt, &s.UpdatedAt)
}

// ListSchedules returns all on-call schedules for a tenant.
func (r *SchedulerRepository) ListSchedules(ctx context.Context, tenantID string) ([]models.OnCallSchedule, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, tenant_id, name, timezone, rotation_type, rotation_start_hour, team_members, start_date, end_date, escalations, created_at, updated_at
		 FROM oncall_schedules WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedules []models.OnCallSchedule
	for rows.Next() {
		var s models.OnCallSchedule
		var membersJSON, escJSON []byte
		if err := rows.Scan(&s.ID, &s.TenantID, &s.Name, &s.Timezone, &s.RotationType, &s.RotationStartHour,
			&membersJSON, &s.StartDate, &s.EndDate, &escJSON, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(membersJSON, &s.TeamMembers); err != nil {
			return nil, fmt.Errorf("unmarshal team_members: %w", err)
		}
		if err := json.Unmarshal(escJSON, &s.Escalations); err != nil {
			return nil, fmt.Errorf("unmarshal escalations: %w", err)
		}
		schedules = append(schedules, s)
	}
	return schedules, rows.Err()
}

// GetScheduleByID fetches a single on-call schedule by ID, scoped to tenant.
func (r *SchedulerRepository) GetScheduleByID(ctx context.Context, tenantID, id string) (*models.OnCallSchedule, error) {
	var s models.OnCallSchedule
	var membersJSON, escJSON []byte
	query := `SELECT id, tenant_id, name, timezone, rotation_type, rotation_start_hour, team_members, start_date, end_date, escalations, created_at, updated_at
	          FROM oncall_schedules WHERE id = $1 AND tenant_id = $2`
	if err := r.db.QueryRowContext(ctx, query, id, tenantID).Scan(
		&s.ID, &s.TenantID, &s.Name, &s.Timezone, &s.RotationType, &s.RotationStartHour,
		&membersJSON, &s.StartDate, &s.EndDate, &escJSON, &s.CreatedAt, &s.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("schedule not found: %w", err)
	}
	if err := json.Unmarshal(membersJSON, &s.TeamMembers); err != nil {
		return nil, fmt.Errorf("unmarshal team_members: %w", err)
	}
	if err := json.Unmarshal(escJSON, &s.Escalations); err != nil {
		return nil, fmt.Errorf("unmarshal escalations: %w", err)
	}
	return &s, nil
}

// DeleteSchedule removes a schedule and all its cascading assignments/overrides, scoped to tenant.
func (r *SchedulerRepository) DeleteSchedule(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM oncall_schedules WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return rows > 0, nil
}

// ═══════════════════════════════════════════════════════════════════════════
// On-Call Assignments
// ═══════════════════════════════════════════════════════════════════════════

// CreateAssignment inserts a rotation assignment record.
func (r *SchedulerRepository) CreateAssignment(ctx context.Context, a *models.OnCallAssignment) error {
	query := `
		INSERT INTO oncall_assignments (id, tenant_id, schedule_id, user_id, start_time, end_time)
		VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := r.db.ExecContext(ctx, query, a.ID, a.TenantID, a.ScheduleID, a.UserID, a.StartTime, a.EndTime)
	return err
}

// FindActiveAssignment returns the assignment covering the given instant for a schedule.
func (r *SchedulerRepository) FindActiveAssignment(ctx context.Context, scheduleID string, at time.Time) (*models.OnCallAssignment, error) {
	var a models.OnCallAssignment
	query := `SELECT id, schedule_id, user_id, start_time, end_time
	          FROM oncall_assignments
	          WHERE schedule_id = $1 AND start_time <= $2 AND end_time > $2
	          LIMIT 1`
	if err := r.db.GetContext(ctx, &a, query, scheduleID, at); err != nil {
		return nil, err
	}
	return &a, nil
}

// ListAssignments returns all assignments for a schedule.
func (r *SchedulerRepository) ListAssignments(ctx context.Context, scheduleID string) ([]models.OnCallAssignment, error) {
	var assignments []models.OnCallAssignment
	query := `SELECT id, schedule_id, user_id, start_time, end_time
	          FROM oncall_assignments WHERE schedule_id = $1 ORDER BY start_time`
	if err := r.db.SelectContext(ctx, &assignments, query, scheduleID); err != nil {
		return nil, err
	}
	return assignments, nil
}

// DeleteAssignmentsByScheduleID removes all assignments belonging to a schedule.
func (r *SchedulerRepository) DeleteAssignmentsByScheduleID(ctx context.Context, scheduleID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM oncall_assignments WHERE schedule_id = $1`, scheduleID)
	return err
}

// ═══════════════════════════════════════════════════════════════════════════
// On-Call Overrides
// ═══════════════════════════════════════════════════════════════════════════

// CreateOverride inserts an override record.
func (r *SchedulerRepository) CreateOverride(ctx context.Context, o *models.OnCallOverride) error {
	query := `
		INSERT INTO oncall_overrides (id, tenant_id, schedule_id, original_user_id, override_user_id, start_time, end_time, reason)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.db.ExecContext(ctx, query,
		o.ID, o.TenantID, o.ScheduleID, o.OriginalUserID, o.OverrideUserID,
		o.StartTime, o.EndTime, o.Reason,
	)
	return err
}

// FindActiveOverride returns the override covering the given instant for a schedule.
func (r *SchedulerRepository) FindActiveOverride(ctx context.Context, scheduleID string, at time.Time) (*models.OnCallOverride, error) {
	var o models.OnCallOverride
	query := `SELECT id, schedule_id, original_user_id, override_user_id, start_time, end_time, reason
	          FROM oncall_overrides
	          WHERE schedule_id = $1 AND start_time <= $2 AND end_time > $2
	          LIMIT 1`
	if err := r.db.GetContext(ctx, &o, query, scheduleID, at); err != nil {
		return nil, err
	}
	return &o, nil
}

// DeleteOverridesByScheduleID removes all overrides belonging to a schedule.
func (r *SchedulerRepository) DeleteOverridesByScheduleID(ctx context.Context, scheduleID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM oncall_overrides WHERE schedule_id = $1`, scheduleID)
	return err
}

// ═══════════════════════════════════════════════════════════════════════════
// Distributed Locks (PostgreSQL advisory locks)
// ═══════════════════════════════════════════════════════════════════════════

// AcquireAdvisoryLock attempts to acquire a PostgreSQL advisory lock identified by a hash key.
// Returns true if the lock was acquired, false if already held by another session.
func (r *SchedulerRepository) AcquireAdvisoryLock(ctx context.Context, key string) (bool, error) {
	hashKey := hashStringToInt64(key)
	var acquired bool
	query := `SELECT pg_try_advisory_lock($1)`
	if err := r.db.GetContext(ctx, &acquired, query, hashKey); err != nil {
		return false, fmt.Errorf("acquire advisory lock: %w", err)
	}
	return acquired, nil
}

// ReleaseAdvisoryLock releases a PostgreSQL advisory lock.
func (r *SchedulerRepository) ReleaseAdvisoryLock(ctx context.Context, key string) error {
	hashKey := hashStringToInt64(key)
	var released bool
	query := `SELECT pg_advisory_unlock($1)`
	if err := r.db.GetContext(ctx, &released, query, hashKey); err != nil {
		return fmt.Errorf("release advisory lock: %w", err)
	}
	return nil
}

// hashStringToInt64 converts an arbitrary string to an int64 suitable for pg_try_advisory_lock.
func hashStringToInt64(s string) int64 {
	var h int64
	for _, c := range s {
		h = h*31 + int64(c)
	}
	if h < 0 {
		h = -h
	}
	return h
}

// ═══════════════════════════════════════════════════════════════════════════
// pq array helpers for TeamMembers ([]string stored as TEXT[] in Postgres)
// ═══════════════════════════════════════════════════════════════════════════

// pqStringArray wraps []string for Postgres TEXT[] columns via lib/pq.
type pqStringArray pq.StringArray

// Scan implements sql.Scanner for pqStringArray.
func (a *pqStringArray) Scan(src interface{}) error {
	return (*pq.StringArray)(a).Scan(src)
}

// Value implements driver.Valuer for pqStringArray.
func (a pqStringArray) Value() (interface{}, error) {
	return pq.StringArray(a).Value()
}
