package executor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// OracleExecutor implements BackupExecutor and RestoreExecutor for Oracle
// Database using Data Pump (expdp/impdp) and RMAN.
//
// Scope (Phase 1a / G3):
//   - Logical full backup via expdp; archive-mode PITR is planned with RMAN.
//   - Because there is no real-db verification in CI for these blueprints, the
//     restore path is runbook-first: every state-changing command (impdp /
//     rman restore) is emitted as a `#` comment for DBA review and execution.
//     Only idempotent verification steps run by default. This mirrors the
//     PG PITR runbook pattern.
//   - Password travels via ORACLE_PWD env, never argv (G2 baseline).
type OracleExecutor struct {
	ExpdpBin string
	ImpdpBin string
	RmanBin  string
}

// NewOracleExecutor returns an Oracle executor with production defaults.
func NewOracleExecutor() *OracleExecutor {
	return &OracleExecutor{
		ExpdpBin: DefaultBinPath("expdp"),
		ImpdpBin: DefaultBinPath("impdp"),
		RmanBin:  DefaultBinPath("rman"),
	}
}

func (e *OracleExecutor) Dialect() Dialect { return DialectOracle }

// requireOracleConn validates the minimum connection shape Data Pump needs.
func requireOracleConn(conn ConnInfo) error {
	if conn.Host == "" || conn.Port == "" {
		return fmt.Errorf("oracle: host and port are required (got host=%q port=%q)", conn.Host, conn.Port)
	}
	if conn.User == "" {
		return fmt.Errorf("oracle: user is required")
	}
	return nil
}

// buildOracleEnv passes the password via ORACLE_PWD instead of argv, which
// would be visible in ps output. Mirrors buildPGEnv/buildMySQLEnv so the G2
// env-only baseline holds for every engine.
func buildOracleEnv(conn ConnInfo) []string {
	env := os.Environ()
	appendPair := func(k, v string) {
		env = append(env, k+"="+v)
	}
	if conn.Host != "" {
		appendPair("ORACLE_HOST", conn.Host)
	}
	if conn.Port != "" {
		appendPair("ORACLE_PORT", conn.Port)
	}
	if conn.DB != "" {
		appendPair("ORACLE_SERVICE", conn.DB)
	}
	if conn.User != "" {
		appendPair("ORACLE_USER", conn.User)
	}
	if conn.Password != "" {
		appendPair("ORACLE_PWD", conn.Password)
	}
	return env
}

// buildOracleDumpArgs assembles the expdp argument vector. The artifact is
// named inside an Oracle DIRECTORY which must be a volume shared with this
// host: directory=<parent of OutputPath>, dumpfile=<basename of OutputPath>.
// The tool writes <directory>/<dumpfile>, which equals OutputPath, so the
// backup pipeline fingerprints exactly the bytes that were produced.
func buildOracleDumpArgs(opts BackupOptions, conn ConnInfo) []string {
	dir := filepath.Dir(opts.OutputPath)
	name := filepath.Base(opts.OutputPath)
	args := []string{
		"userid=" + conn.User + "@" + conn.Host + ":" + conn.Port + "/" + conn.DB,
		"directory=" + dir,
		"dumpfile=" + name,
		"logfile=" + strings.TrimSuffix(name, ".dmp") + ".log",
		"parallel=" + strconv.Itoa(clampParallel(opts.MaxRowsPerFile)),
	}
	if opts.Compression > 0 {
		args = append(args, "compression=ALL")
	}
	for _, t := range opts.Tables {
		args = append(args, "tables="+t)
	}
	if opts.Type == "incremental" {
		args = append(args, "flashback_time=SYSTIMESTAMP")
	}
	args = append(args, opts.ExtraArgs...)
	return args
}

// clampParallel maps MaxRowsPerFile to a Data Pump parallel degree. The field
// is reused rather than adding a new option to keep the shared BackupOptions
// surface stable across engines.
func clampParallel(v int) int {
	if v <= 0 {
		return 1
	}
	if v > 32 {
		return 32
	}
	return v
}

func (e *OracleExecutor) Backup(ctx context.Context, conn ConnInfo, opts BackupOptions) (*BackupResult, error) {
	expdpBin := e.ExpdpBin
	if expdpBin == "" {
		expdpBin = DefaultBinPath("expdp")
	}
	ctx, cancel := WithTimeout(ctx, opts.Timeout)
	defer cancel()

	if err := requireOracleConn(conn); err != nil {
		return nil, err
	}
	if err := OutputPathAvailable(opts.OutputPath); err != nil {
		return nil, fmt.Errorf("oracle expdp: %w", err)
	}

	args := buildOracleDumpArgs(opts, conn)
	stdout, err := RunCommand(ctx, expdpBin, args, buildOracleEnv(conn), nil)
	if err != nil {
		return nil, fmt.Errorf("oracle expdp: %w", err)
	}

	size, err := FileSize(opts.OutputPath)
	if err != nil {
		return nil, fmt.Errorf("oracle expdp: %w", err)
	}
	checksum, err := SHA256File(opts.OutputPath)
	if err != nil {
		return nil, fmt.Errorf("oracle expdp: %w", err)
	}

	result := &BackupResult{
		OutputPath:       opts.OutputPath,
		SizeBytes:        size,
		ChecksumSHA256:   checksum,
		CompressionRatio: 1.0,
	}

	if opts.EncryptKey != nil {
		if err := EncryptFile(opts.OutputPath, opts.OutputPath+".enc", opts.EncryptKey); err != nil {
			return nil, fmt.Errorf("oracle_encrypt: %w", err)
		}
		if err := os.Rename(opts.OutputPath+".enc", opts.OutputPath); err != nil {
			return nil, fmt.Errorf("oracle_encrypt: %w", err)
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

// oracleRunbookPath names the RMAN recovery runbook for a given backup id.
func oracleRunbookPath(dir, backupID string) string {
	if dir == "" {
		dir = "/var/lib/orion-pitr"
	}
	return filepath.Join(dir, "oracle-rman-"+backupID+".sh")
}

// buildOracleRmanScript renders the RMAN recovery runbook. Every state-changing
// command (restore / recover) is emitted as a `#` comment for DBA review; only
// idempotent queries (rman target, list) run by default. This mirrors the
// PG PITR runbook pattern.
func buildOracleRmanScript(backupID string, opts RestoreOptions, artifactPath string) string {
	var b strings.Builder
	b.WriteString("#!/usr/bin/env bash\n")
	b.WriteString("# Oracle RMAN recovery runbook — review then execute.\n")
	b.WriteString("# Generated " + time.Now().UTC().Format(time.RFC3339) + "\n")
	b.WriteString("# Backup ID: " + backupID + "\n")
	b.WriteString("# Artifact: " + artifactPath + "\n")
	b.WriteString("set -euo pipefail\n\n")

	// Non-destructive verification steps run by default.
	if opts.DecryptKey != nil {
		b.WriteString("# Decrypt the artifact with the backup KMS key before restore.\n")
	}
	if artifactPath != "" {
		if sum, err := SHA256File(artifactPath); err == nil {
			b.WriteString("# Expected SHA256: " + sum + "\n")
		}
	}
	b.WriteString("# Connect and confirm the target database. Non-destructive.\n")
	b.WriteString("rman nocatalog target /\n")
	b.WriteString("list backup;\n\n")

	b.WriteString("# --- REVIEW SECTION: uncomment to apply the recovery ---\n")
	b.WriteString("# rman nocatalog target / <<'EOF'\n")
	b.WriteString("# run {\n")
	b.WriteString("#   allocate channel c1 device type disk;\n")
	if opts.Parallel > 1 {
		b.WriteString("#   allocate channel c2 device type disk;\n")
	}
	b.WriteString("#   restore database;\n")
	if opts.TargetTime != nil {
		b.WriteString("#   set until time = \"to_date('" + opts.TargetTime.UTC().Format("2006-01-02 15:04:05") + "', 'YYYY-MM-DD HH24:MI:SS')\";\n")
	}
	for _, ap := range opts.ArchivePaths {
		b.WriteString("#   catalog archivelog '" + ap + "';\n")
	}
	b.WriteString("#   recover database;\n")
	b.WriteString("# }\n")
	b.WriteString("# EOF\n")
	return b.String()
}

func (e *OracleExecutor) Restore(ctx context.Context, opts RestoreOptions) (*RestoreResult, error) {
	ctx, cancel := WithTimeout(ctx, opts.Timeout)
	defer cancel()

	if err := requireOracleConn(opts.TargetConn); err != nil {
		return nil, err
	}

	// Resolve the artifact the runbook should reference. Decrypt to a temp
	// file first when an encryption key is supplied.
	artifactPath := opts.BackupPath
	if opts.DecryptKey != nil {
		tmp, err := os.CreateTemp("", "oracle-restore-*.dmp")
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

	// Account for any staged archives to build the RPO estimate.
	start := time.Now()
	result := &RestoreResult{}
	archSizes := make([]int64, 0, len(opts.ArchivePaths))
	var newest time.Time
	for _, ap := range opts.ArchivePaths {
		if fi, err := os.Stat(ap); err == nil {
			archSizes = append(archSizes, fi.Size())
			if fi.ModTime().After(newest) {
				newest = fi.ModTime()
			}
		}
	}
	result.ArchReplayed = len(archSizes)
	result.ArchSizes = archSizes

	// PITR mode: require BackupID and produce the RMAN runbook.
	if opts.TargetTime != nil && len(opts.ArchivePaths) > 0 {
		if opts.BackupID == "" {
			return result, fmt.Errorf("oracle PITR restore requires BackupID (found empty)")
		}
		scratch := opts.ScratchDir
		if scratch == "" {
			scratch = "/var/lib/orion-pitr"
		}
		if err := os.MkdirAll(scratch, 0o755); err != nil {
			return result, err
		}
		scriptPath := oracleRunbookPath(scratch, opts.BackupID)
		script := buildOracleRmanScript(opts.BackupID, opts, artifactPath)
		if err := os.WriteFile(scriptPath, []byte(script), 0o640); err != nil {
			return result, err
		}
		result.ScriptPath = scriptPath
	}

	result.Duration = time.Since(start)
	return result, nil
}
