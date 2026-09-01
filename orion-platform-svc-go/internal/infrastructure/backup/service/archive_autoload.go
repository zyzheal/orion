package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"orion/platform-svc-go/internal/infrastructure/backup/models"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

var autoloadTracer = otel.Tracer("orion-backup-svc/archive-autoload")

// ArchiveAutoloadConfig is the shape of the "archive" field inside a
// backup plan's storage_config JSON. When present, the plan is
// auto-registered with the ArchiveScheduler at server boot.
//
// Example storage_config JSON:
//
//	{
//	  "type": "local",
//	  "base_path": "/var/backups/orion",
//	  "archive": {
//	    "schedule":       "0 0 1 * * *",
//	    "source_dir":     "/var/lib/postgresql/wal_archive",
//	    "archive_type":   "wal",
//	    "encryption_key": "base64-encoded-32-byte-key"
//	  }
//	}
//
// The archive block is OPTIONAL — plans without it are ignored by the
// auto-loader. encryption_key, when present, is base64-encoded and
// overrides the plan-level key for archive encryption only. This lets
// operators rotate archive keys independently of backup artifact keys.
type ArchiveAutoloadConfig struct {
	Schedule      string              `json:"schedule"`
	SourceDir     string              `json:"source_dir"`
	ArchiveType   models.ArchiveType  `json:"archive_type"`
	Enabled       *bool               `json:"enabled"`
	EncryptionKey string              `json:"encryption_key,omitempty"`
}

// StorageConfigWithArchive is the unmarshalled shape of a plan's
// StorageConfig JSON when it carries an archive block. It is a
// convenience struct for the auto-loader — the rest of the config is
// ignored.
type StorageConfigWithArchive struct {
	Archive *ArchiveAutoloadConfig `json:"archive,omitempty"`
}

// LoadArchivesFromPlans scans all enabled backup plans for this tenant
// and registers each one that has a well-formed archive config with the
// scheduler. It is idempotent: re-registering a plan replaces the
// previous entry (see ArchiveScheduler.AddPlan).
//
// Plans that fail to parse are skipped and logged, so one bad plan
// doesn't poison the whole tenant.
func (s *ArchiveScheduler) LoadArchivesFromPlans(ctx context.Context, tenantID string, plans []models.BackupPlan) (int, error) {
	ctx, span := autoloadTracer.Start(ctx, "ArchiveScheduler.LoadArchivesFromPlans",
		trace.WithAttributes(attribute.String("tenant_id", tenantID)))
	defer span.End()

	if s.archiver == nil || s.logger == nil {
		return 0, nil
	}
	loaded := 0
	for i := range plans {
		p := &plans[i]
		if !p.Enabled {
			continue
		}
		spec, err := parseArchiveSpec(p)
		if err != nil {
			s.logger.Warn("archive autoload: skipping plan",
				zap.String("plan_id", p.ID), zap.Error(err))
			continue
		}
		if spec == nil {
			continue
		}
		s.AddPlan(spec)
		loaded++
	}
	return loaded, nil
}

// parseArchiveSpec extracts an ArchivePlanSpec from a plan's StorageConfig
// JSON. It returns (nil, nil) when the plan has no archive block,
// (spec, nil) when the block is well-formed, or (nil, err) when the JSON
// is malformed.
func parseArchiveSpec(p *models.BackupPlan) (*ArchivePlanSpec, error) {
	if p == nil {
		return nil, nil
	}
	if len(p.StorageConfig) == 0 {
		return nil, nil
	}
	var cfg StorageConfigWithArchive
	if err := json.Unmarshal(p.StorageConfig, &cfg); err != nil {
		return nil, fmt.Errorf("storage_config is not valid JSON: %w", err)
	}
	if cfg.Archive == nil {
		return nil, nil
	}
	a := cfg.Archive
	if a.Schedule == "" || a.SourceDir == "" {
		return nil, fmt.Errorf("archive block missing schedule or source_dir")
	}
	if !archiveDirExists(a.SourceDir) {
		return nil, fmt.Errorf("source_dir %q does not exist", a.SourceDir)
	}
	if a.ArchiveType == "" {
		a.ArchiveType = inferArchiveType(a.SourceDir)
	}
	if a.ArchiveType == "" {
		return nil, fmt.Errorf("archive_type could not be inferred from source_dir %q", a.SourceDir)
	}
	// Default to enabled when the "enabled" field is absent. An explicit
	// false means the operator wants the block present but paused.
	if a.Enabled != nil && !*a.Enabled {
		return nil, nil
	}
	spec := &ArchivePlanSpec{
		TenantID:    p.TenantID,
		PlanID:      p.ID,
		SourceDir:   a.SourceDir,
		ArchiveType: a.ArchiveType,
		Schedule:    a.Schedule,
		Enabled:     true,
	}
	// Archive encryption key precedence:
	//   1. archive.encryption_key (base64) — if present, decoded
	//   2. plan.encryption_key (plaintext) — if the plan has one
	//   3. nil — archives are stored unencrypted
	//
	// Base64 is used for the archive-level key to avoid requiring the
	// operator to escape backslashes in JSON. The plan-level key stays
	// plaintext to match the existing BackupPlan contract.
	if a.EncryptionKey != "" {
		key, err := base64.StdEncoding.DecodeString(a.EncryptionKey)
		if err != nil {
			return nil, fmt.Errorf("archive.encryption_key is not valid base64: %w", err)
		}
		if len(key) != 32 {
			return nil, fmt.Errorf("archive.encryption_key must be 32 bytes after base64 decode, got %d", len(key))
		}
		spec.EncryptionKey = key
	} else if p.EncryptionKey != nil && *p.EncryptionKey != "" {
		// Reuse the plan's key. It may or may not be base64 — accept
		// both to keep compatibility with existing plans.
		planKey := *p.EncryptionKey
		// Fast-path: check if it's already raw 32 bytes.
		if len(planKey) == 32 {
			spec.EncryptionKey = []byte(planKey)
		} else if k, err := base64.StdEncoding.DecodeString(planKey); err == nil && len(k) == 32 {
			spec.EncryptionKey = k
		}
		// Otherwise fall through to no key (unencrypted archive) — we
		// don't want to silently encrypt with a wrong-sized key.
	}
	return spec, nil
}

// archiveDirExists returns true when path is an existing directory.
func archiveDirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

// inferArchiveType guesses the ArchiveType from the source_dir path. It
// is conservative — only the well-known PG/MySQL/WAL/oblog paths are
// matched. When inference fails, the caller must set ArchiveType
// explicitly.
func inferArchiveType(path string) models.ArchiveType {
	lower := strings.ToLower(path)
	if strings.Contains(lower, "pg_wal") || strings.Contains(lower, "wal") {
		return models.ArchiveTypeWAL
	}
	if strings.Contains(lower, "mysql-bin") || strings.Contains(lower, "binlog") || strings.Contains(lower, "mysql-data") {
		return models.ArchiveTypeBinlog
	}
	if strings.Contains(lower, "ob_clog") || strings.Contains(lower, "oceanbase") {
		return models.ArchiveTypeClog
	}
	return ""
}
