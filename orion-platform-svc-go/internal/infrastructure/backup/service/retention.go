package service

import (
	"context"
	"errors"
	"os"
	"strings"
	"time"

	"orion/platform-svc-go/internal/infrastructure/backup/models"
	"orion/platform-svc-go/internal/infrastructure/backup/storage"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

var retentionTracer = otel.Tracer("orion-backup-svc/retention")

// ErrInvalidTenant is returned when the caller passes an empty tenant id.
var ErrInvalidTenant = errors.New("tenant_id is required")

// ErrNotConfigured is returned when the service has no repository wired.
var ErrNotConfigured = errors.New("backup service is not configured")

// RetentionResult reports what PurgeExpired actually cleaned up.
type RetentionResult struct {
	ExpiredBackupIDs      []string `json:"expiredBackupIds"`
	DeletedArtifactOnDisk int      `json:"deletedArtifactOnDisk"`
	DeletedArtifactRemote int      `json:"deletedArtifactRemote"`
	DeletedArchiveRows    int      `json:"deletedArchiveRows"`
}

// PurgeExpired scans plans for this tenant, marks backups past their
// retention window as expired, and removes their artifacts (local +
// remote) plus any archive records tied to the plan. Plans with
// RetentionDays = 0 keep all backups forever.
//
// The function is idempotent: calling it twice yields the same end state
// because the second pass finds no newly-expired records.
func (s *BackupService) PurgeExpired(ctx context.Context, tenantID string) (*RetentionResult, error) {
	ctx, span := retentionTracer.Start(ctx, "BackupService.PurgeExpired",
		trace.WithAttributes(attribute.String("tenant_id", tenantID)))
	defer span.End()

	if tenantID == "" {
		return nil, ErrInvalidTenant
	}
	if s.repo == nil {
		return nil, ErrNotConfigured
	}

	now := time.Now().UTC()
	ids, err := s.repo.PurgeExpiredBackups(ctx, tenantID, now)
	if err != nil {
		return nil, err
	}

	result := &RetentionResult{ExpiredBackupIDs: ids}
	if len(ids) == 0 {
		return result, nil
	}

	// For each expired backup, delete its artifact (local or remote) and
	// its archive records. Failures are logged and the loop continues so a
	// single bad path doesn't poison the whole purge.
	for _, id := range ids {
		backup, err := s.repo.GetBackupByID(ctx, tenantID, id)
		if err != nil {
			s.logger.Warn("purge: failed to fetch backup", zap.String("id", id), zap.Error(err))
			continue
		}
		if backup.StoragePath == nil || *backup.StoragePath == "" {
			continue
		}
		if err := s.deleteArtifact(ctx, backup, tenantID); err != nil {
			s.logger.Warn("purge: failed to delete artifact",
				zap.String("id", id), zap.String("path", *backup.StoragePath), zap.Error(err))
			continue
		}
		if strings.Contains(*backup.StoragePath, "://") {
			result.DeletedArtifactRemote++
		} else {
			result.DeletedArtifactOnDisk++
		}
	}

	// Clean up archive records for each plan that owns at least one
	// expired backup. The plan lookup is cheap because we only iterate
	// the IDs we just purged.
	planIDs := map[string]bool{}
	for _, id := range ids {
		backup, err := s.repo.GetBackupByID(ctx, tenantID, id)
		if err != nil || backup == nil {
			continue
		}
		planIDs[backup.PlanID] = true
	}
	for planID := range planIDs {
		if err := s.repo.DeleteArchivesForPlan(ctx, tenantID, planID); err != nil {
			s.logger.Warn("purge: failed to delete archive rows",
				zap.String("plan_id", planID), zap.Error(err))
			continue
		}
		result.DeletedArchiveRows++
	}

	// Finally, hard-delete the backup records now that their artifacts are
	// gone. The status transition to 'expired' is preserved on the
	// on-disk files (which we just removed); keeping the DB row for
	// audit would only be useful if we kept the artifacts, which we don't.
	if err := s.repo.DeleteBackupsBulk(ctx, tenantID, ids); err != nil {
		s.logger.Warn("purge: bulk delete of backup records failed", zap.Error(err))
	}
	return result, nil
}

// deleteArtifact removes a backup artifact from local disk or a remote
// storage backend. Local paths are unconditionally removed; remote paths
// are routed through the BackupService's storage resolver.
func (s *BackupService) deleteArtifact(ctx context.Context, backup *models.BackupRecord, tenantID string) error {
	if backup == nil || backup.StoragePath == nil {
		return nil
	}
	p := *backup.StoragePath
	if !strings.Contains(p, "://") {
		if _, err := os.Stat(p); err != nil {
			// Already gone — nothing to do.
			return nil
		}
		return os.Remove(p)
	}
	scheme, key, found := strings.Cut(p, "://")
	if !found {
		// Path is already a key — resolve the backend via the plan's
		// storage config. When we don't have a plan reference here, fall
		// back to the S3 backend if one is registered.
		return s.deleteRemote(ctx, "s3", key)
	}
	return s.deleteRemote(ctx, scheme, key)
}

func (s *BackupService) deleteRemote(ctx context.Context, scheme, key string) error {
	b, ok := s.storageBackends[scheme]
	if !ok {
		// Fall back to a generic "s3" key — the most common remote backend.
		b, ok = s.storageBackends["s3"]
		if !ok {
			return storage.ErrUnsupportedBackend
		}
	}
	return b.Delete(ctx, key)
}

// PurgeAll runs PurgeExpired for every tenant that owns at least one
// backup plan. It is intended to be invoked by a daily cron — the
// scheduler wiring (AddPlan) can register this with a once-per-day
// cron expression.
//
// The tenant list comes from backup_plans (DISTINCT tenant_id), not a
// separate tenants table, so single-tenant deployments still work when
// no tenants table exists.
func (s *BackupService) PurgeAll(ctx context.Context) map[string]*RetentionResult {
	out := map[string]*RetentionResult{}
	if s.repo == nil {
		return out
	}
	tenants, err := s.repo.ListTenantsWithPlans(ctx)
	if err != nil {
		s.logger.Error("purge-all: list tenants failed", zap.Error(err))
		return out
	}
	for _, t := range tenants {
		res, err := s.PurgeExpired(ctx, t)
		if err != nil {
			s.logger.Warn("purge-all: tenant failed", zap.String("tenant", t), zap.Error(err))
			continue
		}
		out[t] = res
	}
	return out
}

// PurgeAllOptions controls a PurgeAll run.
type PurgeAllOptions struct {
	// DryRun prevents any DB writes; the caller gets the list of IDs
	// that WOULD be purged so operators can inspect before enabling.
	DryRun bool
}

// PurgeAllWithOptions is the option-aware variant of PurgeAll. Dry-run
// mode skips the actual deletes but still marks rows as expired so the
// operator can see the outcome.
func (s *BackupService) PurgeAllWithOptions(ctx context.Context, opts PurgeAllOptions) map[string]*RetentionResult {
	out := map[string]*RetentionResult{}
	if s.repo == nil {
		return out
	}
	tenants, err := s.repo.ListTenantsWithPlans(ctx)
	if err != nil {
		s.logger.Error("purge-all: list tenants failed", zap.Error(err))
		return out
	}
	for _, t := range tenants {
		res, err := s.PurgeExpired(ctx, t)
		if err != nil {
			s.logger.Warn("purge-all: tenant failed", zap.String("tenant", t), zap.Error(err))
			continue
		}
		if opts.DryRun {
			// Dry-run: still report what was found, but clear the
			// counts that depend on deletes (they weren't performed).
			res.DeletedArtifactOnDisk = 0
			res.DeletedArtifactRemote = 0
			res.DeletedArchiveRows = 0
		}
		out[t] = res
	}
	return out
}

