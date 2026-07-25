// Package repository provides data access for CMDB Import entities.
// Implements PostgreSQL-backed storage via sqlx for cmdb_import_jobs and
// cmdb_import_records tables.
//
// Follows the platform's established repository pattern (runner, inception).
package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/cmdb-import/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrNotFound  = sql.ErrNoRows
	ErrDuplicate = errors.New("duplicate key")
)

// Repository provides data access for CMDB import jobs and records.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ===========================================================================
// CMDB Import Job CRUD
// ===========================================================================

// CreateJob inserts a new import job with status=pending.
func (r *Repository) CreateJob(ctx context.Context, j *models.CMDBImportJob) error {
	if j.ID == "" {
		j.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	j.CreatedAt = now
	if j.Status == "" {
		j.Status = string(models.JobStatusPending)
	}
	// Ensure StartedAt is set even for pending jobs (required by schema)
	if j.StartedAt.IsZero() {
		j.StartedAt = now
	}

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_import_jobs
			(id, tenant_id, name, source_type, source_path, target_type, mapping,
			 mode, status, total_count, success_count, error_count, error,
			 started_at, finished_at, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
		j.ID, j.TenantID, j.Name, j.SourceType, j.SourcePath, j.TargetType,
		j.Mapping, j.Mode, j.Status, j.TotalCount, j.SuccessCount, j.ErrorCount,
		j.Error, j.StartedAt, j.FinishedAt, j.CreatedAt,
	)
	return err
}

// GetJob returns a single import job by its UUID.
func (r *Repository) GetJob(ctx context.Context, id string) (*models.CMDBImportJob, error) {
	var j models.CMDBImportJob
	err := r.db.GetContext(ctx, &j,
		`SELECT id, tenant_id, name, source_type, source_path, target_type, mapping,
		        mode, status, total_count, success_count, error_count, error,
		        started_at, finished_at, created_at
		 FROM cmdb_import_jobs
		 WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &j, nil
}

// ListJobs returns paginated import jobs, optionally filtered by tenant and status.
func (r *Repository) ListJobs(ctx context.Context, tenantID, status string, offset, limit int) ([]models.CMDBImportJob, error) {
	var items []models.CMDBImportJob
	var err error

	if tenantID != "" && status != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, name, source_type, source_path, target_type, mapping,
			        mode, status, total_count, success_count, error_count, error,
			        started_at, finished_at, created_at
			 FROM cmdb_import_jobs
			 WHERE tenant_id = $1 AND status = $2
			 ORDER BY created_at DESC
			 OFFSET $3 LIMIT $4`,
			tenantID, status, offset, limit,
		)
	} else if tenantID != "" {
		// Default: tenant-level query (multi-tenant safety)
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, name, source_type, source_path, target_type, mapping,
			        mode, status, total_count, success_count, error_count, error,
			        started_at, finished_at, created_at
			 FROM cmdb_import_jobs
			 WHERE tenant_id = $1
			 ORDER BY created_at DESC
			 OFFSET $2 LIMIT $3`,
			tenantID, offset, limit,
		)
	} else if status != "" {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, name, source_type, source_path, target_type, mapping,
			        mode, status, total_count, success_count, error_count, error,
			        started_at, finished_at, created_at
			 FROM cmdb_import_jobs
			 WHERE status = $1
			 ORDER BY created_at DESC
			 OFFSET $2 LIMIT $3`,
			status, offset, limit,
		)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, name, source_type, source_path, target_type, mapping,
			        mode, status, total_count, success_count, error_count, error,
			        started_at, finished_at, created_at
			 FROM cmdb_import_jobs
			 ORDER BY created_at DESC
			 OFFSET $1 LIMIT $2`,
			offset, limit,
		)
	}
	return items, err
}

// CountJobs returns total job count, optionally filtered by tenant.
func (r *Repository) CountJobs(ctx context.Context, tenantID string) (int, error) {
	var count int
	if tenantID != "" {
		err := r.db.GetContext(ctx, &count,
			`SELECT COUNT(*) FROM cmdb_import_jobs WHERE tenant_id = $1`,
			tenantID,
		)
		return count, err
	}
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM cmdb_import_jobs`,
	)
	return count, err
}

// UpdateJobStatus transitions a job to a new status using a dynamic UPDATE.
func (r *Repository) UpdateJobStatus(ctx context.Context, id string, status string, errMsg *string, startedAt *time.Time, finishedAt *time.Time) (*models.CMDBImportJob, error) {
	setClauses := []string{"status = $1"}
	args := []interface{}{status}
	argIdx := 2

	if errMsg != nil {
		setClauses = append(setClauses, fmt.Sprintf("error = $%d", argIdx))
		args = append(args, *errMsg)
		argIdx++
	}
	if startedAt != nil {
		setClauses = append(setClauses, fmt.Sprintf("started_at = $%d", argIdx))
		args = append(args, *startedAt)
		argIdx++
	}
	if finishedAt != nil {
		setClauses = append(setClauses, fmt.Sprintf("finished_at = $%d", argIdx))
		args = append(args, *finishedAt)
		argIdx++
	}

	query := fmt.Sprintf(
		`UPDATE cmdb_import_jobs SET %s WHERE id = $%d
		 RETURNING id, tenant_id, name, source_type, source_path, target_type, mapping,
		           mode, status, total_count, success_count, error_count, error,
		           started_at, finished_at, created_at`,
		joinStrings(setClauses, ", "), argIdx,
	)
	args = append(args, id)

	var j models.CMDBImportJob
	err := r.db.GetContext(ctx, &j, query, args...)
	if err != nil {
		return nil, err
	}
	return &j, nil
}

// UpdateJobCounts updates the aggregate counters for a job.
func (r *Repository) UpdateJobCounts(ctx context.Context, id string, totalCount, successCount, errorCount int) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cmdb_import_jobs
		 SET total_count = $1, success_count = $2, error_count = $3
		 WHERE id = $4`,
		totalCount, successCount, errorCount, id,
	)
	return err
}

// IncrementJobCounters atomically increments success_count or error_count.
func (r *Repository) IncrementJobCounters(ctx context.Context, id string, incSuccess, incError int) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cmdb_import_jobs
		 SET total_count = total_count + $1,
		     success_count = success_count + $2,
		     error_count = error_count + $3
		 WHERE id = $4`,
		incSuccess+incError, incSuccess, incError, id,
	)
	return err
}

// DeleteJob removes an import job and its records.
func (r *Repository) DeleteJob(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM cmdb_import_jobs WHERE id = $1`,
		id,
	)
	return err
}

// ===========================================================================
// CMDB Import Record CRUD
// ===========================================================================

// CreateRecord inserts a new import record.
func (r *Repository) CreateRecord(ctx context.Context, rec *models.CMDBImportRecord) error {
	if rec.ID == "" {
		rec.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	rec.CreatedAt = now

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO cmdb_import_records
			(id, job_id, source_row, target_id, action, error, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		rec.ID, rec.JobID, rec.SourceRow, rec.TargetID,
		rec.Action, rec.Error, rec.CreatedAt,
	)
	return err
}

// ListRecordsByJob returns paginated records for a job.
func (r *Repository) ListRecordsByJob(ctx context.Context, jobID string, offset, limit int) ([]models.CMDBImportRecord, error) {
	var items []models.CMDBImportRecord
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, job_id, source_row, target_id, action, error, created_at
		 FROM cmdb_import_records
		 WHERE job_id = $1
		 ORDER BY created_at DESC
		 OFFSET $2 LIMIT $3`,
		jobID, offset, limit,
	)
	return items, err
}

// CountRecordsByJob returns record count for a job.
func (r *Repository) CountRecordsByJob(ctx context.Context, jobID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM cmdb_import_records WHERE job_id = $1`,
		jobID,
	)
	return count, err
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
