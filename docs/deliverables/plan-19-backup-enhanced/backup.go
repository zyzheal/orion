// Plan 19 — 备份增强 (Backup Enhancement)
// 本地: internal/backup/ (7 files, 1345 lines) has BackupPlan + RecoveryPlan + Restore + handler
// local has VerifyBackup endpoint but only stub verification
// 缺口: no WAL archiving, no incremental backup, no continuous backup, no checksum verify
package backup

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

type BackupType string

const (
	BackupFull       BackupType = "full"
	BackupIncremental BackupType = "incremental"
	BackupWAL        BackupType = "wal"
	BackupContinuous BackupType = "continuous"
)

type BackupResult struct {
	ID          string     `json:"id"`
	Type        BackupType `json:"type"`
	Size        int64      `json:"size"`
	Checksum    string     `json:"checksum"`
	Path        string     `json:"path"`
	Database    string     `json:"database"`
	StartedAt   time.Time  `json:"startedAt"`
	FinishedAt  *time.Time `json:"finishedAt,omitempty"`
	Status      string     `json:"status"` // running, completed, failed
	Error       string     `json:"error,omitempty"`
	ParentID    string     `json:"parentId,omitempty"` // for incremental
}

type BackupConfig struct {
	DataDir        string
	WALDir         string
	DestDir        string
	PGHost        string
	PGPort        int
	PGUser        string
	PGPassword    string
	CompressLevel int
	ParallelJobs  int
	RetentionDays int
}

type BackupManager struct {
	config  BackupConfig
	mu      sync.Mutex
	results map[string]*BackupResult
}

func NewBackupManager(cfg BackupConfig) *BackupManager {
	return &BackupManager{config: cfg, results: make(map[string]*BackupResult)}
}

func (bm *BackupManager) FullBackup(ctx context.Context, database string) (*BackupResult, error) {
	id := fmt.Sprintf("bkp-full-%d", time.Now().UnixNano())
	result := &BackupResult{
		ID:        id,
		Type:      BackupFull,
		Database:  database,
		StartedAt: time.Now(),
		Status:    "running",
	}
	bm.mu.Lock()
	bm.results[id] = result
	bm.mu.Unlock()

	destPath := filepath.Join(bm.config.DestDir, database, id)
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return nil, fmt.Errorf("create dest dir: %w", err)
	}

	cmd := exec.CommandContext(ctx, "pg_basebackup",
		"-h", bm.config.PGHost,
		"-p", fmt.Sprintf("%d", bm.config.PGPort),
		"-U", bm.config.PGUser,
		"-D", destPath,
		"-Ft", "-z", fmt.Sprintf("-Z%d", bm.config.CompressLevel),
		"-P",
	)
	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", bm.config.PGPassword))

	output, err := cmd.CombinedOutput()
	if err != nil {
		result.Status = "failed"
		result.Error = fmt.Sprintf("%s: %s", err.Error(), string(output))
		return result, err
	}

	checksum, size, err := computeChecksum(destPath)
	if err != nil {
		result.Status = "failed"
		result.Error = fmt.Sprintf("checksum failed: %v", err)
		return result, err
	}

	now := time.Now()
	result.Checksum = checksum
	result.Size = size
	result.Path = destPath
	result.Status = "completed"
	result.FinishedAt = &now

	return result, nil
}

func (bm *BackupManager) IncrementalBackup(ctx context.Context, database, parentID string) (*BackupResult, error) {
	id := fmt.Sprintf("bkp-incr-%d", time.Now().UnixNano())
	result := &BackupResult{
		ID:       id,
		Type:     BackupIncremental,
		Database: database,
		ParentID: parentID,
		StartedAt: time.Now(),
		Status:   "running",
	}
	bm.mu.Lock()
	bm.results[id] = result
	bm.mu.Unlock()

	parent, ok := bm.results[parentID]
	if !ok {
		result.Status = "failed"
		result.Error = "parent backup not found"
		return result, errors.New("parent backup not found")
	}

	destPath := filepath.Join(bm.config.DestDir, database, id+".wal")
	cmd := exec.CommandContext(ctx, "pg_receivewal",
		"-h", bm.config.PGHost,
		"-p", fmt.Sprintf("%d", bm.config.PGPort),
		"-U", bm.config.PGUser,
		"-D", destPath,
		"-Z", fmt.Sprintf("%d", bm.config.CompressLevel),
	)
	cmd.Env = append(os.Environ(), fmt.Sprintf("PGPASSWORD=%s", bm.config.PGPassword))

	output, err := cmd.CombinedOutput()
	if err != nil {
		result.Status = "failed"
		result.Error = fmt.Sprintf("%s: %s", err.Error(), string(output))
		return result, err
	}

	checksum, size, err := computeChecksum(destPath)
	if err != nil {
		result.Status = "failed"
		return result, err
	}

	now := time.Now()
	result.Checksum = checksum
	result.Size = size
	result.Path = destPath
	result.Status = "completed"
	result.FinishedAt = &now

	_ = parent
	return result, nil
}

func (bm *BackupManager) VerifyBackup(backupID string) error {
	bm.mu.Lock()
	result, ok := bm.results[backupID]
	bm.mu.Unlock()
	if !ok {
		return errors.New("backup not found")
	}

	currentChecksum, _, err := computeChecksum(result.Path)
	if err != nil {
		return fmt.Errorf("verify checksum failed: %w", err)
	}
	if currentChecksum != result.Checksum {
		return errors.New("checksum mismatch: backup data may be corrupted")
	}
	return nil
}

type WALArchiver struct {
	config  BackupConfig
	running bool
	cancel  context.CancelFunc
	mu      sync.Mutex
}

func NewWALArchiver(cfg BackupConfig) *WALArchiver {
	return &WALArchiver{config: cfg}
}

func (wa *WALArchiver) Start(ctx context.Context) error {
	wa.mu.Lock()
	if wa.running {
		wa.mu.Unlock()
		return errors.New("WAL archiver already running")
	}
	wa.running = true
	wa.mu.Unlock()

	ctx, cancel := context.WithCancel(ctx)
	wa.cancel = cancel

	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			wa.mu.Lock()
			wa.running = false
			wa.mu.Unlock()
			return nil
		case <-ticker.C:
			wa.archiveWALs()
		}
	}
}

func (wa *WALArchiver) Stop() {
	wa.mu.Lock()
	defer wa.mu.Unlock()
	if wa.cancel != nil {
		wa.cancel()
	}
	wa.running = false
}

func (wa *WALArchiver) archiveWALs() {
	entries, err := os.ReadDir(wa.config.WALDir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if len(name) < 24 || !isWALFile(name) {
			continue
		}
		src := filepath.Join(wa.config.WALDir, name)
		dst := filepath.Join(wa.config.DestDir, "wal", name)
		if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
			continue
		}
		if err := copyFile(src, dst); err != nil {
			continue
		}
		_ = os.Remove(src)
	}
}

func isWALFile(name string) bool {
	if len(name) < 24 {
		return false
	}
	for _, c := range name[:24] {
		if !((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

func computeChecksum(path string) (string, int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		return "", 0, err
	}
	if info.IsDir() {
		return computeDirChecksum(path)
	}
	return computeFileChecksum(path)
}

func computeFileChecksum(path string) (string, int64, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", 0, err
	}
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:]), int64(len(data)), nil
}

func computeDirChecksum(path string) (string, int64, error) {
	var totalSize int64
	h := sha256.New()
	err := filepath.Walk(path, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		data, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		h.Write(data)
		totalSize += info.Size()
		return nil
	})
	if err != nil {
		return "", 0, err
	}
	return hex.EncodeToString(h.Sum(nil)), totalSize, nil
}

func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}