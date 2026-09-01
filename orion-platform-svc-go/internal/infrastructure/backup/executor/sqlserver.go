package executor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// SQLServerExecutor implements BackupExecutor and RestoreExecutor for Microsoft
// SQL Server using sqlcmd.
//
// Scope (Phase 1a / G3):
//   - Logical full backup via `BACKUP DATABASE`; transaction-log (log_backup)
//     replay for PITR is planned and handed to the DBA as a runbook.
//   - Because there is no real-db verification in CI, the restore path is
//     runbook-first: `RESTORE DATABASE ... WITH RECOVERY` / `NORECOVERY` are
//     emitted as `#` comments for DBA review and execution. Mirrors the
//     PG PITR runbook pattern.
//   - Password travels via SQLCMD_PWD env, never argv (G2 baseline).
type SQLServerExecutor struct {
	SQLCmdBin string
}

// NewSQLServerExecutor returns a SQL Server executor with production defaults.
func NewSQLServerExecutor() *SQLServerExecutor {
	return &SQLServerExecutor{SQLCmdBin: DefaultBinPath("sqlcmd")}
}

func (e *SQLServerExecutor) Dialect() Dialect { return DialectSQLServer }

// requireSQLServerConn validates the minimum connection shape sqlcmd needs.
func requireSQLServerConn(conn ConnInfo) error {
	if conn.Host == "" {
		return fmt.Errorf("sqlserver: host is required")
	}
	if conn.DB == "" {
		return fmt.Errorf("sqlserver: database name is required")
	}
	return nil
}

// buildSQLServerEnv passes the password via SQLCMD_PWD instead of argv, which
// would be visible in ps output. Mirrors buildPGEnv/buildMySQLEnv so the G2
// env-only baseline holds for every engine.
func buildSQLServerEnv(conn ConnInfo) []string {
	env := os.Environ()
	appendPair := func(k, v string) {
		env = append(env, k+"="+v)
	}
	if conn.Port != "" {
		appendPair("SQLCMD_PORT", conn.Port)
	}
	if conn.User != "" {
		appendPair("SQLCMD_USER", conn.User)
	}
	if conn.Password != "" {
		appendPair("SQLCMD_PWD", conn.Password)
	}
	return env
}

// buildSQLServerBackupArgs assembles the sqlcmd invocation for a full database
// backup. `-b` sets ON ERROR EXIT so sqlcmd returns a non-zero exit code when
// the T-SQL batch fails, which RunCommand surfaces as an error.
func buildSQLServerBackupArgs(opts BackupOptions, conn ConnInfo) []string {
	args := []string{
		"-S", conn.Host + (func() string { if conn.Port != "" { return "," + conn.Port }; return "" })(),
		"-U", conn.User,
		"-b",
		"-Q", fmt.Sprintf("BACKUP DATABASE [%s] TO DISK = '%s' WITH INIT", conn.DB, opts.OutputPath),
	}
	args = append(args, opts.ExtraArgs...)
	return args
}

func (e *SQLServerExecutor) Backup(ctx context.Context, conn ConnInfo, opts BackupOptions) (*BackupResult, error) {
	sqlCmdBin := e.SQLCmdBin
	if sqlCmdBin == "" {
		sqlCmdBin = DefaultBinPath("sqlcmd")
	}
	ctx, cancel := WithTimeout(ctx, opts.Timeout)
	defer cancel()

	if err := requireSQLServerConn(conn); err != nil {
		return nil, err
	}
	if err := OutputPathAvailable(opts.OutputPath); err != nil {
		return nil, fmt.Errorf("sqlserver backup: %w", err)
	}

	args := buildSQLServerBackupArgs(opts, conn)
	stdout, err := RunCommand(ctx, sqlCmdBin, args, buildSQLServerEnv(conn), nil)
	if err != nil {
		return nil, fmt.Errorf("sqlserver backup: %w", err)
	}

	size, err := FileSize(opts.OutputPath)
	if err != nil {
		return nil, fmt.Errorf("sqlserver backup: %w", err)
	}
	checksum, err := SHA256File(opts.OutputPath)
	if err != nil {
		return nil, fmt.Errorf("sqlserver backup: %w", err)
	}

	result := &BackupResult{
		OutputPath:       opts.OutputPath,
		SizeBytes:        size,
		ChecksumSHA256:   checksum,
		CompressionRatio: 1.0,
	}

	if opts.EncryptKey != nil {
		if err := EncryptFile(opts.OutputPath, opts.OutputPath+".enc", opts.EncryptKey); err != nil {
			return nil, fmt.Errorf("sqlserver_encrypt: %w", err)
		}
		if err := os.Rename(opts.OutputPath+".enc", opts.OutputPath); err != nil {
			return nil, fmt.Errorf("sqlserver_encrypt: %w", err)
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

// sqlServerRunbookPath names the SQL Server recovery runbook for a given
// backup id.
func sqlServerRunbookPath(dir, backupID string) string {
	if dir == "" {
		dir = "/var/lib/orion-pitr"
	}
	return filepath.Join(dir, "sqlserver-restore-"+backupID+".sh")
}

// buildSQLServerRestoreScript renders the SQL Server recovery runbook.
// State-changing commands (`RESTORE DATABASE ... WITH NORECOVERY`, then the
// `RESTORE LOG ... WITH RECOVERY` for PITR) are emitted as `#` comments for
// DBA review; only idempotent verification steps run by default. Mirrors the
// PG PITR runbook pattern.
func buildSQLServerRestoreScript(backupID string, opts RestoreOptions, artifactPath string) string {
	var b strings.Builder
	b.WriteString("#!/usr/bin/env bash\n")
	b.WriteString("# SQL Server recovery runbook — review then execute.\n")
	b.WriteString("# Generated " + time.Now().UTC().Format(time.RFC3339) + "\n")
	b.WriteString("# Backup ID: " + backupID + "\n")
	b.WriteString("# Artifact: " + artifactPath + "\n")
	b.WriteString("set -euo pipefail\n\n")

	b.WriteString("# Verify connectivity and backup set. Non-destructive.\n")
	b.WriteString("sqlcmd -S " + opts.TargetConn.Host + " -Q \"RESTORE HEADERONLY FROM DISK = '" + artifactPath + "'\"\n")
	b.WriteString("sqlcmd -S " + opts.TargetConn.Host + " -Q \"RESTORE FILELISTONLY FROM DISK = '" + artifactPath + "'\"\n\n")

	b.WriteString("# --- REVIEW SECTION: uncomment to apply the recovery ---\n")
	b.WriteString("# 1) Restore the full backup with NORECOVERY (leaves DB restoring for log replay):\n")
	b.WriteString("# sqlcmd -S " + opts.TargetConn.Host + " -Q \"RESTORE DATABASE [" + opts.TargetConn.DB + "] FROM DISK = '" + artifactPath + "' WITH ")
	if opts.Clean {
		b.WriteString("REPLACE, ")
	}
	b.WriteString("NORECOVERY\"\n")
	if len(opts.ArchivePaths) > 0 {
		b.WriteString("# 2) Replay transaction-log backups (log_backup) in order, then RECOVERY:\n")
		for i, ap := range opts.ArchivePaths {
			b.WriteString("# sqlcmd -S " + opts.TargetConn.Host + " -Q \"RESTORE LOG [" + opts.TargetConn.DB + "] FROM DISK = '" + ap + "' WITH ")
			if i == len(opts.ArchivePaths)-1 {
				b.WriteString("RECOVERY\"\n")
			} else {
				b.WriteString("NORECOVERY\"\n")
			}
		}
	} else if opts.TargetTime != nil {
		b.WriteString("# 2) Recover to a point in time (requires STANDBY file for STOPAT):\n")
		b.WriteString("# sqlcmd -S " + opts.TargetConn.Host + " -Q \"RESTORE DATABASE [" + opts.TargetConn.DB + "] FROM DISK = '" + artifactPath + "' WITH RECOVERY, STOPAT = '" + opts.TargetTime.UTC().Format("2006-01-02 15:04:05.000") + "'\"\n")
	}
	return b.String()
}

func (e *SQLServerExecutor) Restore(ctx context.Context, opts RestoreOptions) (*RestoreResult, error) {
	ctx, cancel := WithTimeout(ctx, opts.Timeout)
	defer cancel()

	if err := requireSQLServerConn(opts.TargetConn); err != nil {
		return nil, err
	}

	artifactPath := opts.BackupPath
	if opts.DecryptKey != nil {
		tmp, err := os.CreateTemp("", "sqlserver-restore-*.bak")
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

	// PITR mode: require BackupID and produce the log-replay runbook.
	if opts.TargetTime != nil && len(opts.ArchivePaths) > 0 {
		if opts.BackupID == "" {
			return result, fmt.Errorf("sqlserver PITR restore requires BackupID (found empty)")
		}
		scratch := opts.ScratchDir
		if scratch == "" {
			scratch = "/var/lib/orion-pitr"
		}
		if err := os.MkdirAll(scratch, 0o755); err != nil {
			return result, err
		}
		scriptPath := sqlServerRunbookPath(scratch, opts.BackupID)
		script := buildSQLServerRestoreScript(opts.BackupID, opts, artifactPath)
		if err := os.WriteFile(scriptPath, []byte(script), 0o640); err != nil {
			return result, err
		}
		result.ScriptPath = scriptPath
	}

	result.Duration = time.Since(start)
	return result, nil
}
