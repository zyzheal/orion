package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"orion/backup-svc-go/internal/models"
	"orion/go-common/pkg/database"
)

// BackupRepository handles all database operations for backups.
type BackupRepository struct {
	db *database.DB
}

func NewBackupRepository(db *database.DB) *BackupRepository {
	return &BackupRepository{db: db}
}

// ==================== Backup Plan ====================

func (r *BackupRepository) CreatePlan(ctx context.Context, plan *models.BackupPlan) error {
	target := plan.Target
	if target == nil {
		target = json.RawMessage("{}")
	}
	storageConfig := plan.StorageConfig
	if storageConfig == nil {
		storageConfig = json.RawMessage("{}")
	}

	query := `
		INSERT INTO backup_plans (tenant_id, name, type, schedule, retention_days, target,
			storage_config, encryption_key, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at`

	err := r.db.QueryRowContext(ctx, query,
		plan.TenantID, plan.Name, plan.Type, plan.Schedule,
		plan.RetentionDays, target, storageConfig, plan.EncryptionKey, plan.Enabled,
	).Scan(&plan.ID, &plan.CreatedAt, &plan.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create backup plan: %w", err)
	}
	return nil
}

func (r *BackupRepository) GetPlanByID(ctx context.Context, tenantID, id string) (*models.BackupPlan, error) {
	var plan models.BackupPlan
	query := `SELECT id, tenant_id, name, type, schedule, retention_days, target,
		storage_config, encryption_key, enabled, created_at, updated_at
		FROM backup_plans WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &plan, query, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("backup plan not found")
		}
		return nil, err
	}
	return &plan, nil
}

func (r *BackupRepository) ListPlans(ctx context.Context, tenantID string, offset, limit int) ([]models.BackupPlan, error) {
	var plans []models.BackupPlan
	query := `SELECT id, tenant_id, name, type, schedule, retention_days, target,
		storage_config, encryption_key, enabled, created_at, updated_at
		FROM backup_plans WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &plans, query, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return plans, nil
}

func (r *BackupRepository) UpdatePlan(ctx context.Context, plan *models.BackupPlan) error {
	target := plan.Target
	if target == nil {
		target = json.RawMessage("{}")
	}
	storageConfig := plan.StorageConfig
	if storageConfig == nil {
		storageConfig = json.RawMessage("{}")
	}

	query := `UPDATE backup_plans SET
		name = $1, type = $2, schedule = $3, retention_days = $4, target = $5,
		storage_config = $6, encryption_key = $7, enabled = $8, updated_at = NOW()
		WHERE id = $9 AND tenant_id = $10`

	_, err := r.db.ExecContext(ctx, query,
		plan.Name, plan.Type, plan.Schedule, plan.RetentionDays,
		target, storageConfig, plan.EncryptionKey, plan.Enabled,
		plan.ID, plan.TenantID,
	)
	return err
}

func (r *BackupRepository) DeletePlan(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM backup_plans WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// ==================== Backup Record ====================

func (r *BackupRepository) CreateBackup(ctx context.Context, record *models.BackupRecord) error {
	query := `
		INSERT INTO backup_records (tenant_id, plan_id, status, size_bytes,
			storage_path, checksum, compression_ratio, started_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		RETURNING id, created_at`

	err := r.db.QueryRowContext(ctx, query,
		record.TenantID, record.PlanID, record.Status, record.SizeBytes,
		record.StoragePath, record.Checksum, record.CompressionRatio,
	).Scan(&record.ID, &record.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create backup record: %w", err)
	}
	return nil
}

func (r *BackupRepository) GetBackupByID(ctx context.Context, tenantID, id string) (*models.BackupRecord, error) {
	var record models.BackupRecord
	query := `SELECT id, tenant_id, plan_id, status, size_bytes, storage_path,
		checksum, compression_ratio, error_message, started_at, completed_at, created_at
		FROM backup_records WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &record, query, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("backup not found")
		}
		return nil, err
	}
	return &record, nil
}

func (r *BackupRepository) ListBackups(ctx context.Context, tenantID string, filter models.BackupFilter, offset, limit int) ([]models.BackupRecord, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("tenant_id = $%d", argIdx))
	args = append(args, tenantID)
	argIdx++

	if filter.PlanID != "" {
		conditions = append(conditions, fmt.Sprintf("plan_id = $%d", argIdx))
		args = append(args, filter.PlanID)
		argIdx++
	}
	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, filter.Status)
		argIdx++
	}
	if filter.Type != "" {
		conditions = append(conditions, fmt.Sprintf("type = $%d", argIdx))
		args = append(args, filter.Type)
		argIdx++
	}

	where := "WHERE " + strings.Join(conditions, " AND ")
	query := fmt.Sprintf(`
		SELECT id, tenant_id, plan_id, status, size_bytes, storage_path,
			checksum, compression_ratio, error_message, started_at, completed_at, created_at
		FROM backup_records %s ORDER BY started_at DESC LIMIT $%d OFFSET $%d`,
		where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	var records []models.BackupRecord
	err := r.db.SelectContext(ctx, &records, query, args...)
	if err != nil {
		return nil, err
	}
	return records, nil
}

func (r *BackupRepository) UpdateBackupStatus(ctx context.Context, tenantID, id string, status models.BackupStatus, sizeBytes int64, storagePath, checksum *string, compressionRatio *float64) error {
	var errMessage interface{}
	var completedAt string
	if status == models.BackupStatusCompleted || status == models.BackupStatusFailed || status == models.BackupStatusVerified {
		completedAt = "NOW()"
	}

	fields := []string{"status = $1"}
	args := []interface{}{string(status)}
	argIdx := 1

	if completedAt != "" {
		fields = append(fields, fmt.Sprintf("completed_at = $%d", argIdx))
		args = append(args, completedAt)
		argIdx++
	}
	if sizeBytes > 0 {
		fields = append(fields, fmt.Sprintf("size_bytes = $%d", argIdx))
		args = append(args, sizeBytes)
		argIdx++
	}
	if storagePath != nil {
		fields = append(fields, fmt.Sprintf("storage_path = $%d", argIdx))
		args = append(args, storagePath)
		argIdx++
	}
	if checksum != nil {
		fields = append(fields, fmt.Sprintf("checksum = $%d", argIdx))
		args = append(args, checksum)
		argIdx++
	}
	if compressionRatio != nil {
		fields = append(fields, fmt.Sprintf("compression_ratio = $%d", argIdx))
		args = append(args, compressionRatio)
		argIdx++
	}
	if completedAt == "" {
		fields = append(fields, fmt.Sprintf("completed_at = $%d", argIdx))
		args = append(args, completedAt)
		argIdx++
	}

	// error_message handling
	if len(args) > 0 {
		fields = append(fields, fmt.Sprintf("error_message = $%d", argIdx))
		args = append(args, errMessage)
		argIdx++
	}

	fields = append(fields, fmt.Sprintf("updated_at = $%d", argIdx))
	args = append(args, "NOW()")
	argIdx++

	// Always append id and tenant_id
	args = append(args, id, tenantID)

	query := fmt.Sprintf("UPDATE backup_records SET %s WHERE id = $%d AND tenant_id = $%d",
		strings.Join(fields, ", "), argIdx, argIdx+1)

	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *BackupRepository) FailBackup(ctx context.Context, tenantID, id, errorMessage string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE backup_records SET status = $1, error_message = $2, completed_at = NOW()
		 WHERE id = $3 AND tenant_id = $4`,
		models.BackupStatusFailed, errorMessage, id, tenantID,
	)
	return err
}

func (r *BackupRepository) DeleteBackup(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM backup_records WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// ==================== Recovery Record ====================

func (r *BackupRepository) CreateRecovery(ctx context.Context, record *models.RecoveryRecord) error {
	stepExecutions := record.StepExecutions
	if stepExecutions == nil {
		stepExecutions = json.RawMessage("[]")
	}

	query := `
		INSERT INTO recovery_records (tenant_id, plan_id, plan_name, backup_id, status,
			target_time, rto_target_ms, rpo_target_ms, step_executions, initiated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		RETURNING id, created_at`

	err := r.db.QueryRowContext(ctx, query,
		record.TenantID, record.PlanID, record.PlanName, record.BackupID,
		string(record.Status), record.TargetTime, record.RtoTargetMs, record.RpoTargetMs,
		stepExecutions,
	).Scan(&record.ID, &record.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create recovery record: %w", err)
	}
	return nil
}

func (r *BackupRepository) GetRecoveryByID(ctx context.Context, tenantID, id string) (*models.RecoveryRecord, error) {
	var record models.RecoveryRecord
	query := `SELECT id, tenant_id, plan_id, plan_name, backup_id, status,
		target_time, rto_target_ms, rpo_target_ms, actual_rto_ms, actual_rpo_ms,
		rto_met, rpo_met, step_executions, error_message, initiated_at, completed_at, created_at
		FROM recovery_records WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &record, query, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("recovery record not found")
		}
		return nil, err
	}
	return &record, nil
}

func (r *BackupRepository) ListRecoveries(ctx context.Context, tenantID string, offset, limit int) ([]models.RecoveryRecord, error) {
	var records []models.RecoveryRecord
	query := `SELECT id, tenant_id, plan_id, plan_name, backup_id, status,
		target_time, rto_target_ms, rpo_target_ms, actual_rto_ms, actual_rpo_ms,
		rto_met, rpo_met, step_executions, error_message, initiated_at, completed_at, created_at
		FROM recovery_records WHERE tenant_id = $1 ORDER BY initiated_at DESC LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &records, query, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return records, nil
}

func (r *BackupRepository) UpdateRecoveryStatus(ctx context.Context, tenantID, id string, status models.RecoveryStatus, errorMessage *string, completedAt string, rtoMet, rpoMet *bool, actualRtoMs, actualRpoMs *int64) error {
	var errMsg interface{}
	if errorMessage != nil {
		errMsg = *errorMessage
	}

	fields := []string{"status = $1"}
	args := []interface{}{string(status)}
	argIdx := 1

	if completedAt != "" {
		fields = append(fields, fmt.Sprintf("completed_at = $%d", argIdx))
		args = append(args, completedAt)
		argIdx++
	}
	if rtoMet != nil {
		fields = append(fields, fmt.Sprintf("rto_met = $%d", argIdx))
		args = append(args, *rtoMet)
		argIdx++
	}
	if rpoMet != nil {
		fields = append(fields, fmt.Sprintf("rpo_met = $%d", argIdx))
		args = append(args, *rpoMet)
		argIdx++
	}
	if actualRtoMs != nil {
		fields = append(fields, fmt.Sprintf("actual_rto_ms = $%d", argIdx))
		args = append(args, *actualRtoMs)
		argIdx++
	}
	if actualRpoMs != nil {
		fields = append(fields, fmt.Sprintf("actual_rpo_ms = $%d", argIdx))
		args = append(args, *actualRpoMs)
		argIdx++
	}
	if errMsg != nil {
		fields = append(fields, fmt.Sprintf("error_message = $%d", argIdx))
		args = append(args, errMsg)
		argIdx++
	}

	args = append(args, id, tenantID)

	query := fmt.Sprintf("UPDATE recovery_records SET %s WHERE id = $%d AND tenant_id = $%d",
		strings.Join(fields, ", "), argIdx, argIdx+1)

	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// ==================== Verification Result ====================

func (r *BackupRepository) CreateVerification(ctx context.Context, vr *models.VerificationResult) error {
	query := `
		INSERT INTO verification_results (tenant_id, backup_id, status, integrity_check,
			integrity_details, restore_test, restore_details, started_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		RETURNING id`

	err := r.db.QueryRowContext(ctx, query,
		vr.TenantID, vr.BackupID, string(vr.Status), vr.IntegrityCheck,
		vr.IntegrityDetails, vr.RestoreTest, vr.RestoreDetails,
	).Scan(&vr.ID)
	if err != nil {
		return fmt.Errorf("failed to create verification result: %w", err)
	}
	return nil
}

func (r *BackupRepository) GetVerificationByID(ctx context.Context, tenantID, id string) (*models.VerificationResult, error) {
	var vr models.VerificationResult
	query := `SELECT id, tenant_id, backup_id, status, integrity_check, integrity_details,
		restore_test, restore_details, error_message, verified_at, started_at
		FROM verification_results WHERE id = $1 AND tenant_id = $2`
	err := r.db.GetContext(ctx, &vr, query, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("verification result not found")
		}
		return nil, err
	}
	return &vr, nil
}

func (r *BackupRepository) ListVerifications(ctx context.Context, tenantID, backupID string, offset, limit int) ([]models.VerificationResult, error) {
	var verifications []models.VerificationResult
	query := `SELECT id, tenant_id, backup_id, status, integrity_check, integrity_details,
		restore_test, restore_details, error_message, verified_at, started_at
		FROM verification_results WHERE tenant_id = $1 AND backup_id = $2 ORDER BY started_at DESC LIMIT $3 OFFSET $4`
	err := r.db.SelectContext(ctx, &verifications, query, tenantID, backupID, limit, offset)
	if err != nil {
		return nil, err
	}
	return verifications, nil
}

func (r *BackupRepository) UpdateVerification(ctx context.Context, vr *models.VerificationResult) error {
	query := `UPDATE verification_results SET
		status = $1, integrity_check = $2, integrity_details = $3, restore_test = $4,
		restore_details = $5, error_message = $6, verified_at = $7, updated_at = NOW()
		WHERE id = $8 AND tenant_id = $9`
	_, err := r.db.ExecContext(ctx, query,
		string(vr.Status), vr.IntegrityCheck, vr.IntegrityDetails, vr.RestoreTest,
		vr.RestoreDetails, vr.ErrorMessage, vr.VerifiedAt, vr.ID, vr.TenantID,
	)
	return err
}
