package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/backup/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Backup Plans ---

func (r *Repository) CreatePlan(ctx context.Context, plan *models.BackupPlan) error {
	plan.ID = uuid.New().String()
	plan.CreatedAt = time.Now().UTC()
	plan.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO backup_policies (id, tenant_id, name, schedule, retention_days, sources, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :schedule, :retentionDays, :sources, :createdAt, :updatedAt)`,
		plan)
	return err
}

func (r *Repository) GetPlanByID(ctx context.Context, id string, tenantID string) (*models.BackupPlan, error) {
	var plan models.BackupPlan
	err := r.db.GetContext(ctx, &plan,
		`SELECT * FROM backup_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &plan, nil
}

func (r *Repository) ListPlans(ctx context.Context, tenantID string) ([]models.BackupPlan, error) {
	var plans []models.BackupPlan
	err := r.db.SelectContext(ctx, &plans,
		`SELECT * FROM backup_policies WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return plans, err
}

func (r *Repository) UpdatePlan(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.BackupPlan, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE backup_policies SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetPlanByID(ctx, id, tenantID)
}

func (r *Repository) DeletePlan(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM backup_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Recovery Plans ---

func (r *Repository) CreateRecoveryPlan(ctx context.Context, plan *models.RecoveryPlan) error {
	plan.ID = uuid.New().String()
	plan.CreatedAt = time.Now().UTC()
	plan.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO backup_policies (id, tenant_id, name, schedule, retention_days, sources, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, NULL, 7, '[]', :createdAt, :updatedAt)`,
		plan)
	return err
}

func (r *Repository) GetRecoveryPlanByID(ctx context.Context, id string, tenantID string) (*models.RecoveryPlan, error) {
	var plan models.RecoveryPlan
	err := r.db.GetContext(ctx, &plan,
		`SELECT id, tenant_id AS "tenantId", name, 'recovery' AS status, created_at AS "createdAt", updated_at AS "updatedAt"
		 FROM backup_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &plan, nil
}

func (r *Repository) ListRecoveryPlans(ctx context.Context, tenantID string) ([]models.RecoveryPlan, error) {
	var plans []models.RecoveryPlan
	err := r.db.SelectContext(ctx, &plans,
		`SELECT id, tenant_id AS "tenantId", name, 'recovery' AS status, created_at AS "createdAt", updated_at AS "updatedAt"
		 FROM backup_policies WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return plans, err
}

func (r *Repository) UpdateRecoveryPlan(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.RecoveryPlan, error) {
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		// Skip keys that don't exist in backup_policies table
		if key == "status" {
			continue
		}
		args = append(args, val)
		i++
	}
	if len(setClauses) == 0 {
		return nil, sentinel.NotFound
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE backup_policies SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetRecoveryPlanByID(ctx, id, tenantID)
}

func (r *Repository) DeleteRecoveryPlan(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM backup_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Backup Jobs ---

func (r *Repository) CreateJob(ctx context.Context, job *models.BackupJob) error {
	job.ID = uuid.New().String()
	job.Status = "started"
	job.Progress = new(float64)
	*job.Progress = 0
	now := time.Now().UTC()
	job.StartedAt = &now
	job.CreatedAt = now
	job.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO backup_jobs (id, tenant_id, type, source, status, progress, started_at, completed_at, created_at, updated_at)
		 VALUES (:id, :tenantId, :type, :source, :status, :progress, :startedAt, :completedAt, :createdAt, :updatedAt)`,
		job)
	return err
}

func (r *Repository) GetJobByID(ctx context.Context, id string, tenantID string) (*models.BackupJob, error) {
	var job models.BackupJob
	err := r.db.GetContext(ctx, &job,
		`SELECT * FROM backup_jobs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *Repository) ListJobs(ctx context.Context, tenantID string, status *string) ([]models.BackupJob, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *status)
	}
	var jobs []models.BackupJob
	err := r.db.SelectContext(ctx, &jobs,
		fmt.Sprintf(`SELECT * FROM backup_jobs %s ORDER BY created_at DESC`, where), args...)
	return jobs, err
}

// --- Restores ---

func (r *Repository) CreateRestore(ctx context.Context, restore *models.Restore) error {
	restore.ID = uuid.New().String()
	restore.Status = "initiated"
	now := time.Now().UTC()
	restore.CreatedAt = now
	restore.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO backup_restores (id, tenant_id, backup_job_id, status, restored_at, created_at, updated_at)
		 VALUES (:id, :tenantId, :backupJobId, :status, :restoredAt, :createdAt, :updatedAt)`,
		restore)
	return err
}

func (r *Repository) VerifyBackup(ctx context.Context, jobID string, tenantID string) (*models.BackupJob, error) {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE backup_jobs SET status=$1, progress=$2, updated_at=$3 WHERE id=$4 AND tenant_id=$5`,
		"verified", 100.0, now, jobID, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetJobByID(ctx, jobID, tenantID)
}

// CountPlans returns the count of backup plans for a tenant.
func (r *Repository) CountPlans(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM backup_policies WHERE tenant_id=$1`, tenantID)
	return count, err
}

// CountRecoveryPlans returns the count of recovery plans for a tenant.
func (r *Repository) CountRecoveryPlans(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM backup_policies WHERE tenant_id=$1`, tenantID)
	return count, err
}

// CountBackups returns the count of backup jobs for a tenant.
func (r *Repository) CountBackups(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM backup_jobs WHERE tenant_id=$1`, tenantID)
	return count, err
}
