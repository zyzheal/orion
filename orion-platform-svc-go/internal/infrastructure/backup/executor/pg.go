package executor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// PGExecutor implements BackupExecutor and RestoreExecutor for PostgreSQL
// using the official pg_dump / pg_restore tools.
type PGExecutor struct {
	DumpBin    string
	RestoreBin string
}

// NewPGExecutor returns a PostgreSQL executor with production defaults.
func NewPGExecutor() *PGExecutor {
	return &PGExecutor{DumpBin: DefaultBinPath("pg_dump"), RestoreBin: DefaultBinPath("pg_restore")}
}

func (e *PGExecutor) Dialect() Dialect { return DialectPostgreSQL }

// buildPGDumpArgs produces the argument list for pg_dump based on options.
func buildPGDumpArgs(opts BackupOptions) []string {
	args := []string{}
	if opts.Format == "" {
		args = append(args, "--format=custom")
	} else {
		args = append(args, "--format="+opts.Format)
	}
	args = append(args,
		"--compress="+strconv.Itoa(clampCompression(opts.Compression)),
		"--no-owner",
		"--no-privileges",
	)
	// --jobs requires format=custom and PG 12+; safe to always pass since
	// parallelism of 1 is the default and does not break single-DB dumps.
	args = append(args, "--jobs=1")
	for _, db := range opts.Databases {
		args = append(args, "--dbname="+db)
	}
	for _, t := range opts.Tables {
		args = append(args, "--table="+t)
	}
	for _, t := range opts.Exclude {
		args = append(args, "--exclude-table="+t)
	}
	args = append(args, opts.ExtraArgs...)
	args = append(args, opts.OutputPath)
	return args
}

// buildPGEnv returns the PG* environment variables pg_dump/pg_restore use to
// authenticate against the target. PGPASSWORD avoids leaking the password via
// argv (visible in ps output).
func buildPGEnv(conn ConnInfo) []string {
	env := os.Environ()
	appendPair := func(k, v string) {
		env = append(env, k+"="+v)
	}
	if conn.Host != "" {
		appendPair("PGHOST", conn.Host)
	}
	if conn.Port != "" {
		appendPair("PGPORT", conn.Port)
	}
	if conn.User != "" {
		appendPair("PGUSER", conn.User)
	}
	if conn.Password != "" {
		appendPair("PGPASSWORD", conn.Password)
	}
	if conn.SSLMode != "" {
		appendPair("PGSSLMODE", conn.SSLMode)
	}
	return env
}

func (e *PGExecutor) Backup(ctx context.Context, conn ConnInfo, opts BackupOptions) (*BackupResult, error) {
	dumpBin := e.DumpBin
	if dumpBin == "" {
		dumpBin = DefaultBinPath("pg_dump")
	}
	ctx, cancel := WithTimeout(ctx, opts.Timeout)
	defer cancel()

	if err := OutputPathAvailable(opts.OutputPath); err != nil {
		return nil, fmt.Errorf("pg_dump: %w", err)
	}

	// When encryption is requested we dump to a raw intermediate file first,
	// compute the plaintext checksum, then encrypt into the final OutputPath.
	// Keeping the plaintext checksum on the record lets the Verifier still
	// verify integrity after decryption.
	rawPath := opts.OutputPath
	if opts.EncryptKey != nil {
		rawPath = opts.OutputPath + ".raw"
	}

	args := buildPGDumpArgs(BackupOptions{Type: opts.Type, Format: opts.Format, Compression: opts.Compression,
		Databases: opts.Databases, Tables: opts.Tables, Exclude: opts.Exclude,
		OutputPath: rawPath, ExtraArgs: opts.ExtraArgs})

	stdout, err := RunCommand(ctx, dumpBin, args, buildPGEnv(conn), nil)
	if err != nil {
		return nil, err
	}

	size, err := FileSize(rawPath)
	if err != nil {
		return nil, fmt.Errorf("pg_dump: %w", err)
	}
	plaintextChecksum, err := SHA256File(rawPath)
	if err != nil {
		return nil, fmt.Errorf("pg_dump: %w", err)
	}

	result := &BackupResult{
		OutputPath:       opts.OutputPath,
		SizeBytes:        size,
		ChecksumSHA256:   plaintextChecksum,
		CompressionRatio: 1.0,
	}

	if opts.EncryptKey != nil {
		if err := EncryptFile(rawPath, opts.OutputPath, opts.EncryptKey); err != nil {
			return nil, fmt.Errorf("pg_encrypt: %w", err)
		}
		if err := os.Remove(rawPath); err != nil {
			result.Warnings = append(result.Warnings, "failed to remove raw artifact: "+err.Error())
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

func (e *PGExecutor) Restore(ctx context.Context, opts RestoreOptions) (*RestoreResult, error) {
	restoreBin := e.RestoreBin
	if restoreBin == "" {
		restoreBin = DefaultBinPath("pg_restore")
	}
	ctx, cancel := WithTimeout(ctx, opts.Timeout)
	defer cancel()

	// If the artifact is encrypted, decrypt to a temp file first.
	artifactPath := opts.BackupPath
	if opts.DecryptKey != nil {
		dec, cleanup, err := decryptToTemp(opts.BackupPath, opts.DecryptKey)
		if err != nil {
			return nil, err
		}
		defer cleanup()
		artifactPath = dec
	}

	args := []string{"-d", opts.TargetConn.DB, "-j", "1", "--verbose"}
	if opts.Clean {
		args = append(args, "--clean")
	}
	if opts.IfExists {
		args = append(args, "--if-exists")
	}
	args = append(args, artifactPath)

	stdout, err := RunCommand(ctx, restoreBin, args, buildPGEnv(opts.TargetConn), nil)
	if err != nil {
		return &RestoreResult{Errors: []string{stdout}}, err
	}
	result := &RestoreResult{}
	if stdout := strings.TrimSpace(stdout); stdout != "" {
		result.Warnings = append(result.Warnings, stdout)
	}
	// PITR mode: consume the Phase 6 recovery-plan producer. When a target
	// time and archive set are present, generate the runbook + manifest for
	// operator review instead of the old placeholder accounting. This closes
	// the PG PITR execution loop — the DBA executes the runbook against the
	// restored base to replay WAL up to TargetTime.
	if opts.TargetTime != nil && len(opts.ArchivePaths) > 0 {
		if opts.BackupID == "" {
			return result, fmt.Errorf("pg PITR restore requires BackupID (found empty)")
		}
		plan, err := PreparePGRecoveryPlan(ctx, PGRecoveryOptions{
			BackupID:     opts.BackupID,
			BackupPath:   opts.BackupPath,
			ArchivePaths: opts.ArchivePaths,
			TargetTime:   opts.TargetTime,
			ScratchDir:   opts.ScratchDir,
		}, nil)
		if err != nil {
			return result, err
		}
		result.ScriptPath = plan.ScriptPath
		result.ManifestPath = PITRManifestPath(filepath.Dir(plan.ScriptPath), opts.BackupID)
		result.ArchReplayed = len(plan.ArchiveFiles)
		result.ArchSizes = make([]int64, 0, len(plan.ArchiveFiles))
		for _, af := range plan.ArchiveFiles {
			result.ArchSizes = append(result.ArchSizes, af.Size)
		}
		return result, nil
	}
	// Non-PITR: account for any staged WAL/binlog segments (no target time).
	if err := replayArchives(ctx, opts.ArchivePaths, result); err != nil {
		return result, err
	}
	return result, nil
}

func (e *PGExecutor) encryptArtifact(path string, key []byte) error {
	if err := EncryptFile(path, path+".enc", key); err != nil {
		return fmt.Errorf("pg_encrypt: %w", err)
	}
	return os.Rename(path+".enc", path)
}

func decryptToTemp(encryptedPath string, key []byte) (string, func(), error) {
	tmp, err := os.CreateTemp("", "pg-restore-decrypt-*.sql")
	if err != nil {
		return "", nil, err
	}
	tmpPath := tmp.Name()
	tmp.Close()
	if err := DecryptFile(encryptedPath, tmpPath, key); err != nil {
		os.Remove(tmpPath)
		return "", nil, err
	}
	return tmpPath, func() { os.Remove(tmpPath) }, nil
}

func clampCompression(c int) int {
	if c < 0 {
		return 0
	}
	if c > 9 {
		return 9
	}
	return c
}
