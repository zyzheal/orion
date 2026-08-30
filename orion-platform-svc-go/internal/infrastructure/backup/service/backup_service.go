package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"orion/platform-svc-go/internal/infrastructure/backup/executor"
	"orion/platform-svc-go/internal/infrastructure/backup/models"
	"orion/platform-svc-go/internal/infrastructure/backup/repository"
	"orion/platform-svc-go/internal/infrastructure/backup/storage"

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
	repo      *repository.BackupRepository
	scheduler *Scheduler
	verifier  *Verifier
	logger    *zap.Logger

	// execRegistry routes to the engine-specific backup/restore executor.
	// Always non-nil after NewBackupService; SetExecutorRegistry allows
	// test doubles to substitute a fake registry.
	execRegistry *executor.Registry
	// storageBackends maps storage type -> backend. When nil, artifacts
	// are written to local disk only (see writeArtifact).
	storageBackends map[string]storage.StorageBackend
	// baseBackupDir is the local scratch directory where artifacts are
	// written before any optional storage backend upload. Defaults to
	// /var/backups/orion.
	baseBackupDir string
}

// NewBackupService creates the service with a default Executor registry and
// no remote storage backends. Callers that need S3/MinIO wiring should use
// SetStorageBackend after construction.
func NewBackupService(repo *repository.BackupRepository, logger *zap.Logger) *BackupService {
	svc := &BackupService{
		repo:          repo,
		logger:        logger,
		execRegistry:  executor.NewRegistry(),
		storageBackends: map[string]storage.StorageBackend{},
		baseBackupDir: "/var/backups/orion",
	}
	svc.scheduler = NewScheduler(svc, logger)
	svc.verifier = NewVerifier(svc, logger)
	svc.verifier.SetExecutorRegistry(svc.execRegistry)
	return svc
}

// SetExecutorRegistry swaps the executor registry. Used by tests and by
// wiring code that wants to inject custom binaries.
func (s *BackupService) SetExecutorRegistry(reg *executor.Registry) {
	s.execRegistry = reg
	s.verifier.SetExecutorRegistry(reg)
}

// SetStorageBackend registers a storage backend for the given type key.
// Duplicate registrations replace the previous one.
func (s *BackupService) SetStorageBackend(typ string, b storage.StorageBackend) {
	if s.storageBackends == nil {
		s.storageBackends = map[string]storage.StorageBackend{}
	}
	s.storageBackends[typ] = b
}

// SetBaseBackupDir overrides the default /var/backups/orion scratch path.
// Called during wiring so operators can relocate scratch on any mount.
func (s *BackupService) SetBaseBackupDir(dir string) {
	if dir != "" {
		s.baseBackupDir = dir
	}
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

// executeBackup performs the actual backup operation. It routes to the
// engine-specific executor (PG/MySQL/OceanBase), uploads the artifact to the
// configured storage backend, and stores the resulting path/checksum on the
// record. Any failure flips the record to BackupStatusFailed with a
// machine-readable error message — there is no silent partial-success path.
func (s *BackupService) executeBackup(ctx context.Context, plan *models.BackupPlan) (*models.BackupRecord, error) {
	record := &models.BackupRecord{
		TenantID: plan.TenantID,
		PlanID:   plan.ID,
		Status:   models.BackupStatusRunning,
	}
	if err := s.repo.CreateBackup(ctx, record); err != nil {
		return nil, fmt.Errorf("failed to create backup record: %w", err)
	}

	// Parse the plan target and storage config up-front so configuration
	// errors surface here, before any subprocess is spawned.
	var target models.BackupTarget
	if err := json.Unmarshal(plan.Target, &target); err != nil {
		s.failBackup(ctx, record, "invalid plan target: "+err.Error())
		return nil, fmt.Errorf("invalid plan target: %w", err)
	}
	var storageCfg models.BackupStorageConfig
	if len(plan.StorageConfig) > 0 {
		if err := json.Unmarshal(plan.StorageConfig, &storageCfg); err != nil {
			s.failBackup(ctx, record, "invalid storage_config: "+err.Error())
			return nil, fmt.Errorf("invalid storage_config: %w", err)
		}
	}

	conn := executor.ConnInfo{
		Host:       target.Host,
		Port:       target.Port,
		DB:         target.DB,
		User:       target.User,
		Password:   target.Password,
		SSLMode:    target.SSLMode,
		TenantName: target.TenantName,
	}

	d := executor.Dialect(target.Dialect)
	be, ok := s.execRegistry.BackupFor(d)
	if !ok {
		s.failBackup(ctx, record, fmt.Sprintf("no backup executor for dialect %q", d))
		return nil, fmt.Errorf("no backup executor for dialect %q", d)
	}

	// Compute the scratch + artifact paths. Local scratch always exists so
	// the executor has a definite write target; the storage upload runs
	// afterwards if a remote backend is configured.
	baseDir := s.baseBackupDir
	if baseDir == "" {
		baseDir = "/var/backups/orion"
	}
	if err := os.MkdirAll(baseDir, 0o750); err != nil {
		s.failBackup(ctx, record, "scratch base unavailable: "+err.Error())
		return nil, fmt.Errorf("scratch base unavailable: %w", err)
	}
	artifactName := fmt.Sprintf("%s-%d.dump", plan.ID, time.Now().Unix())
	artifactPath := filepath.Join(baseDir, artifactName)

	opts := executor.BackupOptions{
		Type:        string(plan.Type),
		Format:      "custom",
		Compression: 6,
		Databases:   nonEmptyStrings(target.DB),
		Tables:      target.Tables,
		Exclude:     target.Exclude,
		OutputPath:  artifactPath,
	}
	if plan.EncryptionKey != nil && *plan.EncryptionKey != "" {
		opts.EncryptKey = []byte(*plan.EncryptionKey)
	}

	s.logger.Info("backup executing",
		zap.String("backup_id", record.ID),
		zap.String("dialect", string(d)),
		zap.String("artifact", artifactPath),
	)

	res, err := be.Backup(ctx, conn, opts)
	if err != nil {
		os.Remove(artifactPath)
		s.failBackup(ctx, record, "executor failed: "+err.Error())
		return nil, fmt.Errorf("backup executor failed: %w", err)
	}

	// If a matching remote storage backend is configured, upload the
	// artifact and point the record at the remote path. Otherwise the
	// local path is authoritative and used by the Verifier.
	finalPath := res.OutputPath
	if b := s.storageBackendFor(storageCfg); b != nil {
		remoteKey := renderPathTemplate(storageCfg.PathTemplate, plan.ID, record.ID)
		if err := s.uploadArtifact(ctx, b, remoteKey, artifactPath); err != nil {
			os.Remove(artifactPath)
			s.failBackup(ctx, record, "storage upload failed: "+err.Error())
			return nil, fmt.Errorf("storage upload failed: %w", err)
		}
		os.Remove(artifactPath)
		finalPath = fmt.Sprintf("%s://%s", b.Type(), remoteKey)
	}

	size := res.SizeBytes
	if size == 0 {
		if n, err := executor.FileSize(finalPath); err == nil {
			size = n
		}
	}
	compRatio := res.CompressionRatio
	if compRatio == 0 {
		compRatio = 1.0
	}

	if err := s.repo.UpdateBackupStatus(ctx, record.TenantID, record.ID,
		models.BackupStatusCompleted, size, &finalPath, &res.ChecksumSHA256, &compRatio); err != nil {
		s.logger.Error("failed to complete backup record", zap.String("backup_id", record.ID), zap.Error(err))
		_ = s.repo.FailBackup(ctx, record.TenantID, record.ID, err.Error())
		return nil, err
	}

	record.Status = models.BackupStatusCompleted
	record.StoragePath = &finalPath
	record.Checksum = &res.ChecksumSHA256
	record.CompressionRatio = &compRatio
	record.SizeBytes = size

	return record, nil
}

// failBackup marks the record as failed with a stable error message so
// callers can distinguish a real DB write failure from a genuine backup
// failure.
func (s *BackupService) failBackup(ctx context.Context, record *models.BackupRecord, msg string) {
	_ = s.repo.FailBackup(ctx, record.TenantID, record.ID, msg)
	s.logger.Error("backup failed", zap.String("backup_id", record.ID), zap.String("reason", msg))
}

// storageBackendFor resolves the StorageBackend for a plan's storage config,
// or returns nil when no remote backend is configured for the type.
func (s *BackupService) storageBackendFor(cfg models.BackupStorageConfig) storage.StorageBackend {
	typ := cfg.Type
	if typ == "" {
		typ = "local"
	}
	// Local is never a "remote" backend here; the executor already wrote to
	// local scratch. Return nil so we keep the local path.
	if typ == "local" {
		return nil
	}
	if b, ok := s.storageBackends[typ]; ok {
		return b
	}
	if b, ok := s.storageBackends["s3"]; ok && (typ == "minio" || typ == "s3") {
		return b
	}
	return nil
}

// StorageBackendForPublic is the exported variant of storageBackendFor. It
// is intended for external callers (Archiver) that need to resolve the
// same backend instance the BackupService uses — keeps the private map
// encapsulated.
func (s *BackupService) StorageBackendForPublic(cfg models.BackupStorageConfig) storage.StorageBackend {
	return s.storageBackendFor(cfg)
}

// uploadArtifact reads a local file and PUTs it to the storage backend.
// The artifact is streamed so large backups do not need to be buffered in
// memory.
func (s *BackupService) uploadArtifact(ctx context.Context, b storage.StorageBackend, remoteKey, localPath string) error {
	f, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer f.Close()
	return b.Put(ctx, remoteKey, f)
}

// renderPathTemplate substitutes {{plan_id}} and {{backup_id}} placeholders
// in the storage path template. When template is empty we return a stable
// fallback path derived from the IDs.
func renderPathTemplate(tmpl, planID, backupID string) string {
	if tmpl == "" {
		tmpl = "{{plan_id}}/{{backup_id}}"
	}
	out := strings.ReplaceAll(tmpl, "{{plan_id}}", planID)
	out = strings.ReplaceAll(out, "{{backup_id}}", backupID)
	return strings.TrimPrefix(out, "/")
}

// nonEmptyStrings returns the input wrapped in a single-element slice, or
// nil when the input is empty — executors treat nil Databases as "dump all".
func nonEmptyStrings(s string) []string {
	if s == "" {
		return nil
	}
	return []string{s}
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
		"total_backups":     len(backups),
		"completed_backups": completedCount,
		"failed_backups":    failedCount,
		"verified_backups":  verifiedCount,
		"running_backups":   runningCount,
		"total_size_bytes":  totalSize,
		"last_completed_at": lastCompleted,
	}, nil
}

// Verify delegates to the verifier to validate a backup's integrity.
func (s *BackupService) Verify(ctx context.Context, tenantID, backupID string) (*models.VerificationResult, error) {
	if s.verifier == nil {
		return nil, fmt.Errorf("verifier not configured")
	}
	return s.verifier.Verify(ctx, tenantID, backupID)
}
