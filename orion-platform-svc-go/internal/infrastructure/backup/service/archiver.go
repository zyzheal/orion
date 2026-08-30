package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/infrastructure/backup/executor"
	"orion/platform-svc-go/internal/infrastructure/backup/models"
	"orion/platform-svc-go/internal/infrastructure/backup/storage"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ErrNoArchiveFiles is returned by Query when the repository has no records.
var ErrNoArchiveFiles = errors.New("no archive files in window")

// Archiver uploads transaction-log files (Postgres WAL / MySQL binlog) from a
// local directory to a StorageBackend so recovery services can replay a
// precise time window. Phase 2 lands the directory scanner and the record
// persistence path.
type Archiver struct {
	repo   ArchiveRepository
	// resolver maps (storage config, optional key) to a StorageBackend.
	// It wraps the BackupService's private resolver so unit tests can
	// inject a fake without exposing the service's internals.
	resolver func(models.BackupStorageConfig) storage.StorageBackend
	logger   *zap.Logger
	mu       sync.Mutex
	seen     map[string]time.Time // path -> last mtime we've seen; dedupe across runs
}

// ArchiveRepository is the subset of the backup repository Archiver needs.
type ArchiveRepository interface {
	CreateArchive(ctx context.Context, rec *models.ArchiveRecord) error
	GetArchive(ctx context.Context, tenantID, id string) (*models.ArchiveRecord, error)
	ListArchives(ctx context.Context, tenantID, planID string, archiveType models.ArchiveType, windowStart, windowEnd time.Time, limit int) ([]models.ArchiveRecord, error)
}

// NewArchiver returns an Archiver. resolver may be nil in tests; in
// production wiring.go passes a closure that calls svc.storageBackendFor.
func NewArchiver(repo ArchiveRepository, resolver func(models.BackupStorageConfig) storage.StorageBackend, logger *zap.Logger) *Archiver {
	if logger == nil {
		logger, _ = zap.NewProduction()
	}
	return &Archiver{
		repo:     repo,
		resolver: resolver,
		logger:   logger,
		seen:     map[string]time.Time{},
	}
}

// SetResolver overrides the storage backend resolver. Used by wiring to
// inject the BackupService's resolver after construction.
func (a *Archiver) SetResolver(r func(models.BackupStorageConfig) storage.StorageBackend) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.resolver = r
}

// ArchiveOptions controls one ArchiveWindow run.
type ArchiveOptions struct {
	SourceDir    string             // local WAL/binlog directory
	PlanID       string
	TenantID     string
	ArchiveType  models.ArchiveType
	StorageConfig models.BackupStorageConfig
	EncryptionKey []byte            // when non-empty, AES-256-GCM encrypt each file
	WindowStart  time.Time          // inclusive; zero = no filter
	WindowEnd    time.Time          // inclusive; zero = no filter
	DryRun       bool               // scan and compute, but do not upload/persist
	StoragePathPrefix string         // optional key prefix override; defaults to <plan>/<type>
}

// ArchiveResult reports what ArchiveWindow actually uploaded.
type ArchiveResult struct {
	Archived   int
	Skipped    int
	Failed     int
	TotalBytes int64
	Records    []*models.ArchiveRecord
}

// ArchiveWindow scans SourceDir, uploads new/changed files to Storage, and
// persists an ArchiveRecord per file. It is idempotent: files whose mtime
// was already seen are skipped.
func (a *Archiver) ArchiveWindow(ctx context.Context, opts ArchiveOptions) (*ArchiveResult, error) {
	if opts.SourceDir == "" {
		return nil, errors.New("source dir required")
	}
	if opts.PlanID == "" {
		return nil, errors.New("plan id required")
	}
	if opts.TenantID == "" {
		return nil, errors.New("tenant id required")
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	result := &ArchiveResult{}
	info, err := os.Stat(opts.SourceDir)
	if err != nil {
		return nil, fmt.Errorf("stat source: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("source is not a directory: %s", opts.SourceDir)
	}

	var walkErr error
	_ = filepath.Walk(opts.SourceDir, func(path string, fi os.FileInfo, err error) error {
		if err != nil {
			walkErr = err
			return filepath.SkipDir
		}
		if fi.IsDir() {
			return nil
		}
		if !a.seen[path].IsZero() && a.seen[path].Equal(fi.ModTime()) {
			result.Skipped++
			return nil
		}
		if !inWindow(fi.ModTime(), opts.WindowStart, opts.WindowEnd) {
			result.Skipped++
			return nil
		}
		rec, err := a.uploadOne(ctx, opts, path, fi)
		if err != nil {
			a.logger.Error("archive upload failed",
				zap.String("path", path), zap.Error(err))
			result.Failed++
			if rec != nil {
				result.Records = append(result.Records, rec)
			}
			return nil
		}
		a.seen[path] = fi.ModTime()
		result.Archived++
		result.TotalBytes += rec.SizeBytes
		result.Records = append(result.Records, rec)
		return nil
	})
	if walkErr != nil {
		return result, fmt.Errorf("walk source: %w", walkErr)
	}
	return result, nil
}

// uploadOne reads a single file, optionally encrypts, uploads to storage,
// computes SHA256 of the final bytes, and persists an ArchiveRecord.
func (a *Archiver) uploadOne(ctx context.Context, opts ArchiveOptions, path string, fi os.FileInfo) (*models.ArchiveRecord, error) {
	relPath, _ := filepath.Rel(opts.SourceDir, path)
	if relPath == "" {
		relPath = filepath.Base(path)
	}
	relPath = filepath.ToSlash(relPath)

	storagePath := a.objectKey(opts, relPath)
	f, err := os.Open(path)
	if err != nil {
		return a.failRecord(ctx, opts, relPath, fi.Size(), fmt.Errorf("open: %w", err))
	}
	defer f.Close()

	var (
		uploadReader io.Reader = f
		size         int64     = fi.Size()
	)

	if len(opts.EncryptionKey) > 0 {
		// EncryptFile requires src != dst. Encrypt the source file to a
		// fresh temp path, then upload the ciphertext.
		plain, err := os.CreateTemp("", "orion-archive-plain-*")
		if err != nil {
			return a.failRecord(ctx, opts, relPath, size, fmt.Errorf("tmp plain: %w", err))
		}
		plainPath := plain.Name()
		defer os.Remove(plainPath)
		encOut, err := os.CreateTemp("", "orion-archive-*.enc")
		if err != nil {
			return a.failRecord(ctx, opts, relPath, size, fmt.Errorf("tmp enc: %w", err))
		}
		encPath := encOut.Name()
		defer os.Remove(encPath)
		if _, err := io.Copy(plain, f); err != nil {
			return a.failRecord(ctx, opts, relPath, size, fmt.Errorf("copy plain: %w", err))
		}
		plain.Close()
		if err := executor.EncryptFile(plainPath, encPath, opts.EncryptionKey); err != nil {
			return a.failRecord(ctx, opts, relPath, size, fmt.Errorf("encrypt: %w", err))
		}
		encInfo, err := os.Stat(encPath)
		if err != nil {
			return a.failRecord(ctx, opts, relPath, size, fmt.Errorf("stat enc: %w", err))
		}
		size = encInfo.Size()
		encF, err := os.Open(encPath)
		if err != nil {
			return a.failRecord(ctx, opts, relPath, size, fmt.Errorf("open enc: %w", err))
		}
		encOut.Close() // release the create-temp handle; encF owns it now
		uploadReader = encF
	}

	backend := a.resolveBackend(opts)
	if backend != nil && !opts.DryRun {
		if err := backend.Put(ctx, storagePath, uploadReader); err != nil {
			return a.failRecord(ctx, opts, relPath, size, fmt.Errorf("upload: %w", err))
		}
	}

	// SHA256: prefer remote copy to catch transport corruption; fall back
	// to local file when storage is not available.
	checksum, err := a.computeSHA256(ctx, backend, storagePath, uploadReader, opts)
	if err != nil {
		return a.failRecord(ctx, opts, relPath, size, fmt.Errorf("checksum: %w", err))
	}

	now := time.Now().UTC()
	rec := &models.ArchiveRecord{
		ID:          uuid.New().String(),
		TenantID:    opts.TenantID,
		PlanID:      opts.PlanID,
		ArchiveType: opts.ArchiveType,
		WindowStart: fi.ModTime(),
		WindowEnd:   ptrTime(now),
		SizeBytes:   size,
		Path:        storagePath,
		Checksum:    strPtr(checksum),
		Status:      models.ArchiveStatusCompleted,
		CreatedAt:   now,
	}
	if !opts.DryRun && a.repo != nil {
		if err := a.repo.CreateArchive(ctx, rec); err != nil {
			return nil, fmt.Errorf("persist archive record: %w", err)
		}
	}
	return rec, nil
}

func (a *Archiver) resolveBackend(opts ArchiveOptions) storage.StorageBackend {
	if a.resolver == nil {
		return nil
	}
	return a.resolver(opts.StorageConfig)
}

// computeSHA256 hashes the uploaded bytes. When the backend supports Get,
// we round-trip through it to catch transport corruption; otherwise we
// hash the local reader.
func (a *Archiver) computeSHA256(ctx context.Context, b storage.StorageBackend, storagePath string, uploadReader io.Reader, opts ArchiveOptions) (string, error) {
	if b != nil && !opts.DryRun {
		if rc, err := b.Get(ctx, storagePath); err == nil {
			defer rc.Close()
			h := sha256.New()
			if _, err := io.Copy(h, io.LimitReader(rc, 1<<60)); err != nil {
				return "", err
			}
			return hex.EncodeToString(h.Sum(nil)), nil
		}
	}
	// Re-read the local file (uploadReader may have been consumed by Put).
	if err := seekableReseek(uploadReader); err != nil {
		// Fall back to hashing from scratch.
	}
	h := sha256.New()
	if _, err := io.Copy(h, io.LimitReader(uploadReader, 1<<60)); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// seekableReseek repositions an io.Reader if it is a *os.File.
func seekableReseek(r io.Reader) error {
	if f, ok := r.(*os.File); ok {
		_, err := f.Seek(0, io.SeekStart)
		return err
	}
	return nil
}

func (a *Archiver) failRecord(ctx context.Context, opts ArchiveOptions, relPath string, size int64, cause error) (*models.ArchiveRecord, error) {
	if a.repo == nil || opts.DryRun {
		return nil, cause
	}
	now := time.Now().UTC()
	rec := &models.ArchiveRecord{
		ID:           uuid.New().String(),
		TenantID:     opts.TenantID,
		PlanID:       opts.PlanID,
		ArchiveType:  opts.ArchiveType,
		WindowStart:  now,
		SizeBytes:    size,
		Path:         relPath,
		Status:       models.ArchiveStatusFailed,
		ErrorMessage: strPtr(cause.Error()),
		CreatedAt:    now,
	}
	_ = a.repo.CreateArchive(ctx, rec)
	return rec, cause
}

func (a *Archiver) objectKey(opts ArchiveOptions, relPath string) string {
	prefix := opts.StoragePathPrefix
	if prefix == "" {
		prefix = opts.PlanID
		if opts.ArchiveType != "" {
			prefix = opts.PlanID + "/" + string(opts.ArchiveType)
		}
	}
	return prefix + "/" + relPath
}

// Query calls the repository to list archives.
func (a *Archiver) Query(ctx context.Context, q ArchiveQuery) ([]models.ArchiveRecord, error) {
	if a.repo == nil {
		return nil, ErrNoArchiveFiles
	}
	if q.Limit <= 0 {
		q.Limit = 100
	}
	return a.repo.ListArchives(ctx, q.TenantID, q.PlanID, q.ArchiveType, q.WindowStart, q.WindowEnd, q.Limit)
}

// ArchiveQuery filters archived files by window and type.
type ArchiveQuery struct {
	TenantID    string
	PlanID      string
	ArchiveType models.ArchiveType
	WindowStart time.Time
	WindowEnd   time.Time
	Limit       int
}

// ListSeen returns the dedupe cache (path -> mtime). Useful for operators
// to inspect what the archiver has processed without touching the DB.
func (a *Archiver) ListSeen() map[string]time.Time {
	a.mu.Lock()
	defer a.mu.Unlock()
	out := make(map[string]time.Time, len(a.seen))
	for k, v := range a.seen {
		out[k] = v
	}
	return out
}

// ResetSeen clears the dedupe cache. Call this after a failed run so the
// next pass retries files that didn't reach storage.
func (a *Archiver) ResetSeen() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.seen = map[string]time.Time{}
}

// ArchiveDir lists files in a WAL/binlog dir without touching storage.
func ArchiveDir(dir string) ([]string, error) {
	if dir == "" {
		return nil, errors.New("dir required")
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		out = append(out, filepath.Join(dir, e.Name()))
	}
	return out, nil
}

// IsWALFileName returns true when the name matches PostgreSQL's 24-hex
// WAL segment pattern.
func IsWALFileName(name string) bool {
	base := strings.SplitN(name, ".", 2)[0]
	if len(base) != 24 {
		return false
	}
	for _, c := range base {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

// IsBinlogFileName returns true when the name matches MySQL binlog naming
// (mysql-bin.NNNNNN or binlog.NNNNNN).
func IsBinlogFileName(name string) bool {
	return strings.HasPrefix(name, "mysql-bin.") || strings.HasPrefix(name, "binlog.")
}

// IsArchivelogFileName returns true for Oracle archivelog naming
// (arch_1_123456_1234567890.arc, OARCH_LOGFILE_...).
func IsArchivelogFileName(name string) bool {
	return strings.HasPrefix(name, "arch_") || strings.Contains(strings.ToUpper(name), "OARCH")
}

// IsRedologFileName returns true for DB2 redo log naming
// (log000001.log, log000002.log, ... — "log" prefix followed by 6+ digits
// and a ".log" suffix).
func IsRedologFileName(name string) bool {
	if !strings.HasSuffix(name, ".log") {
		return false
	}
	prefix := strings.TrimSuffix(name, ".log")
	if !strings.HasPrefix(prefix, "log") {
		return false
	}
	num := prefix[3:]
	if len(num) < 6 {
		return false
	}
	for _, c := range num {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// IsLogBackupFileName returns true for SQL Server transaction log backup
// (*.trn, *.bak).
func IsLogBackupFileName(name string) bool {
	return strings.HasSuffix(name, ".trn") || strings.HasSuffix(name, ".bak")
}

// IsClogFileName returns true for OceanBase clog file naming
// (clog prefix or ob_clog/ path segment).
func IsClogFileName(name string) bool {
	return strings.HasPrefix(name, "clog") || strings.Contains(name, "ob_clog")
}

// IsArchiveFileFor dispatches file-name matching by ArchiveType.
func IsArchiveFileFor(name string, t models.ArchiveType) bool {
	switch t {
	case models.ArchiveTypeWAL:
		return IsWALFileName(name)
	case models.ArchiveTypeBinlog:
		return IsBinlogFileName(name)
	case models.ArchiveTypeArchivelog:
		return IsArchivelogFileName(name)
	case models.ArchiveTypeRedolog:
		return IsRedologFileName(name)
	case models.ArchiveTypeLogBackup:
		return IsLogBackupFileName(name)
	case models.ArchiveTypeClog:
		return IsClogFileName(name)
	}
	return false
}

// archiveTypeForPITRMode maps a RecoveryRecord.PITRMode value to the
// matching ArchiveType. Unknown values fall back to WAL so a mis-configured
// record still has a chance of replaying against the most common engine.
func archiveTypeForPITRMode(pitrMode string) models.ArchiveType {
	switch strings.ToLower(pitrMode) {
	case "wal":
		return models.ArchiveTypeWAL
	case "binlog":
		return models.ArchiveTypeBinlog
	case "archivelog":
		return models.ArchiveTypeArchivelog
	case "redolog":
		return models.ArchiveTypeRedolog
	case "log_backup", "logbackup":
		return models.ArchiveTypeLogBackup
	case "clog":
		return models.ArchiveTypeClog
	default:
		return models.ArchiveTypeWAL
	}
}

func inWindow(t, start, end time.Time) bool {
	if !start.IsZero() && t.Before(start) {
		return false
	}
	if !end.IsZero() && t.After(end) {
		return false
	}
	return true
}

func ptrTime(t time.Time) *time.Time {
	c := t
	return &c
}

func strPtr(s string) *string {
	return &s
}
