package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/visor-exec/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Command Execution ---

func (r *Repository) CreateCommandLog(ctx context.Context, log *models.CommandLog) error {
	log.ID = uuid.New().String()
	log.CreatedAt = time.Now().UTC()
	if log.Timeout == 0 {
		log.Timeout = 30
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO visor_exec_command_logs (id, command, host_ids, host_count, timeout, status, created_at)
		 VALUES (:id, :command, :host_ids, :host_count, :timeout, :status, :created_at)`,
		log)
	return err
}

func (r *Repository) CreateCommandLogDetails(ctx context.Context, details []models.CommandLogDetail) error {
	for i := range details {
		details[i].ID = uuid.New().String()
	}
	query := `INSERT INTO visor_exec_command_log_details (id, command_id, hostname, output, error_output, exit_code, status)
		VALUES (:id, :command_id, :hostname, :output, :error_output, :exit_code, :status)`
	_, err := r.db.NamedExecContext(ctx, query, details)
	return err
}

func (r *Repository) ListCommandLogs(ctx context.Context, tenantID string, page, pageSize int) ([]models.CommandLog, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	var items []models.CommandLog
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM visor_exec_command_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`, pageSize, offset)
	if err != nil {
		return nil, err
	}
	_ = tenantID
	return items, nil
}

func (r *Repository) CountCommandLogs(ctx context.Context, tenantID string) (int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM visor_exec_command_logs`)
	if err != nil {
		return 0, err
	}
	return total, nil
}

func (r *Repository) GetCommandLogByID(ctx context.Context, id string) (*models.CommandLog, error) {
	var log models.CommandLog
	err := r.db.GetContext(ctx, &log,
		`SELECT * FROM visor_exec_command_logs WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &log, nil
}

func (r *Repository) GetCommandLogDetailsByCommandID(ctx context.Context, commandID string) ([]models.CommandLogDetail, error) {
	var items []models.CommandLogDetail
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM visor_exec_command_log_details WHERE command_id=$1 ORDER BY id`, commandID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// --- Script Templates ---

func (r *Repository) CreateTemplate(ctx context.Context, tmpl *models.Template) error {
	tmpl.ID = uuid.New().String()
	tmpl.CreatedAt = time.Now().UTC()
	tmpl.UpdatedAt = time.Now().UTC()
	if tmpl.Category == "" {
		tmpl.Category = "general"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO visor_exec_templates (id, name, description, content, category, created_at, updated_at)
		 VALUES (:id, :name, :description, :content, :category, :created_at, :updated_at)`,
		tmpl)
	return err
}

func (r *Repository) ListTemplates(ctx context.Context) ([]models.Template, error) {
	var items []models.Template
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM visor_exec_templates ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CountTemplates(ctx context.Context) (int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM visor_exec_templates`)
	if err != nil {
		return 0, err
	}
	return total, nil
}

func (r *Repository) GetTemplateByID(ctx context.Context, id string) (*models.Template, error) {
	var tmpl models.Template
	err := r.db.GetContext(ctx, &tmpl,
		`SELECT * FROM visor_exec_templates WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &tmpl, nil
}

func (r *Repository) UpdateTemplate(ctx context.Context, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE visor_exec_templates SET updated_at = NOW() WHERE id=$1`, id)
	return err
}

func (r *Repository) DeleteTemplate(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM visor_exec_templates WHERE id=$1`, id)
	return err
}

// --- Cron Jobs ---

func (r *Repository) CreateCronJob(ctx context.Context, job *models.CronJob) error {
	job.ID = uuid.New().String()
	job.CreatedAt = time.Now().UTC()
	if !job.Enabled {
		job.Enabled = true
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO visor_exec_cron_jobs (id, name, command, host_ids, hostnames, cron_expression, enabled, created_at)
		 VALUES (:id, :name, :command, :host_ids, :hostnames, :cron_expression, :enabled, :created_at)`,
		job)
	return err
}

func (r *Repository) ListCronJobs(ctx context.Context) ([]models.CronJob, error) {
	var items []models.CronJob
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM visor_exec_cron_jobs ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CountCronJobs(ctx context.Context) (int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM visor_exec_cron_jobs`)
	if err != nil {
		return 0, err
	}
	return total, nil
}

func (r *Repository) GetCronJobByID(ctx context.Context, id string) (*models.CronJob, error) {
	var job models.CronJob
	err := r.db.GetContext(ctx, &job,
		`SELECT * FROM visor_exec_cron_jobs WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *Repository) UpdateCronJob(ctx context.Context, id string, updates map[string]interface{}) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE visor_exec_cron_jobs SET updated_at = NOW() WHERE id=$1`, id)
	return err
}

func (r *Repository) DeleteCronJob(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM visor_exec_cron_jobs WHERE id=$1`, id)
	return err
}

func (r *Repository) ToggleCronJob(ctx context.Context, id string, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE visor_exec_cron_jobs SET enabled=$1, updated_at=NOW() WHERE id=$2`, enabled, id)
	return err
}

func (r *Repository) UpdateCronJobLastRun(ctx context.Context, id string, lastRunAt time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE visor_exec_cron_jobs SET last_run_at=$1, updated_at=NOW() WHERE id=$2`, lastRunAt, id)
	return err
}

// --- Cron Job Logs ---

func (r *Repository) CreateCronJobLog(ctx context.Context, log *models.CronJobLog) error {
	log.ID = uuid.New().String()
	log.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO visor_exec_cron_job_logs (id, job_id, command_id, created_at)
		 VALUES (:id, :job_id, :command_id, :created_at)`,
		log)
	return err
}

func (r *Repository) ListCronJobLogsByJobID(ctx context.Context, jobID string, page, pageSize int) ([]models.CronJobLog, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	var items []models.CronJobLog
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM visor_exec_cron_job_logs WHERE job_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, jobID, pageSize, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CountCronJobLogsByJobID(ctx context.Context, jobID string) (int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM visor_exec_cron_job_logs WHERE job_id=$1`, jobID)
	if err != nil {
		return 0, err
	}
	return total, nil
}

// --- Upload Tasks ---

func (r *Repository) CreateUploadTask(ctx context.Context, task *models.UploadTask) error {
	task.ID = uuid.New().String()
	task.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO visor_exec_upload_tasks (id, file_name, file_size, host_ids, hostnames, target_path, status, progress, created_at)
		 VALUES (:id, :file_name, :file_size, :host_ids, :hostnames, :target_path, :status, :progress, :created_at)`,
		task)
	return err
}

func (r *Repository) ListUploadTasks(ctx context.Context) ([]models.UploadTask, error) {
	var items []models.UploadTask
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM visor_exec_upload_tasks ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CountUploadTasks(ctx context.Context) (int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM visor_exec_upload_tasks`)
	if err != nil {
		return 0, err
	}
	return total, nil
}

func (r *Repository) GetUploadTaskByID(ctx context.Context, id string) (*models.UploadTask, error) {
	var task models.UploadTask
	err := r.db.GetContext(ctx, &task,
		`SELECT * FROM visor_exec_upload_tasks WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *Repository) UpdateUploadTask(ctx context.Context, id string, updates map[string]interface{}) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE visor_exec_upload_tasks SET status=$1 WHERE id=$2`, updates["status"], id)
	return err
}

// Helper to check if repository errors indicate not found (unused sentinel for future)
func NotYetImplemented(msg string) error {
	return fmt.Errorf("%s", msg)
}
