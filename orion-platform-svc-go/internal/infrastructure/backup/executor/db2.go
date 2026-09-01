package executor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// DB2Executor implements BackupExecutor and RestoreExecutor for IBM Db2 using
// the CLP (db2) command.
//
// Scope (Phase 1a / G3):
//   - Logical/online backup via `db2 backup database`; redo-log replay for
//     PITR is planned and handed to the DBA as a runbook.
//   - Because there is no real-db verification in CI, the restore path is
//     runbook-first: `restore database` / `rollforward` are emitted as `#`
//     comments for DBA review and execution. Mirrors the PG PITR pattern.
//   - Password travels via DB2_PWD env, never argv (G2 baseline).
type DB2Executor struct {
	DB2Bin string
}

// NewDB2Executor returns a Db2 executor with production defaults.
func NewDB2Executor() *DB2Executor {
	return &DB2Executor{DB2Bin: DefaultBinPath("db2")}
}

func (e *DB2Executor) Dialect() Dialect { return DialectDB2 }

// requireDB2Conn validates the minimum connection shape the CLP needs.
func requireDB2Conn(conn ConnInfo) error {
	if conn.DB == "" {
		return fmt.Errorf("db2: database name is required")
	}
	if conn.User == "" {
		return fmt.Errorf("db2: user is required")
	}
	return nil
}

// buildDB2Env passes the password via DB2_PWD instead of argv, which would be
// visible in ps output. Mirrors buildPGEnv/buildMySQLEnv so the G2 env-only
// baseline holds for every engine. (Blueprint: wire DB2_PWD to the CLP auth
// source when the real DBA environment is integrated.)
func buildDB2Env(conn ConnInfo) []string {
	env := os.Environ()
	appendPair := func(k, v string) {
		env = append(env, k+"="+v)
	}
	if conn.Host != "" {
		appendPair("DB2_HOST", conn.Host)
	}
	if conn.Port != "" {
		appendPair("DB2_PORT", conn.Port)
	}
	if conn.DB != "" {
		appendPair("DB2_DATABASE", conn.DB)
	}
	if conn.User != "" {
		appendPair("DB2_USER", conn.User)
	}
	if conn.Password != "" {
		appendPair("DB2_PWD", conn.Password)
	}
	return env
}

// buildDB2BackupArgs assembles the `db2 backup database` invocation. The
// online backup writes an image into the specified path (a local or shared
// filesystem the pipeline can fingerprint and upload).
func buildDB2BackupArgs(opts BackupOptions, conn ConnInfo) []string {
	args := []string{
		"backup", "database", conn.DB,
		"to", filepath.Dir(opts.OutputPath),
	}
	if opts.Type != "offline" {
		args = append(args, "online")
	}
	if opts.Compression > 0 {
		args = append(args, "compress")
	}
	args = append(args, opts.ExtraArgs...)
	return args
}

func (e *DB2Executor) Backup(ctx context.Context, conn ConnInfo, opts BackupOptions) (*BackupResult, error) {
	db2Bin := e.DB2Bin
	if db2Bin == "" {
		db2Bin = DefaultBinPath("db2")
	}
	ctx, cancel := WithTimeout(ctx, opts.Timeout)
	defer cancel()

	if err := requireDB2Conn(conn); err != nil {
		return nil, err
	}
	if err := OutputPathAvailable(opts.OutputPath); err != nil {
		return nil, fmt.Errorf("db2 backup: %w", err)
	}

	args := buildDB2BackupArgs(opts, conn)
	stdout, err := RunCommand(ctx, db2Bin, args, buildDB2Env(conn), nil)
	if err != nil {
		return nil, fmt.Errorf("db2 backup: %w", err)
	}

	size, err := FileSize(opts.OutputPath)
	if err != nil {
		return nil, fmt.Errorf("db2 backup: %w", err)
	}
	checksum, err := SHA256File(opts.OutputPath)
	if err != nil {
		return nil, fmt.Errorf("db2 backup: %w", err)
	}

	result := &BackupResult{
		OutputPath:       opts.OutputPath,
		SizeBytes:        size,
		ChecksumSHA256:   checksum,
		CompressionRatio: 1.0,
	}

	if opts.EncryptKey != nil {
		if err := EncryptFile(opts.OutputPath, opts.OutputPath+".enc", opts.EncryptKey); err != nil {
			return nil, fmt.Errorf("db2_encrypt: %w", err)
		}
		if err := os.Rename(opts.OutputPath+".enc", opts.OutputPath); err != nil {
			return nil, fmt.Errorf("db2_encrypt: %w", err)
		}
		result.Encrypted = true
		if encSize, err := FileSize(opts.OutputPath); err == nil {
			result.SizeBytes = encSize
		}
	}

	if stdout != "" {
		result.Warnings = append(result.Warnings, strings.TrimSpace(stdout))
	}
	return result, nil
}

// db2RunbookPath names the Db2 recovery runbook for a given backup id.
func db2RunbookPath(dir, backupID string) string {
	if dir == "" {
		dir = "/var/lib/orion-pitr"
	}
	return filepath.Join(dir, "db2-restore-"+backupID+".sh")
}

// buildDB2RestoreScript renders the Db2 recovery runbook. State-changing
// commands (restore database, rollforward) are emitted as `#` comments for DBA
// review; only idempotent verification steps run by default. Mirrors the
// PG PITR runbook pattern.
func buildDB2RestoreScript(backupID string, opts RestoreOptions, artifactPath string) string {
	var b strings.Builder
	b.WriteString("#!/usr/bin/env bash\n")
	b.WriteString("# Db2 recovery runbook — review then execute.\n")
	b.WriteString("# Generated " + time.Now().UTC().Format(time.RFC3339) + "\n")
	b.WriteString("# Backup ID: " + backupID + "\n")
	b.WriteString("# Artifact: " + artifactPath + "\n")
	b.WriteString("set -euo pipefail\n\n")

	b.WriteString("# Verify connectivity and list backup images. Non-destructive.\n")
	b.WriteString("db2 list backup images for " + opts.TargetConn.DB + "\n")
	b.WriteString("db2 get db cfg for " + opts.TargetConn.DB + " show db\n\n")

	b.WriteString("# --- REVIEW SECTION: uncomment to apply the recovery ---\n")
	b.WriteString("# db2 restore database " + opts.TargetConn.DB)
	if opts.IfExists {
		b.WriteString(" replace existing")
	}
	if opts.Clean {
		b.WriteString(" without prompting")
	}
	b.WriteString("\n")
	for _, ap := range opts.ArchivePaths {
		b.WriteString("# db2 rollforward database " + opts.TargetConn.DB + " to end of logs using overflow log path " + filepath.Dir(ap) + " and stop\n")
	}
	return b.String()
}

func (e *DB2Executor) Restore(ctx context.Context, opts RestoreOptions) (*RestoreResult, error) {
	ctx, cancel := WithTimeout(ctx, opts.Timeout)
	defer cancel()

	if err := requireDB2Conn(opts.TargetConn); err != nil {
		return nil, err
	}

	artifactPath := opts.BackupPath
	if opts.DecryptKey != nil {
		tmp, err := os.CreateTemp("", "db2-restore-*.img")
		if err != nil {
			return nil, err
		}
		tmpPath := tmp.Name()
		tmp.Close()
		if err := DecryptFile(opts.BackupPath, tmpPath, opts.DecryptKey); err != nil {
			os.Remove(tmpPath)
			return nil, err
		}
		defer os.Remove(tmpPath)
		artifactPath = tmpPath
	}

	start := time.Now()
	result := &RestoreResult{}
	archSizes := make([]int64, 0, len(opts.ArchivePaths))
	for _, ap := range opts.ArchivePaths {
		if fi, err := os.Stat(ap); err == nil {
			archSizes = append(archSizes, fi.Size())
		}
	}
	result.ArchReplayed = len(archSizes)
	result.ArchSizes = archSizes

	// PITR mode: require BackupID and produce the rollforward runbook.
	if opts.TargetTime != nil && len(opts.ArchivePaths) > 0 {
		if opts.BackupID == "" {
			return result, fmt.Errorf("db2 PITR restore requires BackupID (found empty)")
		}
		scratch := opts.ScratchDir
		if scratch == "" {
			scratch = "/var/lib/orion-pitr"
		}
		if err := os.MkdirAll(scratch, 0o755); err != nil {
			return result, err
		}
		scriptPath := db2RunbookPath(scratch, opts.BackupID)
		script := buildDB2RestoreScript(opts.BackupID, opts, artifactPath)
		if err := os.WriteFile(scriptPath, []byte(script), 0o640); err != nil {
			return result, err
		}
		result.ScriptPath = scriptPath
	}

	result.Duration = time.Since(start)
	return result, nil
}
