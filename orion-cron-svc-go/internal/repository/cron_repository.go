package repository

import (
	"context"
	"orion/cron-svc-go/internal/models"
	"time"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ═══════════════════════════════════════════════════════════════
//  Cron Jobs
// ═══════════════════════════════════════════════════════════════

func (r *Repository) CreateCronJob(ctx context.Context, j *models.CronJob) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cron_jobs (id, tenant_id, name, schedule, command, payload, enabled, next_run_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		j.ID, j.TenantID, j.Name, j.Schedule, j.Command, j.Payload, j.Enabled, j.NextRunAt,
	)
	return err
}

func (r *Repository) ListCronJobs(ctx context.Context, tenantID string, offset, limit int) ([]models.CronJob, error) {
	var items []models.CronJob
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM cron_jobs WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit,
	)
	return items, err
}

func (r *Repository) GetCronJobByID(ctx context.Context, tenantID, id string) (*models.CronJob, error) {
	var j models.CronJob
	err := r.db.GetContext(ctx, &j,
		`SELECT * FROM cron_jobs WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &j, nil
}

func (r *Repository) DeleteCronJob(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM cron_jobs WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	return err
}

func (r *Repository) CountCronJobs(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM cron_jobs WHERE tenant_id=$1`, tenantID,
	)
	return count, err
}

func (r *Repository) FindEnabledCronJobs(ctx context.Context) ([]models.CronJob, error) {
	var items []models.CronJob
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM cron_jobs WHERE enabled=true ORDER BY created_at`,
	)
	return items, err
}

func (r *Repository) UpdateCronJob(ctx context.Context, tenantID, id string, req *models.UpdateCronJobRequest) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cron_jobs
		 SET name = COALESCE($3, name),
		     schedule = COALESCE($4, schedule),
		     command = COALESCE($5, command),
		     payload = COALESCE($6, payload),
		     updated_at = NOW()
		 WHERE id=$1 AND tenant_id=$2`,
		id, tenantID, req.Name, req.Schedule, req.Command, req.Payload,
	)
	return err
}

func (r *Repository) EnableCronJob(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cron_jobs SET enabled=true, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		id, tenantID,
	)
	return err
}

func (r *Repository) DisableCronJob(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cron_jobs SET enabled=false, next_run_at=NULL, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		id, tenantID,
	)
	return err
}

func (r *Repository) UpdateCronJobLastRun(ctx context.Context, id string, lastRunAt time.Time, status string, nextRunAt time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cron_jobs
		 SET last_run_at=$2, last_run_status=$3, next_run_at=$4, updated_at=NOW()
		 WHERE id=$1`,
		id, lastRunAt, status, nextRunAt,
	)
	return err
}

// ═══════════════════════════════════════════════════════════════
//  Cron Executions
// ═══════════════════════════════════════════════════════════════

func (r *Repository) CreateExecution(ctx context.Context, e *models.CronExecution) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cron_executions (id, job_id, started_at, status) VALUES ($1, $2, $3, $4)`,
		e.ID, e.JobID, e.StartedAt, e.Status,
	)
	return err
}

func (r *Repository) CompleteExecution(ctx context.Context, id, status string, output *string, execErr *string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cron_executions
		 SET completed_at=NOW(), status=$2, output=$3, error=$4
		 WHERE id=$1`,
		id, status, output, execErr,
	)
	return err
}

func (r *Repository) GetExecutionHistory(ctx context.Context, jobID string, offset, limit int) ([]models.CronExecution, error) {
	var items []models.CronExecution
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM cron_executions WHERE job_id=$1 ORDER BY started_at DESC OFFSET $2 LIMIT $3`,
		jobID, offset, limit,
	)
	return items, err
}

func (r *Repository) ListAllExecutions(ctx context.Context, offset, limit int) ([]models.CronExecution, error) {
	var items []models.CronExecution
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM cron_executions ORDER BY started_at DESC OFFSET $1 LIMIT $2`,
		offset, limit,
	)
	return items, err
}

// ═══════════════════════════════════════════════════════════════
//  OnCall Schedules
// ═══════════════════════════════════════════════════════════════

func (r *Repository) CreateOnCallSchedule(ctx context.Context, s *models.OnCallSchedule) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO oncall_schedules
		 (id, tenant_id, name, timezone, rotation_type, rotation_start_hour, team_members, start_date, end_date, escalations)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		s.ID, s.TenantID, s.Name, s.Timezone, s.RotationType, s.RotationStartHour,
		s.TeamMembers, s.StartDate, s.EndDate, s.Escalations,
	)
	return err
}

func (r *Repository) GetOnCallScheduleByID(ctx context.Context, tenantID, id string) (*models.OnCallSchedule, error) {
	var s models.OnCallSchedule
	err := r.db.GetContext(ctx, &s,
		`SELECT * FROM oncall_schedules WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) ListOnCallSchedules(ctx context.Context, tenantID string) ([]models.OnCallSchedule, error) {
	var items []models.OnCallSchedule
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM oncall_schedules WHERE tenant_id=$1 ORDER BY created_at DESC`,
		tenantID,
	)
	return items, err
}

func (r *Repository) DeleteOnCallSchedule(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM oncall_schedules WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	return err
}

// ═══════════════════════════════════════════════════════════════
//  OnCall Assignments
// ═══════════════════════════════════════════════════════════════

func (r *Repository) CreateOnCallAssignment(ctx context.Context, a *models.OnCallAssignment) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO oncall_assignments (id, schedule_id, user_id, start_time, end_time)
		 VALUES ($1, $2, $3, $4, $5)`,
		a.ID, a.ScheduleID, a.UserID, a.StartTime, a.EndTime,
	)
	return err
}

func (r *Repository) FindActiveAssignment(ctx context.Context, scheduleID string, t time.Time) (*models.OnCallAssignment, error) {
	var a models.OnCallAssignment
	err := r.db.GetContext(ctx, &a,
		`SELECT * FROM oncall_assignments
		 WHERE schedule_id=$1 AND start_time <= $2 AND end_time > $2
		 LIMIT 1`,
		scheduleID, t,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *Repository) ListAssignmentsBySchedule(ctx context.Context, scheduleID string) ([]models.OnCallAssignment, error) {
	var items []models.OnCallAssignment
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM oncall_assignments WHERE schedule_id=$1 ORDER BY start_time`,
		scheduleID,
	)
	return items, err
}

func (r *Repository) DeleteAssignmentsBySchedule(ctx context.Context, scheduleID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM oncall_assignments WHERE schedule_id=$1`, scheduleID,
	)
	return err
}

// ═══════════════════════════════════════════════════════════════
//  OnCall Overrides
// ═══════════════════════════════════════════════════════════════

func (r *Repository) CreateOnCallOverride(ctx context.Context, o *models.OnCallOverride) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO oncall_overrides (id, schedule_id, original_user_id, override_user_id, start_time, end_time, reason)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		o.ID, o.ScheduleID, o.OriginalUserID, o.OverrideUserID, o.StartTime, o.EndTime, o.Reason,
	)
	return err
}

func (r *Repository) FindActiveOverride(ctx context.Context, scheduleID string, t time.Time) (*models.OnCallOverride, error) {
	var o models.OnCallOverride
	err := r.db.GetContext(ctx, &o,
		`SELECT * FROM oncall_overrides
		 WHERE schedule_id=$1 AND start_time <= $2 AND end_time > $2
		 LIMIT 1`,
		scheduleID, t,
	)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (r *Repository) DeleteOverridesBySchedule(ctx context.Context, scheduleID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM oncall_overrides WHERE schedule_id=$1`, scheduleID,
	)
	return err
}
