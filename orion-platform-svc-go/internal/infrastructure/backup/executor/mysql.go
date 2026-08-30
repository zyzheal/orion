package executor

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"strings"
)

// MySQLExecutor implements BackupExecutor and RestoreExecutor for MySQL and
// MariaDB using the official mysqldump / mysql clients.
type MySQLExecutor struct {
	DumpBin    string
	ClientBin  string
}

// NewMySQLExecutor returns a MySQL executor with production defaults.
func NewMySQLExecutor() *MySQLExecutor {
	return &MySQLExecutor{
		DumpBin:   DefaultBinPath("mysqldump"),
		ClientBin: DefaultBinPath("mysql"),
	}
}

func (e *MySQLExecutor) Dialect() Dialect { return DialectMySQL }

// buildMySQLEnv passes the password via MYSQL_PWD to avoid exposing it in
// argv (which would be visible in ps output on shared hosts).
func buildMySQLEnv(conn ConnInfo) []string {
	env := os.Environ()
	if conn.Password != "" {
		env = append(env, "MYSQL_PWD="+conn.Password)
	}
	return env
}

func (e *MySQLExecutor) Backup(ctx context.Context, conn ConnInfo, opts BackupOptions) (*BackupResult, error) {
	dumpBin := e.DumpBin
	if dumpBin == "" {
		dumpBin = DefaultBinPath("mysqldump")
	}
	ctx, cancel := WithTimeout(ctx, opts.Timeout)
	defer cancel()

	if err := OutputPathAvailable(opts.OutputPath); err != nil {
		return nil, fmt.Errorf("mysqldump: %w", err)
	}

	args := []string{
		"--single-transaction",
		"--routines",
		"--triggers",
		"--events",
		"--set-gtid-purged=OFF",
		"--quick",
		"--column-dump",
		"--max-allowed-packet=64M",
		"--hex-blob",
		"-h", conn.Host,
		"-P", conn.Port,
		"-u", conn.User,
	}
	if len(opts.Databases) > 0 {
		args = append(args, "--databases")
	}
	args = append(args, opts.Databases...)
	args = append(args, "--result-file="+opts.OutputPath)
	args = append(args, opts.ExtraArgs...)

	stdout, err := RunCommand(ctx, dumpBin, args, buildMySQLEnv(conn), nil)
	if err != nil {
		return nil, err
	}

	size, err := FileSize(opts.OutputPath)
	if err != nil {
		return nil, fmt.Errorf("mysqldump: %w", err)
	}
	checksum, err := SHA256File(opts.OutputPath)
	if err != nil {
		return nil, fmt.Errorf("mysqldump: %w", err)
	}

	result := &BackupResult{
		OutputPath:       opts.OutputPath,
		SizeBytes:        size,
		ChecksumSHA256:   checksum,
		CompressionRatio: 1.0,
	}

	if opts.EncryptKey != nil {
		if err := EncryptFile(opts.OutputPath, opts.OutputPath+".enc", opts.EncryptKey); err != nil {
			return nil, fmt.Errorf("mysql_encrypt: %w", err)
		}
		if err := os.Rename(opts.OutputPath+".enc", opts.OutputPath); err != nil {
			return nil, fmt.Errorf("mysql_encrypt: %w", err)
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

func (e *MySQLExecutor) Restore(ctx context.Context, opts RestoreOptions) (*RestoreResult, error) {
	clientBin := e.ClientBin
	if clientBin == "" {
		clientBin = DefaultBinPath("mysql")
	}
	ctx, cancel := WithTimeout(ctx, opts.Timeout)
	defer cancel()

	// Decrypt to a temp file if needed so the mysql client can stream from
	// a plaintext SQL file.
	artifactPath := opts.BackupPath
	if opts.DecryptKey != nil {
		tmp, err := os.CreateTemp("", "mysql-restore-decrypt-*.sql")
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

	in, err := os.Open(artifactPath)
	if err != nil {
		return nil, fmt.Errorf("mysql restore: %w", err)
	}
	defer in.Close()

	args := []string{
		"-h", opts.TargetConn.Host,
		"-P", opts.TargetConn.Port,
		"-u", opts.TargetConn.User,
		"--max-allowed-packet=64M",
	}
	if opts.TargetConn.DB != "" {
		args = append(args, opts.TargetConn.DB)
	}

	cmd := newCmd(ctx, clientBin, args, buildMySQLEnv(opts.TargetConn))
	cmd.Stdin = in
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return &RestoreResult{Errors: []string{stderr.String()}}, fmt.Errorf("mysql: %w (stderr: %s)", err, strings.TrimSpace(stderr.String()))
	}
	result := &RestoreResult{}
	// Validate + account for binlog archive segments. Real MySQL PITR uses
	// mysqlbinlog --start-datetime/--stop-datetime + mysql client; Phase 4.
	if err := replayArchives(ctx, opts.ArchivePaths, result); err != nil {
		return result, err
	}
	return result, nil
}
