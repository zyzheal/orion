package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/infrastructure/backup/models"
	"orion/platform-svc-go/internal/infrastructure/backup/repository"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

var (
	ErrPlanNotFound   = errors.New("backup plan not found")
	ErrBackupNotFound = errors.New("backup not found")
	ErrInvalidPlan    = errors.New("invalid backup plan")
)

var backupTracer = otel.Tracer("orion-backup-svc/service")

// BackupService handles all business logic for backup plans, records, and storage.
type BackupService struct {
	repo     *repository.BackupRepository
	scheduler *Scheduler
	verifier  *Verifier
	logger    *zap.Logger
}

func NewBackupService(repo *repository.BackupRepository, logger *zap.Logger) *BackupService {
	svc := &BackupService{
		repo:  repo,
		logger: logger,
	}
	svc.scheduler = NewScheduler(svc, logger)
	svc.verifier = NewVerifier(svc, logger)
	return svc
}

// ==================== Backup Plan ====================

func (s *BackupService) CreatePlan(ctx context.Context, input models.CreateBackupPlanInput) (*models.BackupPlan, error) {
	ctx, span := backupTracer.Start(ctx, "BackupService.CreatePlan",
		trace.WithAttributes(attribute.String("tenant_id", input.TenantID)))
	defer span.End()

	if input.Name == "" {
		return nil, fmt.Errorf("%w: name is required", ErrInvalidPlan)
	}
	if input.Type == "" {
		return nil, fmt.Errorf("%w: type is required", ErrInvalidPlan)
	}
	if input.RetentionDays <= 0 {
		input.RetentionDays = 30 // default 30 days retention
	}

	plan := &models.BackupPlan{
		TenantID:      input.TenantID,
		Name:          input.Name,
		Type:          input.Type,
		RetentionDays: input.RetentionDays,
		Target:        input.Target,
		StorageConfig: input.StorageConfig,
		EncryptionKey: input.EncryptionKey,
		Enabled:       input.Enabled,
	}

	if input.Schedule != "" {
		plan.Schedule = &input.Schedule
	}

	if plan.Target == nil {
		plan.Target = json.RawMessage("{}")
	}
	if plan.StorageConfig == nil {
		plan.StorageConfig = json.RawMessage("{}")
	}

	if err := s.repo.CreatePlan(ctx, plan); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create plan")
		return nil, err
	}

	if plan.Enabled {
		s.scheduler.AddPlan(plan)
	}

	span.SetStatus(codes.Ok, "plan created")
	return plan, nil
}

func (s *BackupService) GetPlan(ctx context.Context, tenantID, id string) (*models.BackupPlan, error) {
	ctx, span := backupTracer.Start(ctx, "BackupService.GetPlan",
		trace.WithAttributes(attribute.String("plan_id", id)))
	defer span.End()

	plan, err := s.repo.GetPlanByID(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "plan not found")
		return nil, ErrPlanNotFound
	}
	return plan, nil
}

func (s *BackupService) ListPlans(ctx context.Context, tenantID string, offset, limit int) ([]models.BackupPlan, error) {
	ctx, span := backupTracer.Start(ctx, "BackupService.ListPlans",
		trace.WithAttributes(attribute.String("tenant_id", tenantID)))
	defer span.End()

	return s.repo.ListPlans(ctx, tenantID, offset, limit)
}

func (s *BackupService) UpdatePlan(ctx context.Context, tenantID, id string, input models.UpdateBackupPlanInput) (*models.BackupPlan, error) {
	ctx, span := backupTracer.Start(ctx, "BackupService.UpdatePlan",
		trace.WithAttributes(attribute.String("plan_id", id)))
	defer span.End()

	plan, err := s.repo.GetPlanByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrPlanNotFound
	}

	if input.Name != "" {
		plan.Name = input.Name
	}
	if input.Type != "" {
		plan.Type = input.Type
	}
	if input.Schedule != "" {
		plan.Schedule = &input.Schedule
	}
	if input.RetentionDays != nil {
		plan.RetentionDays = *input.RetentionDays
	}
	if input.Target != nil {
		plan.Target = input.Target
	}
	if input.StorageConfig != nil {
		plan.StorageConfig = input.StorageConfig
	}
	if input.EncryptionKey != nil {
		plan.EncryptionKey = input.EncryptionKey
	}
	if input.Enabled != nil {
		plan.Enabled = *input.Enabled
	}

	if err := s.repo.UpdatePlan(ctx, plan); err != nil {
		span.RecordError(err)
		return nil, err
	}

	s.scheduler.UpdatePlan(plan)
	return plan, nil
}

func (s *BackupService) DeletePlan(ctx context.Context, tenantID, id string) error {
	ctx, span := backupTracer.Start(ctx, "BackupService.DeletePlan",
		trace.WithAttributes(attribute.String("plan_id", id)))
	defer span.End()

	s.scheduler.RemovePlan(id)
	return s.repo.DeletePlan(ctx, tenantID, id)
}

// ==================== Backup Execution ====================

// TriggerBackup initiates a manual backup for the given plan.
func (s *BackupService) TriggerBackup(ctx context.Context, input models.CreateBackupInput) (*models.BackupRecord, error) {
	ctx, span := backupTracer.Start(ctx, "BackupService.TriggerBackup",
		trace.WithAttributes(attribute.String("plan_id", input.PlanID)))
	defer span.End()

	plan, err := s.repo.GetPlanByID(ctx, input.TenantID, input.PlanID)
	if err != nil {
		span.RecordError(err)
		return nil, ErrPlanNotFound
	}

	return s.executeBackup(ctx, plan)
}

// executeBackup performs the actual backup operation.
func (s *BackupService) executeBackup(ctx context.Context, plan *models.BackupPlan) (*models.BackupRecord, error) {
	// Create backup record with running status
	record := &models.BackupRecord{
		TenantID: plan.TenantID,
		PlanID:   plan.ID,
		Status:   models.BackupStatusRunning,
	}

	if err := s.repo.CreateBackup(ctx, record); err != nil {
		return nil, fmt.Errorf("failed to create backup record: %w", err)
	}

	// Simulate backup execution (in production, this would interact with storage)
	// Generate a simulated checksum
	data := fmt.Sprintf("backup-data-%s-%d", record.ID, time.Now().Unix())
	hash := sha256.Sum256([]byte(data))
	checksum := hex.EncodeToString(hash[:])

	// Simulate compression ratio
	compressionRatio := 1.5

	// Complete the backup
	storagePath := fmt.Sprintf("/var/backups/orion/%s.bak", record.ID)
	if err := s.repo.UpdateBackupStatus(ctx, record.TenantID, record.ID,
		models.BackupStatusCompleted, 1024*1024, &storagePath, &checksum, &compressionRatio); err != nil {
		s.logger.Error("failed to complete backup", zap.String("backup_id", record.ID), zap.Error(err))
		_ = s.repo.FailBackup(ctx, record.TenantID, record.ID, err.Error())
		return nil, err
	}

	// Update record with new values
	record.Status = models.BackupStatusCompleted
	record.StoragePath = &storagePath
	record.Checksum = &checksum
	record.CompressionRatio = &compressionRatio
	record.SizeBytes = 1024 * 1024

	// Auto-verify if plan has encryption
	if plan.EncryptionKey != nil {
		go func() {
			if _, err := s.verifier.Verify(context.Background(), record.TenantID, record.ID); err == nil {
				s.logger.Info("backup auto-verified", zap.String("backup_id", record.ID))
				_ = s.repo.UpdateBackupStatus(context.Background(), record.TenantID, record.ID,
					models.BackupStatusVerified, record.SizeBytes, record.StoragePath, record.Checksum, record.CompressionRatio)
			}
		}()
	}

	return record, nil
}

// ==================== Backup Records ====================

func (s *BackupService) GetBackup(ctx context.Context, tenantID, id string) (*models.BackupRecord, error) {
	ctx, span := backupTracer.Start(ctx, "BackupService.GetBackup",
		trace.WithAttributes(attribute.String("backup_id", id)))
	defer span.End()

	record, err := s.repo.GetBackupByID(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		return nil, ErrBackupNotFound
	}
	return record, nil
}

func (s *BackupService) ListBackups(ctx context.Context, tenantID string, filter models.BackupFilter, offset, limit int) ([]models.BackupRecord, error) {
	ctx, span := backupTracer.Start(ctx, "BackupService.ListBackups",
		trace.WithAttributes(attribute.String("tenant_id", tenantID)))
	defer span.End()

	return s.repo.ListBackups(ctx, tenantID, filter, offset, limit)
}

func (s *BackupService) DeleteBackup(ctx context.Context, tenantID, id string) error {
	ctx, span := backupTracer.Start(ctx, "BackupService.DeleteBackup",
		trace.WithAttributes(attribute.String("backup_id", id)))
	defer span.End()

	return s.repo.DeleteBackup(ctx, tenantID, id)
}

// GetBackupStats returns summary statistics for a tenant's backups.
func (s *BackupService) GetBackupStats(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	backups, err := s.repo.ListBackups(ctx, tenantID, models.BackupFilter{}, 0, 1000)
	if err != nil {
		return nil, err
	}

	var completedCount, failedCount, verifiedCount, runningCount int
	var totalSize int64
	var lastCompleted *time.Time

	for _, b := range backups {
		switch b.Status {
		case models.BackupStatusCompleted:
			completedCount++
		case models.BackupStatusFailed:
			failedCount++
		case models.BackupStatusVerified:
			verifiedCount++
		case models.BackupStatusRunning:
			runningCount++
		}
		totalSize += b.SizeBytes

		if b.CompletedAt != nil {
			if lastCompleted == nil || b.CompletedAt.After(*lastCompleted) {
				t := *b.CompletedAt
				lastCompleted = &t
			}
		}
	}

	return map[string]interface{}{
		"total_backups":      len(backups),
		"completed_backups":  completedCount,
		"failed_backups":     failedCount,
		"verified_backups":   verifiedCount,
		"running_backups":    runningCount,
		"total_size_bytes":   totalSize,
		"last_completed_at":  lastCompleted,
	}, nil
}
