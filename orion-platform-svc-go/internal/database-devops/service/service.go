package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"orion/platform-svc-go/internal/database-devops/models"
	"orion/platform-svc-go/internal/database-devops/repository"
	"orion/platform-svc-go/internal/infrastructure/backup/executor"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// repoInterface is the subset of repository.Repository the service calls. Keeping
// it package-private means only a test inside this package can substitute a fake
// for it; production always gets the sqlx-backed Repository, so the shape of the
// call graph is unchanged.
type repoInterface interface {
	Get(ctx context.Context, tenantID, id string) (*models.DatabaseDevopsItem, error)
	List(ctx context.Context, tenantID string) ([]models.DatabaseDevopsItem, error)
	Create(ctx context.Context, item *models.DatabaseDevopsItem) error
	Update(ctx context.Context, item *models.DatabaseDevopsItem) error
	UpdateStatus(ctx context.Context, tenantID, id, status string) error
	UpdateResult(ctx context.Context, tenantID, id, result string) error
	Delete(ctx context.Context, tenantID, id string) error
}

// ConnInfoResolver resolves a database ID to connection info and dialect.
// When set (along with an executor registry), ExecuteBackup and ExecuteRestore
// perform real engine-specific operations. When nil, they fall back to
// placeholder behavior.
type ConnInfoResolver func(ctx context.Context, tenantID, databaseID string) (*executor.ConnInfo, executor.Dialect, error)

// Service implements database DevOps business logic. Data source management was
// removed in ARCH-0.11b — the service now only handles backup/restore
// operations; data source CRUD lives in internal/datasource.
type Service struct {
	repo repoInterface

	// execRegistry routes to the engine-specific backup/restore executor.
	// When nil, ExecuteBackup/ExecuteRestore produce placeholder results.
	execRegistry *executor.Registry
	// connResolver maps a database ID to connection info + dialect.
	// Required for real execution; when nil, placeholder behavior is used.
	connResolver ConnInfoResolver
	// backupDir is the local scratch directory for backup artifacts.
	// Defaults to /var/backups/orion when not set.
	backupDir string
}

// NewService creates a new database DevOps service.
func NewService(db *sqlx.DB) *Service {
	return &Service{repo: repository.NewRepository(db)}
}

// newServiceWithRepo wires a service against an explicit repository. It exists so
// the status-lifecycle and tenant-scoping tests can drive the service against an
// in-memory fake instead of a live sqlx.DB.
func newServiceWithRepo(repo repoInterface) *Service {
	return &Service{repo: repo}
}

// SetExecutorRegistry injects the executor registry for real backup/restore
// execution. When set along with SetConnResolver, ExecuteBackup and
// ExecuteRestore route to engine-specific executors (pg_dump, mysqldump, etc.).
func (s *Service) SetExecutorRegistry(reg *executor.Registry) {
	s.execRegistry = reg
}

// SetConnResolver injects a function that resolves a database ID to
// connection info and dialect. Required for real execution; when nil,
// the service falls back to placeholder results.
func (s *Service) SetConnResolver(r ConnInfoResolver) {
	s.connResolver = r
}

// SetBackupDir overrides the default backup artifact scratch directory.
func (s *Service) SetBackupDir(dir string) {
	if dir != "" {
		s.backupDir = dir
	}
}

// canExecute returns true when the service has everything needed for a real
// backup/restore: an executor registry, a conn resolver, and a backup dir.
func (s *Service) canExecute() bool {
	return s.execRegistry != nil && s.connResolver != nil
}

// ListOperations returns all operations for a tenant
func (s *Service) ListOperations(ctx context.Context, tenantID string) ([]models.DatabaseDevopsItem, error) {
	return s.repo.List(ctx, tenantID)
}

// GetOperation returns a single operation by ID
func (s *Service) GetOperation(ctx context.Context, tenantID, id string) (*models.DatabaseDevopsItem, error) {
	return s.repo.Get(ctx, tenantID, id)
}

// CreateOperation creates a new database DevOps operation
func (s *Service) CreateOperation(ctx context.Context, tenantID string, req *models.CreateDatabaseDevopsRequest) (*models.DatabaseDevopsItem, error) {
	item := &models.DatabaseDevopsItem{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Type:        req.Type,
		Status:      "pending",
		DatabaseID:  req.DatabaseID,
		Config:      req.Config,
		Enabled:     req.Enabled,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	if err := s.repo.Create(ctx, item); err != nil {
		return nil, fmt.Errorf("create operation: %w", err)
	}
	return item, nil
}

// UpdateOperation updates an existing operation
func (s *Service) UpdateOperation(ctx context.Context, tenantID, id string, req *models.UpdateDatabaseDevopsRequest) (*models.DatabaseDevopsItem, error) {
	item, err := s.repo.Get(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("get operation: %w", err)
	}
	if item == nil {
		return nil, fmt.Errorf("operation not found")
	}

	if req.Name != nil {
		item.Name = *req.Name
	}
	if req.Description != nil {
		item.Description = *req.Description
	}
	if req.Status != nil {
		item.Status = *req.Status
	}
	if req.Config != nil {
		item.Config = *req.Config
	}
	if req.Result != nil {
		item.Result = *req.Result
	}
	if req.Enabled != nil {
		item.Enabled = *req.Enabled
	}
	item.UpdatedAt = time.Now().UTC()

	if err := s.repo.Update(ctx, item); err != nil {
		return nil, fmt.Errorf("update operation: %w", err)
	}
	return item, nil
}

// DeleteOperation deletes an operation
func (s *Service) DeleteOperation(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// ExecuteBackup executes a backup operation. When the service has an executor
// registry and conn resolver (see SetExecutorRegistry / SetConnResolver), it
// performs a real engine-specific backup (pg_dump, mysqldump, etc.) and
// populates OutputPath and ChecksumSHA256 in the result. When either is nil,
// it falls back to placeholder behavior to keep backward compatibility with
// callers that only track status lifecycle.
func (s *Service) ExecuteBackup(ctx context.Context, tenantID, opID string) (*models.BackupResult, error) {
	op, err := s.repo.Get(ctx, tenantID, opID)
	if err != nil || op == nil {
		return nil, fmt.Errorf("operation not found")
	}

	// Parse backup config
	var cfg models.BackupConfig
	if op.Config != "" {
		if err := json.Unmarshal([]byte(op.Config), &cfg); err != nil {
			return nil, fmt.Errorf("parse backup config: %w", err)
		}
	}

	// Update status to running
	_ = s.repo.UpdateStatus(ctx, tenantID, opID, "running")

	startedAt := time.Now().UTC()
	backupID := uuid.New().String()

	// --- Real execution path ---
	if s.canExecute() {
		result, execErr := s.executeRealBackup(ctx, tenantID, opID, op.DatabaseID, &cfg, backupID, startedAt)
		if execErr != nil {
			_ = s.repo.UpdateStatus(ctx, tenantID, opID, "failed")
			return nil, execErr
		}
		resultJSON, _ := json.Marshal(result)
		_ = s.repo.UpdateResult(ctx, tenantID, opID, string(resultJSON))
		_ = s.repo.UpdateStatus(ctx, tenantID, opID, "completed")
		return result, nil
	}

	// --- Placeholder fallback ---
	result := &models.BackupResult{
		BackupID:   backupID,
		Status:     "completed",
		StartedAt:  startedAt.Format(time.RFC3339),
		FinishedAt: time.Now().UTC().Format(time.RFC3339),
		Message:    fmt.Sprintf("Backup %s for database %s (placeholder — executor not configured)", cfg.BackupType, op.DatabaseID),
	}

	resultJSON, _ := json.Marshal(result)
	_ = s.repo.UpdateResult(ctx, tenantID, opID, string(resultJSON))
	_ = s.repo.UpdateStatus(ctx, tenantID, opID, "completed")

	return result, nil
}

// executeRealBackup resolves the database connection info, looks up the
// engine-specific executor, and runs the actual backup command.
func (s *Service) executeRealBackup(
	ctx context.Context,
	tenantID, opID, databaseID string,
	cfg *models.BackupConfig,
	backupID string,
	startedAt time.Time,
) (*models.BackupResult, error) {
	// Resolve connection info
	conn, dialect, err := s.connResolver(ctx, tenantID, databaseID)
	if err != nil {
		return nil, fmt.Errorf("resolve conn info for %s: %w", databaseID, err)
	}

	be, ok := s.execRegistry.BackupFor(dialect)
	if !ok {
		return nil, fmt.Errorf("no backup executor for dialect %q", dialect)
	}

	// Ensure backup directory exists
	baseDir := s.backupDir
	if baseDir == "" {
		baseDir = "/var/backups/orion"
	}
	if err := os.MkdirAll(baseDir, 0o750); err != nil {
		return nil, fmt.Errorf("create backup dir %s: %w", baseDir, err)
	}

	artifactName := fmt.Sprintf("%s-%d.dump", opID, time.Now().Unix())
	artifactPath := filepath.Join(baseDir, artifactName)

	// Build executor options
	compressLevel := cfg.CompressLevel
	if compressLevel == 0 {
		compressLevel = 6
	}
	bpType := cfg.BackupType
	if bpType == "" {
		bpType = "full"
	}

	opts := executor.BackupOptions{
		Type:        bpType,
		Format:      "custom",
		Compression: compressLevel,
		Databases:   nonEmptyStrings(conn.DB),
		OutputPath:  artifactPath,
	}

	res, err := be.Backup(ctx, *conn, opts)
	if err != nil {
		os.Remove(artifactPath)
		return nil, fmt.Errorf("backup executor failed: %w", err)
	}

	finishedAt := time.Now().UTC()
	return &models.BackupResult{
		BackupID:       backupID,
		Status:         "completed",
		StartedAt:      startedAt.Format(time.RFC3339),
		FinishedAt:     finishedAt.Format(time.RFC3339),
		Size:           res.SizeBytes,
		OutputPath:     res.OutputPath,
		ChecksumSHA256: res.ChecksumSHA256,
		Duration:       finishedAt.Sub(startedAt).String(),
		Message:        fmt.Sprintf("Backup %s for database %s via %s", bpType, conn.DB, dialect),
	}, nil
}

// ExecuteRestore executes a restore operation. When the service has an executor
// registry and conn resolver, it performs a real engine-specific restore using
// the backup artifact path from cfg.BackupPath. When either is nil, it falls
// back to placeholder behavior.
func (s *Service) ExecuteRestore(ctx context.Context, tenantID, opID string) error {
	op, err := s.repo.Get(ctx, tenantID, opID)
	if err != nil || op == nil {
		return fmt.Errorf("operation not found")
	}

	var cfg models.RestoreConfig
	if op.Config != "" {
		if err := json.Unmarshal([]byte(op.Config), &cfg); err != nil {
			return fmt.Errorf("parse restore config: %w", err)
		}
	}

	_ = s.repo.UpdateStatus(ctx, tenantID, opID, "running")

	// --- Real execution path ---
	if s.canExecute() {
		if err := s.executeRealRestore(ctx, tenantID, opID, op.DatabaseID, &cfg); err != nil {
			_ = s.repo.UpdateStatus(ctx, tenantID, opID, "failed")
			return err
		}
	}

	_ = s.repo.UpdateStatus(ctx, tenantID, opID, "completed")
	return nil
}

// executeRealRestore resolves the target database connection info, looks up
// the restore executor, and runs the actual restore command.
func (s *Service) executeRealRestore(
	ctx context.Context,
	tenantID, opID, databaseID string,
	cfg *models.RestoreConfig,
) error {
	// Resolve target connection info
	conn, dialect, err := s.connResolver(ctx, tenantID, databaseID)
	if err != nil {
		return fmt.Errorf("resolve conn info for %s: %w", databaseID, err)
	}

	re, ok := s.execRegistry.RestoreFor(dialect)
	if !ok {
		return fmt.Errorf("no restore executor for dialect %q", dialect)
	}

	backupPath := cfg.BackupPath
	if backupPath == "" {
		return fmt.Errorf("restore requires backup_path in config")
	}

	opts := executor.RestoreOptions{
		BackupPath: backupPath,
		TargetConn: *conn,
		Clean:      true,
		IfExists:   true,
	}

	// PITR: parse point_in_time if provided
	if cfg.PointInTime != "" {
		ts, err := time.Parse(time.RFC3339, cfg.PointInTime)
		if err != nil {
			return fmt.Errorf("parse point_in_time %q: %w", cfg.PointInTime, err)
		}
		opts.TargetTime = &ts
	}

	_, err = re.Restore(ctx, opts)
	if err != nil {
		return fmt.Errorf("restore executor failed: %w", err)
	}
	return nil
}

// nonEmptyStrings returns a slice containing s when s is non-empty,
// or nil otherwise. Used to build executor options cleanly.
func nonEmptyStrings(s string) []string {
	if s == "" {
		return nil
	}
	return []string{s}
}
