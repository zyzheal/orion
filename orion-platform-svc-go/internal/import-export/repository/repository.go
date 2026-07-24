package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/import-export/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository provides data access for import-export jobs and their validation errors.
//
// It is intentionally minimal: a Job and its child ValidationError rows.  Large
// result sets live in the async layer (SSE / progress polling), not here.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a repository bound to the given database connection.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ===================================================================
// Jobs

// UpsertJob inserts a new job or updates an existing one by ID.
//
// Used by the service layer to record creation and later progress/termination.
func (r *Repository) UpsertJob(ctx context.Context, job *models.Job) error {
	return r.db.NamedExecContext(ctx, `
		INSERT INTO import_export_jobs
		  (id, tenant_id, user_id, data_type, operation, status, format, source_name,
		   output_name, error_count, success_count, total_count, progress, progress_msg,
		   message, metadata, created_at, updated_at, finished_at)
		VALUES (:id, :tenant_id, :user_id, :data_type, :operation, :status, :format, :source_name,
		        :output_name, :error_count, :success_count, :total_count, :progress, :progress_msg,
		        :message, :metadata, :created_at, :updated_at, :finished_at)
		ON CONFLICT (id)
		DO UPDATE SET
		    status      = EXCLUDED.status,
		    error_count = EXCLUDED.error_count,
		    success_count = EXCLUDED.success_count,
		    total_count = EXCLUDED.total_count,
		    progress    = EXCLUDED.progress,
		    progress_msg = EXCLUDED.progress_msg,
		    message     = EXCLUDED.message,
		    metadata    = EXCLUDED.metadata,
		    updated_at  = EXCLUDED.updated_at,
		    finished_at = EXCLUDED.finished_at
	`, job)
}

// GetJob retrieves a single job by ID, scoped to the caller's tenant.
func (r *Repository) GetJob(ctx context.Context, tenantID, id string) (*models.Job, error) {
	job := &models.Job{}
	err := r.db.GetContext(ctx, job,
		`SELECT * FROM import_export_jobs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("job %s not found", id)
		}
		return nil, err
	}
	// Deserialize JSONB metadata (sqlx may have left it raw).
	if job.Metadata == nil {
		var raw map[string]any
		if b, ok := job.Metadata.(map[string]interface{}); ok {
			job.Metadata = b
		} else if b, ok := job.Metadata.([]byte); ok && len(b) > 0 {
			if err := json.Unmarshal(b, &raw); err == nil {
				job.Metadata = raw
			}
		}
	}
	return job, nil
}

// ListJobs lists jobs for the tenant, filtered and ordered newest-first.
//
// limit 0 means use the server default (50).
func (r *Repository) ListJobs(ctx context.Context, tenantID string, filter *models.JobFilter,
	limit int) ([]models.Job, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `
		SELECT * FROM import_export_jobs
		WHERE tenant_id = $1
	`
	args := []any{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.DataType != "" {
			query += fmt.Sprintf(` AND data_type = $%d`, argIdx)
			args = append(args, filter.DataType)
			argIdx++
		}
		if filter.Operation != "" {
			query += fmt.Sprintf(` AND operation = $%d`, argIdx)
			args = append(args, filter.Operation)
			argIdx++
		}
		if filter.Status != "" {
			query += fmt.Sprintf(` AND status = $%d`, argIdx)
			args = append(args, filter.Status)
			argIdx++
		}
		if filter.UserID != "" {
			query += fmt.Sprintf(` AND user_id = $%d`, argIdx)
			args = append(args, filter.UserID)
			_ = args[argIdx-1] // force arg consumption
			argIdx++
		}
	}

	query += fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d`, argIdx)
	args = append(args, limit)

	var jobs []models.Job
	err := r.db.SelectContext(ctx, &jobs, query, args...)
	return jobs, err
}

// ===================================================================
// Errors (child rows of a job)

// BatchSaveErrors inserts a batch of validation errors in a single statement.
//
// Used by the import handler after parsing to persist row-level errors.
func (r *Repository) BatchSaveErrors(ctx context.Context, errs []models.ValidationError) error {
	if len(errs) == 0 {
		return nil
	}
	for i := range errs {
		errs[i].ID = uuid.New().String()
		errs[i].CreatedAt = time.Now().UTC()
	}
	q := `
		INSERT INTO import_export_errors
		  (id, job_id, row_number, field, message, raw_value, error_type, created_at)
		VALUES (:id, :job_id, :row_number, :field, :message, :raw_value, :error_type, :created_at)
	`
	_, err := r.db.NamedExecContext(ctx, q, errs)
	return err
}

// GetErrorsForJob returns all validation errors belonging to a job,
// scoped to the tenant by joining the parent job row.
func (r *Repository) GetErrorsForJob(ctx context.Context, tenantID, jobID string) (
	[]models.ValidationError, error) {
	var errs []models.ValidationError
	err := r.db.SelectContext(ctx, &errs, `
		SELECT e.*
		FROM import_export_errors e
		JOIN import_export_jobs j ON j.id = e.job_id
		WHERE e.job_id = $1 AND j.tenant_id = $2
		ORDER BY e.row_number, e.field
	`, jobID, tenantID)
	return errs, err
}

