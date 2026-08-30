// Package executor provides database-engine-specific backup and restore
// implementations. Each dialect (PostgreSQL, MySQL, OceanBase) is a pluggable
// executor registered with the shared Registry used by the backup service.
//
// Design intent (Phase 1a):
//   - Binary-first: reuse official tools (pg_dump, mysqldump, ob-loader-dumper)
//     so engine upgrade tracks with vendor releases.
//   - File-stream output: producers write to local disk first; the storage
//     backend (Local or S3) picks the file up afterwards. This lets the
//     Verifier re-open the same bytes that were uploaded.
//   - Fail-closed: every executor returns an error if the underlying tool
//     exits non-zero, so the caller can mark the record as failed.
package executor

import (
	"context"
	"errors"
	"os"
	"strings"
	"time"
)

// Dialect identifies the target database flavor. It is persisted in
// BackupTarget.Dialect and used by the Registry to route to the right executor.
type Dialect string

const (
	DialectPostgreSQL Dialect = "postgresql"
	DialectMySQL      Dialect = "mysql"
	DialectOceanBase  Dialect = "oceanbase"
)

// ErrUnsupportedDialect is returned when the Registry has no executor for a
// given dialect, typically because a new Dialect constant was added without a
// matching Register call.
var ErrUnsupportedDialect = errors.New("no executor registered for dialect")

// ConnInfo carries the credentials and connection parameters for a target
// database. Password is stored in plaintext only for the duration of the
// backup/restore process; executors must not write it to disk or logs.
type ConnInfo struct {
	Host       string
	Port       string
	DB         string
	User       string
	Password   string
	SSLMode    string // pg: require/verify-full; mysql: disabled/required
	TenantName string // OceanBase MySQL-mode tenant (required)
}

// BackupOptions controls how a single backup run is executed.
type BackupOptions struct {
	Type           string // full | incremental | differential (incremental/differential only honored by engines that support it)
	Format         string // pg: custom; mysql: dump; oceanbase: csv
	Compression    int    // 0-9
	Databases      []string
	Tables         []string
	Exclude        []string
	OutputPath     string
	EncryptKey     []byte // when non-nil, AES-256-GCM encrypts the final artifact
	MaxRowsPerFile int    // OceanBase split rows per CSV file
	Timeout        time.Duration
	ExtraArgs      []string
}

// BackupResult is the executor's outcome for a backup run. SizeBytes and
// ChecksumSHA256 describe the final artifact on disk (after any encryption).
type BackupResult struct {
	OutputPath       string
	SizeBytes        int64
	ChecksumSHA256   string
	CompressionRatio float64
	Encrypted        bool
	Warnings         []string
}

// RestoreOptions controls how a single restore run is executed.
type RestoreOptions struct {
	BackupPath  string
	TargetConn  ConnInfo
	Format      string
	Clean       bool
	IfExists    bool
	Parallel    int
	DecryptKey  []byte // when non-nil, decrypts the artifact before restore
	TargetTime  *time.Time // when non-nil triggers PITR (only honored by engines with WAL/binlog capture)
	// ArchivePaths is the ordered list of WAL/binlog files to replay after
	// the base backup is restored. Engines must honour the ordering —
	// WAL segments are monotonic in PostgreSQL, binlog index is monotonic
	// in MySQL. Nil or empty disables PITR replay.
	ArchivePaths []string
	WALExtra     []string
	Timeout      time.Duration
}

// RestoreResult is the executor's outcome for a restore run. Warnings and
// Errors are both collected so the caller can surface partial failures.
type RestoreResult struct {
	Duration     time.Duration
	RowsRestored int64
	Warnings     []string
	Errors       []string
	// ArchReplayed is the number of WAL/binlog archive segments the executor
	// actually walked when replaying after the base backup restore. It is 0
	// when ArchivePaths is empty (full restore only).
	ArchReplayed int
	// ArchSizes is the byte size of each replayed segment, in order. Useful
	// for operators to verify what was applied.
	ArchSizes []int64
}

// Executor is the umbrella interface implemented by every engine-specific
// backup/restore implementation. BackupExecutor and RestoreExecutor expose
// the operations each side supports; a single type may implement both.
type Executor interface {
	Dialect() Dialect
}

// BackupExecutor executes one backup run against a target database.
type BackupExecutor interface {
	Executor
	Backup(ctx context.Context, conn ConnInfo, opts BackupOptions) (*BackupResult, error)
}

// RestoreExecutor executes one restore run from a previously produced artifact.
type RestoreExecutor interface {
	Executor
	Restore(ctx context.Context, opts RestoreOptions) (*RestoreResult, error)
}

// ---- shared helpers ----

// IsSupported returns true when d is one of the Dialect constants this
// package has shipped implementations for. Useful as a config-time guard.
func IsSupported(d Dialect) bool {
	switch d {
	case DialectPostgreSQL, DialectMySQL, DialectOceanBase:
		return true
	}
	return false
}

// OutputPathAvailable reports whether a parent directory exists for a path
// the caller is about to hand to an executor, letting us fail fast with a
// clear message instead of a tool error mid-run.
func OutputPathAvailable(path string) error {
	dir := path
	if i := strings.LastIndexByte(path, '/'); i > 0 {
		dir = path[:i]
	}
	info, err := os.Stat(dir)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return errors.New("output path parent is not a directory")
	}
	return nil
}
