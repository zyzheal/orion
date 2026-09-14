package repository

import (
	"context"
	"fmt"
	"strings"
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
		`INSERT INTO visor_exec_command_logs (id, tenant_id, command, host_ids, host_count, timeout, status, created_at)
		 VALUES (:id, :tenant_id, :command, :host_ids, :host_count, :timeout, :status, :created_at)`,
		log)
	return err
}

func (r *Repository) CreateCommandLogDetails(ctx context.Context, tenantID string, details []models.CommandLogDetail) error {
	for i := range details {
		details[i].ID = uuid.New().String()
	}
	// Details have no TenantID field; build a row struct that includes it for the INSERT.
	rows := make([]struct {
		ID          string `db:"id"`
		TenantID    string `db:"tenant_id"`
		CommandID   string `db:"command_id"`
		Hostname    string `db:"hostname"`
		Output      string `db:"output"`
		ErrorOutput string `db:"error_output"`
		ExitCode    int    `db:"exit_code"`
		Status      string `db:"status"`
	}, len(details))
	for i, d := range details {
		rows[i] = struct {
			ID          string `db:"id"`
			TenantID    string `db:"tenant_id"`
			CommandID   string `db:"command_id"`
			Hostname    string `db:"hostname"`
			Output      string `db:"output"`
			ErrorOutput string `db:"error_output"`
			ExitCode    int    `db:"exit_code"`
			Status      string `db:"status"`
		}{
			ID:          d.ID,
			TenantID:    tenantID,
			CommandID:   d.CommandID,
			Hostname:    d.Hostname,
			Output:      d.Output,
			ErrorOutput: d.ErrorOutput,
			ExitCode:    d.ExitCode,
			Status:      d.Status,
		}
	}
	query := `INSERT INTO visor_exec_command_log_details (id, tenant_id, command_id, hostname, output, error_output, exit_code, status)
		VALUES (:id, :tenant_id, :command_id, :hostname, :output, :error_output, :exit_code, :status)`
	_, err := r.db.NamedExecContext(ctx, query, rows)
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
		`SELECT * FROM visor_exec_command_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, pageSize, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CountCommandLogs(ctx context.Context, tenantID string) (int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM visor_exec_command_logs WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return 0, err
	}
	return total, nil
}

func (r *Repository) GetCommandLogByID(ctx context.Context, tenantID, id string) (*models.CommandLog, error) {
	var log models.CommandLog
	err := r.db.GetContext(ctx, &log,
		`SELECT * FROM visor_exec_command_logs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &log, nil
}

func (r *Repository) GetCommandLogDetailsByCommandID(ctx context.Context, tenantID, commandID string) ([]models.CommandLogDetail, error) {
	var items []models.CommandLogDetail
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM visor_exec_command_log_details WHERE command_id=$1 AND tenant_id=$2 ORDER BY id`, commandID, tenantID)
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
		`INSERT INTO visor_exec_templates (id, tenant_id, name, description, content, category, created_at, updated_at)
		 VALUES (:id, :tenant_id, :name, :description, :content, :category, :created_at, :updated_at)`,
		tmpl)
	return err
}

func (r *Repository) ListTemplates(ctx context.Context, tenantID string) ([]models.Template, error) {
	var items []models.Template
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM visor_exec_templates WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CountTemplates(ctx context.Context, tenantID string) (int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM visor_exec_templates WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return 0, err
	}
	return total, nil
}

func (r *Repository) GetTemplateByID(ctx context.Context, tenantID, id string) (*models.Template, error) {
	var tmpl models.Template
	err := r.db.GetContext(ctx, &tmpl,
		`SELECT * FROM visor_exec_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &tmpl, nil
}

func (r *Repository) UpdateTemplate(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	setClause, args, err := buildWhitelistedSET(updates, templateUpdatable)
	if err != nil {
		return fmt.Errorf("template %s: %w", id, err)
	}
	if setClause == "" {
		return fmt.Errorf("template %s: no column to update", id)
	}
	args = append(args, id, tenantID)
	// The SET clause used to be a constant "updated_at = NOW()", so PUT
	// /templates/:id answered 200 and the service's follow-up read handed back
	// the unchanged row: the only observable effect of an edit was a bumped
	// timestamp.
	query := fmt.Sprintf("UPDATE visor_exec_templates SET %s, updated_at = NOW() WHERE id = $%d AND tenant_id = $%d",
		setClause, len(args)-1, len(args))
	_, err = r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *Repository) DeleteTemplate(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM visor_exec_templates WHERE id=$1 AND tenant_id=$2`, id, tenantID)
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
		`INSERT INTO visor_exec_cron_jobs (id, tenant_id, name, command, host_ids, hostnames, cron_expression, enabled, created_at)
		 VALUES (:id, :tenant_id, :name, :command, :host_ids, :hostnames, :cron_expression, :enabled, :created_at)`,
		job)
	return err
}

func (r *Repository) ListCronJobs(ctx context.Context, tenantID string) ([]models.CronJob, error) {
	var items []models.CronJob
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM visor_exec_cron_jobs WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CountCronJobs(ctx context.Context, tenantID string) (int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM visor_exec_cron_jobs WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return 0, err
	}
	return total, nil
}

func (r *Repository) GetCronJobByID(ctx context.Context, tenantID, id string) (*models.CronJob, error) {
	var job models.CronJob
	err := r.db.GetContext(ctx, &job,
		`SELECT * FROM visor_exec_cron_jobs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *Repository) UpdateCronJob(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	setClause, args, err := buildWhitelistedSET(updates, cronUpdatable)
	if err != nil {
		return fmt.Errorf("cron job %s: %w", id, err)
	}
	if setClause == "" {
		return fmt.Errorf("cron job %s: no column to update", id)
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE visor_exec_cron_jobs SET %s, updated_at = NOW() WHERE id = $%d AND tenant_id = $%d",
		setClause, len(args)-1, len(args))
	_, err = r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *Repository) DeleteCronJob(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM visor_exec_cron_jobs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) ToggleCronJob(ctx context.Context, tenantID, id string, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE visor_exec_cron_jobs SET enabled=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, enabled, id, tenantID)
	return err
}

func (r *Repository) UpdateCronJobLastRun(ctx context.Context, tenantID, id string, lastRunAt time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE visor_exec_cron_jobs SET last_run_at=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, lastRunAt, id, tenantID)
	return err
}

// --- Cron Job Logs ---

func (r *Repository) CreateCronJobLog(ctx context.Context, log *models.CronJobLog) error {
	log.ID = uuid.New().String()
	log.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO visor_exec_cron_job_logs (id, tenant_id, job_id, command_id, created_at)
		 VALUES (:id, :tenant_id, :job_id, :command_id, :created_at)`,
		log)
	return err
}

func (r *Repository) ListCronJobLogsByJobID(ctx context.Context, tenantID, jobID string, page, pageSize int) ([]models.CronJobLog, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
		pageSize = 20
	}
	var items []models.CronJobLog
	offset := (page - 1) * pageSize
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM visor_exec_cron_job_logs WHERE job_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`, jobID, tenantID, pageSize, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CountCronJobLogsByJobID(ctx context.Context, tenantID, jobID string) (int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM visor_exec_cron_job_logs WHERE job_id=$1 AND tenant_id=$2`, jobID, tenantID)
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
		`INSERT INTO visor_exec_upload_tasks (id, tenant_id, file_name, file_size, host_ids, hostnames, target_path, status, progress, created_at)
		 VALUES (:id, :tenant_id, :file_name, :file_size, :host_ids, :hostnames, :target_path, :status, :progress, :created_at)`,
		task)
	return err
}

func (r *Repository) ListUploadTasks(ctx context.Context, tenantID string) ([]models.UploadTask, error) {
	var items []models.UploadTask
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM visor_exec_upload_tasks WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CountUploadTasks(ctx context.Context, tenantID string) (int, error) {
	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM visor_exec_upload_tasks WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return 0, err
	}
	return total, nil
}

func (r *Repository) GetUploadTaskByID(ctx context.Context, tenantID, id string) (*models.UploadTask, error) {
	var task models.UploadTask
	err := r.db.GetContext(ctx, &task,
		`SELECT * FROM visor_exec_upload_tasks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *Repository) UpdateUploadTask(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE visor_exec_upload_tasks SET status=$1 WHERE id=$2 AND tenant_id=$3`, updates["status"], id, tenantID)
	return err
}

// templateUpdatable and cronUpdatable are the only columns a partial update may
// touch, listed in a fixed order. updated_at is deliberately absent: it is set
// by the UPDATE itself, and letting a caller override it would let one rewrite
// when a record was last changed.
var (
	templateUpdatable = []string{"name", "description", "content", "category"}
	cronUpdatable     = []string{"name", "command", "host_ids", "hostnames", "cron_expression", "enabled"}
)

// buildWhitelistedSET renders "col = $1, col = $2, ..." for the entries of
// updates that are allowed, in allowed's order, and returns the values to bind.
// Walking allowed rather than the map makes the generated SQL deterministic,
// because Go maps have no iteration order. A key outside the whitelist is an
// error instead of being dropped, since silently ignoring a caller's field is
// the defect this helper exists to remove.
func buildWhitelistedSET(updates map[string]interface{}, allowed []string) (string, []interface{}, error) {
	ok := make(map[string]bool, len(allowed))
	for _, col := range allowed {
		ok[col] = true
	}
	for k := range updates {
		if !ok[k] {
			return "", nil, fmt.Errorf("column %q is not updatable", k)
		}
	}
	clauses := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates))
	for _, col := range allowed {
		v, exists := updates[col]
		if !exists {
			continue
		}
		clauses = append(clauses, fmt.Sprintf("%s = $%d", col, len(args)+1))
		args = append(args, v)
	}
	return strings.Join(clauses, ", "), args, nil
}

// Helper to check if repository errors indicate not found (unused sentinel for future)
func NotYetImplemented(msg string) error {
	return fmt.Errorf("%s", msg)
}
