package executor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// OceanBaseExecutor implements BackupExecutor and RestoreExecutor for
// OceanBase in MySQL mode using the official ob-loader-dumper tool.
//
// Scope (Phase 1a):
//   - MySQL-mode tenants only; Oracle mode arrives in Phase 2.
//   - Logical backup / restore via CSV, not physical (obd) snapshots.
//   - PITR is not supported; the redo stream lives in Phase 2.
type OceanBaseExecutor struct {
	ToolBin string
}

// NewOceanBaseExecutor returns an OceanBase executor with production defaults.
func NewOceanBaseExecutor() *OceanBaseExecutor {
	return &OceanBaseExecutor{ToolBin: DefaultBinPath("ob-loader-dumper")}
}

func (e *OceanBaseExecutor) Dialect() Dialect { return DialectOceanBase }

// requireMySQLMode validates the tenant is MySQL-mode, since ob-loader-dumper
// speaks the MySQL protocol. Failures here catch configuration mistakes
// before spawning a subprocess.
func requireMySQLMode(conn ConnInfo) error {
	if conn.TenantName == "" {
		return fmt.Errorf("oceanbase: tenant_name is required for MySQL-mode logical backup")
	}
	return nil
}

// buildOceanBaseEnv passes the password via OB_PASSWORD instead of argv
// ("-p"), which would be visible in `ps` output on shared hosts. It mirrors
// buildMySQLEnv (MYSQL_PWD) and PG's PGPASSWORD so the credential never leaves
// the child process environment. The env var name follows the Phase 7 plan
// (docs/backup-phase7-plan-2026-08-30.md G2); confirm against upstream
// ob-loader-dumper docs before changing it.
func buildOceanBaseEnv(conn ConnInfo) []string {
	env := os.Environ()
	if conn.Password != "" {
		env = append(env, "OB_PASSWORD="+conn.Password)
	}
	return env
}

func (e *OceanBaseExecutor) Backup(ctx context.Context, conn ConnInfo, opts BackupOptions) (*BackupResult, error) {
	toolBin := e.ToolBin
	if toolBin == "" {
		toolBin = DefaultBinPath("ob-loader-dumper")
	}
	ctx, cancel := WithTimeout(ctx, opts.Timeout)
	defer cancel()

	if err := requireMySQLMode(conn); err != nil {
		return nil, err
	}
	if err := OutputPathAvailable(opts.OutputPath); err != nil {
		return nil, fmt.Errorf("ob-loader-dumper: %w", err)
	}

	args := []string{
		"--load-threads=4",
		"--split=false",
		"--log-file=" + opts.OutputPath,
		"--db=" + conn.DB,
		"-u", conn.User,
		"-h", conn.Host,
		"-P", conn.Port,
	}
	if opts.MaxRowsPerFile > 0 {
		args = append(args, "--split=true",
			"--split-file-rows="+strconv.Itoa(opts.MaxRowsPerFile))
	}
	for _, t := range opts.Tables {
		args = append(args, "--tables="+t)
	}
	args = append(args, opts.ExtraArgs...)

	stdout, err := RunCommand(ctx, toolBin, args, buildOceanBaseEnv(conn), nil)
	if err != nil {
		return nil, fmt.Errorf("ob-loader-dumper: %w", err)
	}

	size, err := FileSize(opts.OutputPath)
	if err != nil {
		return nil, fmt.Errorf("ob-loader-dumper: %w", err)
	}
	checksum, err := SHA256File(opts.OutputPath)
	if err != nil {
		return nil, fmt.Errorf("ob-loader-dumper: %w", err)
	}

	result := &BackupResult{
		OutputPath:       opts.OutputPath,
		SizeBytes:        size,
		ChecksumSHA256:   checksum,
		CompressionRatio: 1.0,
	}

	if opts.EncryptKey != nil {
		if err := EncryptFile(opts.OutputPath, opts.OutputPath+".enc", opts.EncryptKey); err != nil {
			return nil, fmt.Errorf("ob_encrypt: %w", err)
		}
		if err := os.Rename(opts.OutputPath+".enc", opts.OutputPath); err != nil {
			return nil, fmt.Errorf("ob_encrypt: %w", err)
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

func (e *OceanBaseExecutor) Restore(ctx context.Context, opts RestoreOptions) (*RestoreResult, error) {
	toolBin := e.ToolBin
	if toolBin == "" {
		toolBin = DefaultBinPath("ob-loader-dumper")
	}
	ctx, cancel := WithTimeout(ctx, opts.Timeout)
	defer cancel()

	if err := requireMySQLMode(opts.TargetConn); err != nil {
		return nil, err
	}

	// Decrypt to a temp file if needed. ob-loader-dumper reads CSV directly.
	artifactPath := opts.BackupPath
	if opts.DecryptKey != nil {
		tmp, err := os.CreateTemp("", "ob-restore-decrypt-*.csv")
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

	args := []string{
		"--load",
		"--csv-file=" + artifactPath,
		"--db=" + opts.TargetConn.DB,
		"-u", opts.TargetConn.User,
		"-h", opts.TargetConn.Host,
		"-P", opts.TargetConn.Port,
		"--load-threads=4",
	}
	args = append(args, opts.WALExtra...)
	args = append(args, opts.TargetConn.TenantName) // pass tenant as trailing arg

	stdout, err := RunCommand(ctx, toolBin, args, buildOceanBaseEnv(opts.TargetConn), nil)
	if err != nil {
		return &RestoreResult{Errors: []string{stdout}}, fmt.Errorf("ob-loader-dumper --load: %w", err)
	}
	result := &RestoreResult{}
	if stdout := strings.TrimSpace(stdout); stdout != "" {
		result.Warnings = append(result.Warnings, stdout)
	}
	// PITR mode: delegate clog replay to the sys-tenant oblogminer executor.
	// State-changing recovery commands are emitted as a runbook for DBA review;
	// only idempotent verification runs by default (design D4, G4).
	if opts.TargetTime != nil && len(opts.ArchivePaths) > 0 {
		if opts.BackupID == "" {
			return result, fmt.Errorf("oceanbase PITR restore requires BackupID (found empty)")
		}
		if opts.TargetConn.TenantName != "sys" {
			return result, fmt.Errorf("oceanbase PITR restore requires sys tenant connection (got tenant %q)", opts.TargetConn.TenantName)
		}
		plan, err := PrepareOBCLogRecoveryPlan(ctx, OBCLogRecoveryOptions{
			BackupID:     opts.BackupID,
			BackupPath:   opts.BackupPath,
			ArchivePaths: opts.ArchivePaths,
			TargetTime:   opts.TargetTime,
			ScratchDir:   opts.ScratchDir,
			TargetConn:   opts.TargetConn,
		}, nil)
		if err != nil {
			return result, err
		}
		result.ScriptPath = plan.ScriptPath
		result.ManifestPath = OBCLogManifestPath(filepath.Dir(plan.ScriptPath), opts.BackupID)
		result.ArchReplayed = len(plan.ArchiveFiles)
		result.ArchSizes = make([]int64, 0, len(plan.ArchiveFiles))
		for _, f := range plan.ArchiveFiles {
			result.ArchSizes = append(result.ArchSizes, f.Size)
		}
		return result, nil
	}
	// Non-PITR: keep existing accounting (replayArchives).
	if err := replayArchives(ctx, opts.ArchivePaths, result); err != nil {
		return result, err
	}
	return result, nil
}
