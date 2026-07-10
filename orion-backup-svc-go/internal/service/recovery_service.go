package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/backup-svc-go/internal/models"
	"orion/backup-svc-go/internal/repository"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

var (
	ErrRecoveryNotFound = errors.New("recovery plan not found")
	ErrInvalidRecovery  = errors.New("invalid recovery")
)

var recoveryTracer = otel.Tracer("orion-backup-svc/recovery")

// RecoveryService handles recovery plan and execution logic.
type RecoveryService struct {
	repo   *repository.BackupRepository
	logger *zap.Logger
}

func NewRecoveryService(repo *repository.BackupRepository, logger *zap.Logger) *RecoveryService {
	return &RecoveryService{
		repo:   repo,
		logger: logger,
	}
}

// CreateRecovery initiates a new recovery for the given plan.
func (s *RecoveryService) CreateRecovery(ctx context.Context, input models.CreateRecoveryInput) (*models.RecoveryRecord, error) {
	ctx, span := recoveryTracer.Start(ctx, "RecoveryService.CreateRecovery",
		trace.WithAttributes(attribute.String("plan_id", input.PlanID)))
	defer span.End()

	if input.PlanID == "" {
		return nil, fmt.Errorf("%w: plan_id is required", ErrInvalidRecovery)
	}

	record := &models.RecoveryRecord{
		TenantID:   input.TenantID,
		PlanID:     input.PlanID,
		PlanName:   fmt.Sprintf("recovery-plan-%s", input.PlanID),
		BackupID:   input.BackupID,
		Status:     models.RecoveryStatusInitiated,
		TargetTime: input.TargetTime,
		RtoTargetMs: 3600000, // default 1 hour
		RpoTargetMs: 86400000, // default 1 day
	}

	if err := s.repo.CreateRecovery(ctx, record); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create recovery")
		return nil, err
	}

	return record, nil
}

// GetRecovery retrieves a recovery record by ID.
func (s *RecoveryService) GetRecovery(ctx context.Context, tenantID, id string) (*models.RecoveryRecord, error) {
	ctx, span := recoveryTracer.Start(ctx, "RecoveryService.GetRecovery",
		trace.WithAttributes(attribute.String("recovery_id", id)))
	defer span.End()

	record, err := s.repo.GetRecoveryByID(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		return nil, ErrRecoveryNotFound
	}
	return record, nil
}

// ListRecoveries lists all recoveries for a tenant.
func (s *RecoveryService) ListRecoveries(ctx context.Context, tenantID string, offset, limit int) ([]models.RecoveryRecord, error) {
	ctx, span := recoveryTracer.Start(ctx, "RecoveryService.ListRecoveries",
		trace.WithAttributes(attribute.String("tenant_id", tenantID)))
	defer span.End()

	return s.repo.ListRecoveries(ctx, tenantID, offset, limit)
}

// ExecuteRecovery executes the recovery plan for a given recovery record.
func (s *RecoveryService) ExecuteRecovery(ctx context.Context, tenantID, id string) (*models.RecoveryRecord, error) {
	ctx, span := recoveryTracer.Start(ctx, "RecoveryService.ExecuteRecovery",
		trace.WithAttributes(attribute.String("recovery_id", id)))
	defer span.End()

	record, err := s.repo.GetRecoveryByID(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		return nil, ErrRecoveryNotFound
	}

	// Simulate recovery execution
	startTime := time.Now()

	// In production, this would execute actual recovery steps
	// Step 1: verify backup integrity
	// Step 2: restore data
	// Step 3: verify restoration
	// Step 4: complete

	// Simulate some processing time
	_ = startTime.Add(500 * time.Millisecond)

	// Mark as completed
	actualRtoMs := time.Since(startTime).Milliseconds()
	if actualRtoMs < 0 {
		actualRtoMs = 500
	}
	rtoMet := actualRtoMs <= 3600000 // 1 hour target

	actualRpoMs := int64(300000) // 5 minutes data loss window
	rpoMet := actualRpoMs <= 86400000 // 1 day target

	err = s.repo.UpdateRecoveryStatus(ctx, tenantID, id,
		models.RecoveryStatusCompleted, nil, "NOW()",
		&rtoMet, &rpoMet, &actualRtoMs, &actualRpoMs)

	if err != nil {
		span.RecordError(err)
		s.logger.Error("failed to complete recovery", zap.String("recovery_id", id), zap.Error(err))
		// Update status to failed
		_ = s.repo.UpdateRecoveryStatus(ctx, tenantID, id,
			models.RecoveryStatusFailed, nil, "NOW()", nil, nil, nil, nil)
		return nil, fmt.Errorf("failed to complete recovery: %w", err)
	}

	// Update local record
	record.Status = models.RecoveryStatusCompleted
	record.ActualRtoMs = &actualRtoMs
	record.ActualRpoMs = &actualRpoMs
	record.RtoMet = &rtoMet
	record.RpoMet = &rpoMet

	return record, nil
}

// RollbackRecovery rolls back an in-progress or failed recovery.
func (s *RecoveryService) RollbackRecovery(ctx context.Context, tenantID, id string) (*models.RecoveryRecord, error) {
	ctx, span := recoveryTracer.Start(ctx, "RecoveryService.RollbackRecovery",
		trace.WithAttributes(attribute.String("recovery_id", id)))
	defer span.End()

	record, err := s.repo.GetRecoveryByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrRecoveryNotFound
	}

	if record.Status != models.RecoveryStatusInProgress && record.Status != models.RecoveryStatusFailed {
		return nil, fmt.Errorf("%w: can only rollback in-progress or failed recoveries", ErrInvalidRecovery)
	}

	if err := s.repo.UpdateRecoveryStatus(ctx, tenantID, id,
		models.RecoveryStatusRolledBack, nil, "NOW()", nil, nil, nil, nil); err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to rollback recovery: %w", err)
	}

	record.Status = models.RecoveryStatusRolledBack
	return record, nil
}
