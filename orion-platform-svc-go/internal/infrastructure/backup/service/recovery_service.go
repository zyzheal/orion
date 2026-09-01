package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	ErrRecoveryNotFound = errors.New("recovery plan not found")
	ErrInvalidRecovery  = errors.New("invalid recovery")
)

var recoveryTracer = otel.Tracer("orion-backup-svc/recovery")

// RecoveryService handles recovery plan and execution logic. It resolves the
// engine-specific restore executor (PG/MySQL/OceanBase) from the plan target
// and drives the real restore pipeline — there is no simulated fast path.
type RecoveryService struct {
	repo   *repository.BackupRepository
	logger *zap.Logger

	// execRegistry routes to the engine-specific restore executor. Always
	// non-nil after NewRecoveryService; tests can substitute via
	// SetExecutorRegistry.
	execRegistry *executor.Registry
	// storageBackends lets us pull a remote artifact back to local scratch
	// before feeding it to the executor. Empty map means local-only.
	storageBackends map[string]storage.StorageBackend
	// baseBackupDir is the scratch directory where remote artifacts are
	// downloaded to before restore. Defaults to /var/backups/orion.
	baseBackupDir string
	// backupSvc is needed to look up the plan's encryption key for
	// encrypted artifacts.
	backupSvc *BackupService
	// archiveScheduler is optional; when set, recovery workflows can
	// trigger scheduled archive runs for the plan.
	archiveScheduler *ArchiveScheduler
	// archiver is the WAL/binlog archiver used by ExecuteRecoveryPITR.
	archiver *Archiver
}

// NewRecoveryService creates a recovery service with a default executor
// registry and local-only storage. Callers that need remote artifact pull
// should wire storageBackends via SetStorageBackend.
func NewRecoveryService(repo *repository.BackupRepository, logger *zap.Logger) *RecoveryService {
	return &RecoveryService{
		repo:            repo,
		logger:          logger,
		execRegistry:    executor.NewRegistry(),
		storageBackends: map[string]storage.StorageBackend{},
		baseBackupDir:   "/var/backups/orion",
	}
}

// SetExecutorRegistry swaps the executor registry. Used by tests and wiring.
func (s *RecoveryService) SetExecutorRegistry(reg *executor.Registry) {
	s.execRegistry = reg
}

// SetStorageBackend registers a storage backend for the given type key.
func (s *RecoveryService) SetStorageBackend(typ string, b storage.StorageBackend) {
	if s.storageBackends == nil {
		s.storageBackends = map[string]storage.StorageBackend{}
	}
	s.storageBackends[typ] = b
}

// SetBaseBackupDir overrides the default scratch path.
func (s *RecoveryService) SetBaseBackupDir(dir string) {
	if dir != "" {
		s.baseBackupDir = dir
	}
}

// SetBackupService wires the backup service so we can look up the plan's
// encryption key when decrypting an artifact before restore.
func (s *RecoveryService) SetBackupService(bsvc *BackupService) {
	s.backupSvc = bsvc
}

// SetArchiveScheduler wires the archive scheduler so the service can
// trigger scheduled archive runs from recovery workflows. Optional — nil
// is allowed in tests that never fire scheduled jobs.
func (s *RecoveryService) SetArchiveScheduler(sc *ArchiveScheduler) {
	s.archiveScheduler = sc
}

// SetArchiver wires the archiver so recovery can pull archive records
// directly (used by ExecuteRecoveryPITR).
func (s *RecoveryService) SetArchiver(a *Archiver) {
	s.archiver = a
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
		TenantID:    input.TenantID,
		PlanID:      input.PlanID,
		PlanName:    fmt.Sprintf("recovery-plan-%s", input.PlanID),
		BackupID:    input.BackupID,
		Status:      models.RecoveryStatusInitiated,
		TargetTime:  input.TargetTime,
		RtoTargetMs: 3600000,  // default 1 hour
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
// It looks up the backup artifact, resolves the plan target to select the
// engine-specific executor, and drives the real restore pipeline. RTO and
// RPO are computed from real elapsed time; there is no simulated fast path.
func (s *RecoveryService) ExecuteRecovery(ctx context.Context, tenantID, id string) (*models.RecoveryRecord, error) {
	ctx, span := recoveryTracer.Start(ctx, "RecoveryService.ExecuteRecovery",
		trace.WithAttributes(attribute.String("recovery_id", id)))
	defer span.End()

	record, err := s.repo.GetRecoveryByID(ctx, tenantID, id)
	if err != nil || record == nil {
		span.RecordError(err)
		return nil, ErrRecoveryNotFound
	}

	plan, err := s.repo.GetPlanByID(ctx, tenantID, record.PlanID)
	if err != nil || plan == nil {
		return nil, s.markFailed(ctx, tenantID, id, "plan not found")
	}
	if record.BackupID == nil || *record.BackupID == "" {
		return nil, s.markFailed(ctx, tenantID, id, "recovery has no backup_id")
	}
	backup, err := s.repo.GetBackupByID(ctx, tenantID, *record.BackupID)
	if err != nil || backup == nil {
		return nil, s.markFailed(ctx, tenantID, id, "backup not found")
	}
	if backup.StoragePath == nil || *backup.StoragePath == "" {
		return nil, s.markFailed(ctx, tenantID, id, "backup has no storage_path")
	}

	var target models.BackupTarget
	if err := json.Unmarshal(plan.Target, &target); err != nil {
		return nil, s.markFailed(ctx, tenantID, id, "invalid plan target: "+err.Error())
	}

	var storageCfg models.BackupStorageConfig
	if len(plan.StorageConfig) > 0 {
		if err := json.Unmarshal(plan.StorageConfig, &storageCfg); err != nil {
			return nil, s.markFailed(ctx, tenantID, id, "invalid storage_config: "+err.Error())
		}
	}

	// Resolve the artifact to a local path. If the backup was uploaded to a
	// remote storage backend, we download it to local scratch first so the
	// executor sees a real file on disk.
	localPath, cleanup, err := s.resolveArtifact(ctx, backup.StoragePath, storageCfg, backup.ID)
	if err != nil {
		return nil, s.markFailed(ctx, tenantID, id, "artifact resolve failed: "+err.Error())
	}
	if cleanup != nil {
		defer cleanup()
	}

	d := executor.Dialect(target.Dialect)
	ex, ok := s.execRegistry.RestoreFor(d)
	if !ok {
		return nil, s.markFailed(ctx, tenantID, id, fmt.Sprintf("no restore executor for dialect %q", d))
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

	startTime := time.Now()
	restoreOpts := executor.RestoreOptions{
		BackupPath: localPath,
		TargetConn: conn,
		Clean:      true,
		IfExists:   true,
		TargetTime: record.TargetTime,
	}
	if plan.EncryptionKey != nil && *plan.EncryptionKey != "" {
		restoreOpts.DecryptKey = []byte(*plan.EncryptionKey)
	}

	res, err := ex.Restore(ctx, restoreOpts)
	actualRtoMs := time.Since(startTime).Milliseconds()
	rtoMet := actualRtoMs <= record.RtoTargetMs

	// PITR is only meaningful when the target time is set. For full restores
	// we compute RPO as 0 (nothing lost); for PITR we approximate it as the
	// gap between the artifact timestamp and the target time. This is a
	// lower bound — the true RPO depends on the WAL/binlog coverage which is
	// tracked by ArchiveRecord and reported separately.
	actualRpoMs := int64(0)
	if record.TargetTime != nil && backup.CompletedAt != nil {
		delta := record.TargetTime.Sub(*backup.CompletedAt)
		if delta < 0 {
			delta = 0
		}
		actualRpoMs = delta.Milliseconds()
	}
	rpoMet := actualRpoMs <= record.RpoTargetMs

	if err != nil {
		detail := err.Error()
		if res != nil && len(res.Errors) > 0 {
			detail = detail + "; " + strings.Join(res.Errors, "; ")
		}
		// Update status with actual timings so operators can see how far
		// the restore got before failing.
		_ = s.repo.UpdateRecoveryStatus(ctx, tenantID, id,
			models.RecoveryStatusFailed, &detail, "NOW()",
			&rtoMet, &rpoMet, &actualRtoMs, &actualRpoMs)
		return nil, fmt.Errorf("restore failed: %w", err)
	}
	if res != nil && len(res.Errors) > 0 {
		detail := strings.Join(res.Errors, "; ")
		_ = s.repo.UpdateRecoveryStatus(ctx, tenantID, id,
			models.RecoveryStatusFailed, &detail, "NOW()",
			&rtoMet, &rpoMet, &actualRtoMs, &actualRpoMs)
		return nil, fmt.Errorf("restore reported errors: %s", detail)
	}

	if err := s.repo.UpdateRecoveryStatus(ctx, tenantID, id,
		models.RecoveryStatusCompleted, nil, "NOW()",
		&rtoMet, &rpoMet, &actualRtoMs, &actualRpoMs); err != nil {
		return nil, s.markFailed(ctx, tenantID, id, "persist recovery status failed: "+err.Error())
	}

	record.Status = models.RecoveryStatusCompleted
	record.ActualRtoMs = &actualRtoMs
	record.ActualRpoMs = &actualRpoMs
	record.RtoMet = &rtoMet
	record.RpoMet = &rpoMet
	return record, nil
}

// ExecuteRecoveryPITR drives a real point-in-time recovery using the
// base backup plus any WAL/binlog archive segments that fall inside
// [TargetTime, ...]. It resolves the archive window from ArchiveRecord,
// downloads each segment (decrypting when a plan key is configured),
// and replays them through the engine's Restore executor in order.
//
// Recovery records that do not have PITRMode set should call
// ExecuteRecovery instead — that path is full-restore only.
func (s *RecoveryService) ExecuteRecoveryPITR(ctx context.Context, tenantID, id string) (*models.RecoveryRecord, error) {
	ctx, span := recoveryTracer.Start(ctx, "RecoveryService.ExecuteRecoveryPITR",
		trace.WithAttributes(attribute.String("recovery_id", id)))
	defer span.End()

	record, err := s.repo.GetRecoveryByID(ctx, tenantID, id)
	if err != nil || record == nil {
		span.RecordError(err)
		return nil, ErrRecoveryNotFound
	}
	if record.PITRMode == nil || *record.PITRMode == "" {
		return nil, s.markFailed(ctx, tenantID, id, "recovery record is not PITR-enabled")
	}
	if record.BackupID == nil || *record.BackupID == "" {
		return nil, s.markFailed(ctx, tenantID, id, "recovery has no backup_id")
	}
	if record.TargetTime == nil {
		return nil, s.markFailed(ctx, tenantID, id, "PITR requires a target_time")
	}

	plan, err := s.repo.GetPlanByID(ctx, tenantID, record.PlanID)
	if err != nil || plan == nil {
		return nil, s.markFailed(ctx, tenantID, id, "plan not found")
	}
	backup, err := s.repo.GetBackupByID(ctx, tenantID, *record.BackupID)
	if err != nil || backup == nil {
		return nil, s.markFailed(ctx, tenantID, id, "backup not found")
	}
	if backup.StoragePath == nil || *backup.StoragePath == "" {
		return nil, s.markFailed(ctx, tenantID, id, "backup has no storage_path")
	}

	var target models.BackupTarget
	if err := json.Unmarshal(plan.Target, &target); err != nil {
		return nil, s.markFailed(ctx, tenantID, id, "invalid plan target: "+err.Error())
	}
	var storageCfg models.BackupStorageConfig
	if len(plan.StorageConfig) > 0 {
		if err := json.Unmarshal(plan.StorageConfig, &storageCfg); err != nil {
			return nil, s.markFailed(ctx, tenantID, id, "invalid storage_config: "+err.Error())
		}
	}

	// 1. Resolve base backup artifact to local scratch.
	localBackupPath, baseCleanup, err := s.resolveArtifact(ctx, backup.StoragePath, storageCfg, backup.ID)
	if err != nil {
		return nil, s.markFailed(ctx, tenantID, id, "base artifact resolve failed: "+err.Error())
	}
	if baseCleanup != nil {
		defer baseCleanup()
	}

	// 2. Query archive records covering the PITR window.
	windowEnd := time.Now().UTC()
	archiveType := archiveTypeForPITRMode(string(*record.PITRMode))
	archives, err := s.listArchives(ctx, tenantID, record.PlanID, archiveType, *record.TargetTime, windowEnd)
	if err != nil {
		return nil, s.markFailed(ctx, tenantID, id, "archive list failed: "+err.Error())
	}

	// 3. Resolve each archive record to a local path, decrypting when the
	// plan is encrypted. Keep order — WAL/binlog segments are monotonic.
	var localArchivePaths []string
	var archiveCleanup func()
	cleanups := []func(){}
	for i := range archives {
		rec := &archives[i]
		p, cleanup, err := s.resolveArchiveArtifact(ctx, rec, storageCfg, plan.EncryptionKey)
		if err != nil {
			for _, c := range cleanups {
				c()
			}
			return nil, s.markFailed(ctx, tenantID, id, fmt.Sprintf("archive %s resolve failed: %s", rec.Path, err.Error()))
		}
		cleanups = append(cleanups, cleanup)
		localArchivePaths = append(localArchivePaths, p)
	}
	archiveCleanup = func() {
		for _, c := range cleanups {
			c()
		}
	}
	defer archiveCleanup()

	// 4. Restore via the engine's executor.
	d := executor.Dialect(target.Dialect)
	ex, ok := s.execRegistry.RestoreFor(d)
	if !ok {
		return nil, s.markFailed(ctx, tenantID, id, fmt.Sprintf("no restore executor for dialect %q", d))
	}
	conn := executor.ConnInfo{
		Host: target.Host, Port: target.Port, DB: target.DB,
		User: target.User, Password: target.Password,
		SSLMode: target.SSLMode, TenantName: target.TenantName,
	}
	restoreOpts := executor.RestoreOptions{
		BackupID:     *record.BackupID,
		BackupPath:   localBackupPath,
		TargetConn:   conn,
		Clean:        true,
		IfExists:     true,
		TargetTime:   record.TargetTime,
		ArchivePaths: localArchivePaths,
	}
	if plan.EncryptionKey != nil && *plan.EncryptionKey != "" {
		restoreOpts.DecryptKey = []byte(*plan.EncryptionKey)
	}

	startTime := time.Now()
	res, err := ex.Restore(ctx, restoreOpts)
	actualRtoMs := time.Since(startTime).Milliseconds()
	rtoMet := actualRtoMs <= record.RtoTargetMs

	// RPO is the gap between the target time and the newest commit on or
	// before it. `WindowStart` carries the archive segment's real commit
	// timestamp (archiver.go sets it to file ModTime, not the upload time),
	// so we select the last segment whose commit precedes the target — not
	// merely the last segment overall, which may commit after the target.
	// Segments are returned in monotonic order by ListArchives.
	actualRpoMs, rpoAnchor := rpoFromArchives(archives, *record.TargetTime, backup.CompletedAt)
	if rpoAnchor == nil {
		s.logger.Warn("RPO computed without a precise commit timestamp; fell back to base backup completion time",
			zap.String("recovery_id", id), zap.Int("archive_count", len(archives)))
	}
	rpoMet := actualRpoMs <= record.RpoTargetMs

	if err != nil {
		detail := err.Error()
		if res != nil && len(res.Errors) > 0 {
			detail += "; " + strings.Join(res.Errors, "; ")
		}
		_ = s.repo.UpdateRecoveryStatus(ctx, tenantID, id,
			models.RecoveryStatusFailed, &detail, "NOW()",
			&rtoMet, &rpoMet, &actualRtoMs, &actualRpoMs)
		return nil, fmt.Errorf("PITR restore failed: %w", err)
	}
	if res != nil && len(res.Errors) > 0 {
		detail := strings.Join(res.Errors, "; ")
		_ = s.repo.UpdateRecoveryStatus(ctx, tenantID, id,
			models.RecoveryStatusFailed, &detail, "NOW()",
			&rtoMet, &rpoMet, &actualRtoMs, &actualRpoMs)
		return nil, fmt.Errorf("PITR restore reported errors: %s", detail)
	}

	if err := s.repo.UpdateRecoveryStatus(ctx, tenantID, id,
		models.RecoveryStatusCompleted, nil, "NOW()",
		&rtoMet, &rpoMet, &actualRtoMs, &actualRpoMs); err != nil {
		return nil, s.markFailed(ctx, tenantID, id, "persist recovery status failed: "+err.Error())
	}

	record.Status = models.RecoveryStatusCompleted
	record.ActualRtoMs = &actualRtoMs
	record.ActualRpoMs = &actualRpoMs
	record.RtoMet = &rtoMet
	record.RpoMet = &rpoMet
	return record, nil
}

// rpoFromArchives returns the RPO in milliseconds and the anchor timestamp
// used. It picks the newest archive segment whose commit (WindowStart) is on
// or before targetTime; when no segment commits before the target (all
// newer, or none), it falls back to the base backup completion time. The
// anchor is nil only when both inputs are empty — callers that need a precise
// RPO should treat that as "no commit timestamp available".
func rpoFromArchives(archives []models.ArchiveRecord, targetTime time.Time, baseCompleted *time.Time) (int64, *time.Time) {
	// Archives are expected in monotonic order; walk from newest backwards
	// so we stop at the first candidate at or before the target.
	for i := len(archives) - 1; i >= 0; i-- {
		ws := archives[i].WindowStart
		if ws.Before(targetTime) || ws.Equal(targetTime) {
			return targetTime.Sub(ws).Milliseconds(), &ws
		}
	}
	if baseCompleted != nil {
		return targetTime.Sub(*baseCompleted).Milliseconds(), baseCompleted
	}
	return 0, nil
}

// listArchives is the seam between the recovery service and the archive
// repository. We use a function field so tests can substitute without
// reaching into the real repo.
func (s *RecoveryService) listArchives(ctx context.Context, tenantID, planID string, archiveType models.ArchiveType, windowStart, windowEnd time.Time) ([]models.ArchiveRecord, error) {
	if s.repo == nil {
		return nil, errors.New("no repository")
	}
	return s.repo.ListArchives(ctx, tenantID, planID, archiveType, windowStart, windowEnd, 1000)
}

// resolveArchiveArtifact downloads one archive record from storage and
// writes a local copy. Encrypted archives are decrypted into a second
// temp file so the executor can open a clean file handle.
func (s *RecoveryService) resolveArchiveArtifact(ctx context.Context, rec *models.ArchiveRecord, cfg models.BackupStorageConfig, key *string) (string, func(), error) {
	if rec == nil {
		return "", nil, errors.New("nil archive record")
	}
	if rec.Path == "" {
		return "", nil, errors.New("archive record has no path")
	}
	// If the path is a plain local path, return as-is (no cleanup).
	if !strings.Contains(rec.Path, "://") && !strings.Contains(rec.Path, "s3/") {
		if _, err := os.Stat(rec.Path); err == nil {
			return rec.Path, nil, nil
		}
	}

	// Otherwise, treat the record as a remote reference — download it.
	base := s.baseBackupDir
	if base == "" {
		base = "/var/backups/orion"
	}
	idPrefix := rec.ID
	if len(idPrefix) > 8 {
		idPrefix = idPrefix[:8]
	}
	scratch := filepath.Join(base, "pitr-"+idPrefix)
	if err := os.MkdirAll(scratch, 0o750); err != nil {
		return "", nil, err
	}
	cleanup := func() { os.RemoveAll(scratch) }

	scheme, objectKey, found := strings.Cut(rec.Path, "://")
	if !found {
		// Path is already a plain key — try the same storage scheme as the
		// plan's storage config.
		scheme = cfg.Type
		if scheme == "" {
			scheme = "s3"
		}
		objectKey = rec.Path
	}
	b, ok := s.storageBackends[scheme]
	if !ok {
		return "", cleanup, fmt.Errorf("no storage backend for %q", scheme)
	}
	reader, err := b.Get(ctx, objectKey)
	if err != nil {
		return "", cleanup, err
	}
	defer reader.Close()

	localPath := filepath.Join(scratch, filepath.Base(objectKey))
	out, err := os.Create(localPath)
	if err != nil {
		return "", cleanup, err
	}
	defer out.Close()
	if _, err := io.Copy(out, reader); err != nil {
		return "", cleanup, err
	}

	// Decrypt if a key is configured.
	if key != nil && *key != "" {
		encInfo, _ := os.Stat(localPath)
		if encInfo != nil && encInfo.Size() > 0 {
			// Assume the file is encrypted when the plan has a key.
			plainPath := localPath + ".plain"
			if err := executor.DecryptFile(localPath, plainPath, []byte(*key)); err != nil {
				return "", cleanup, fmt.Errorf("decrypt archive: %w", err)
			}
			os.Remove(localPath)
			os.Rename(plainPath, localPath)
		}
	}
	return localPath, cleanup, nil
}



// markFailed persists a failed status and returns the error the caller
// should surface to the API. Both the DB and the API response show the
// same reason so there is no drift.
func (s *RecoveryService) markFailed(ctx context.Context, tenantID, id, reason string) error {
	_ = s.repo.UpdateRecoveryStatus(ctx, tenantID, id,
		models.RecoveryStatusFailed, &reason, "NOW()", nil, nil, nil, nil)
	s.logger.Error("recovery failed", zap.String("recovery_id", id), zap.String("reason", reason))
	return fmt.Errorf("%w: %s", ErrInvalidRecovery, reason)
}

// resolveArtifact converts a storage_path reference into a local file path
// the executor can read. Local paths are returned unchanged; s3:// URIs are
// downloaded to baseBackupDir/restore-<backupID>/ and a cleanup function is
// returned so the caller can remove the scratch dir when done.
func (s *RecoveryService) resolveArtifact(ctx context.Context, storagePath *string, cfg models.BackupStorageConfig, backupID string) (string, func(), error) {
	if storagePath == nil {
		return "", nil, errors.New("storage_path is nil")
	}
	p := *storagePath
	// Local path (no scheme prefix).
	if !strings.Contains(p, "://") {
		if _, err := os.Stat(p); err != nil {
			return "", nil, err
		}
		return p, nil, nil
	}
	// Remote path: parse "type://key".
	scheme, key, found := strings.Cut(p, "://")
	if !found {
		return "", nil, fmt.Errorf("malformed storage path: %s", p)
	}
	b, ok := s.storageBackends[scheme]
	if !ok {
		return "", nil, fmt.Errorf("no storage backend for scheme %q", scheme)
	}
	reader, err := b.Get(ctx, key)
	if err != nil {
		return "", nil, err
	}
	defer reader.Close()

	base := s.baseBackupDir
	if base == "" {
		base = "/var/backups/orion"
	}
	scratch := filepath.Join(base, "restore-"+backupID)
	if err := os.MkdirAll(scratch, 0o750); err != nil {
		return "", nil, err
	}
	localPath := filepath.Join(scratch, filepath.Base(key))
	out, err := os.Create(localPath)
	if err != nil {
		return "", nil, err
	}
	defer out.Close()
	if _, err := io.Copy(out, reader); err != nil {
		os.Remove(scratch)
		return "", nil, err
	}
	return localPath, func() { os.RemoveAll(scratch) }, nil
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
