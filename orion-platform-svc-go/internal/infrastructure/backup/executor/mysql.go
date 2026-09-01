package executor

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
)

// MySQLExecutor implements BackupExecutor and RestoreExecutor for MySQL and
// MariaDB using the official mysqldump / mysql / mysqlbinlog clients.
type MySQLExecutor struct {
	DumpBin    string
	ClientBin  string
	BinlogBin  string
}

// NewMySQLExecutor returns a MySQL executor with production defaults.
func NewMySQLExecutor() *MySQLExecutor {
	return &MySQLExecutor{
		DumpBin:   DefaultBinPath("mysqldump"),
		ClientBin: DefaultBinPath("mysql"),
		BinlogBin: DefaultBinPath("mysqlbinlog"),
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
	// Real MySQL PITR replay: for each ArchivePath, run `mysqlbinlog <file> |
	// mysql ...` so the base backup is followed by the binlog segments in
	// order. --start-datetime / --stop-datetime (from opts.TargetTime)
	// are honoured by mysqlbinlog itself when PITR is requested.
	if err := e.replayArchivePaths(ctx, opts, clientBin, result); err != nil {
		return result, err
	}
	return result, nil
}

// replayArchivePaths runs real mysqlbinlog replay for each ArchivePath.
// When opts.ArchivePaths is empty the function returns immediately —
// the base restore has already completed in the caller.
func (e *MySQLExecutor) replayArchivePaths(ctx context.Context, opts RestoreOptions, clientBin string, result *RestoreResult) error {
	if len(opts.ArchivePaths) == 0 {
		return nil
	}
	binlogBin := e.BinlogBin
	if binlogBin == "" {
		binlogBin = DefaultBinPath("mysqlbinlog")
	}
	if _, err := exec.LookPath(binlogBin); err != nil {
		return fmt.Errorf("mysqlbinlog not found: %w", err)
	}

	binlogArgs := []string{
		"--database=" + opts.TargetConn.DB,
	}
	if opts.TargetTime != nil {
		// mysqlbinlog uses --stop-datetime to stop at the target time.
		// The start-datetime is implicitly the beginning of the first
		// segment we're replaying; mysqlbinlog handles that automatically.
		binlogArgs = append(binlogArgs,
			"--stop-datetime="+opts.TargetTime.UTC().Format("2006-01-02 15:04:05"),
		)
	}

	mysqlArgs := []string{
		"-h", opts.TargetConn.Host,
		"-P", opts.TargetConn.Port,
		"-u", opts.TargetConn.User,
		"--max-allowed-packet=64M",
	}
	if opts.TargetConn.DB != "" {
		mysqlArgs = append(mysqlArgs, opts.TargetConn.DB)
	}

	for i, path := range opts.ArchivePaths {
		if err := runBinlogReplay(ctx, binlogBin, binlogArgs, path, clientBin, mysqlArgs, opts.TargetConn, result); err != nil {
			return fmt.Errorf("archive segment %d (%s) replay failed: %w", i, path, err)
		}
		result.ArchReplayed++
	}
	return nil
}

// runBinlogReplay pipes `mysqlbinlog [args] <path>` stdout into
// `mysql [args]` stdin and reports the outcome.
func runBinlogReplay(ctx context.Context, binlogBin string, binlogArgs []string, path string, clientBin string, mysqlArgs []string, conn ConnInfo, result *RestoreResult) error {
	// Create an explicit io.Pipe so binlog stdout → mysql stdin can flow
	// without buffering through an intermediate file.
	pr, pw := io.Pipe()
	// Build the binlog command first so we can write its stdout to the pipe.
	binlogArgs = append(append([]string{}, binlogArgs...), path)
	binlogCmd := newCmd(ctx, binlogBin, binlogArgs, buildMySQLEnv(conn))
	binlogCmd.Stdout = pw
	var binlogStderr bytes.Buffer
	binlogCmd.Stderr = &binlogStderr
	if err := binlogCmd.Start(); err != nil {
		_ = pw.Close()
		return fmt.Errorf("start mysqlbinlog: %w", err)
	}

	// mysql consumes stdin from the pipe.
	mysqlCmd := newCmd(ctx, clientBin, mysqlArgs, buildMySQLEnv(conn))
	mysqlCmd.Stdin = pr
	var mysqlStderr bytes.Buffer
	mysqlCmd.Stderr = &mysqlStderr

	// Start mysql so the pipeline flows.
	if err := mysqlCmd.Start(); err != nil {
		_ = binlogCmd.Process.Kill()
		return fmt.Errorf("start mysql: %w", err)
	}

	// Wait for both processes. mysql exits when it consumes EOF on stdin,
	// which happens when mysqlbinlog exits (its stdout closes).
	binlogErr := binlogCmd.Wait()
	mysqlErr := mysqlCmd.Wait()

	if mysqlErr != nil {
		if s := strings.TrimSpace(mysqlStderr.String()); s != "" {
			return fmt.Errorf("mysql: %w (stderr: %s)", mysqlErr, s)
		}
		return fmt.Errorf("mysql: %w", mysqlErr)
	}
	if binlogErr != nil {
		if s := strings.TrimSpace(binlogStderr.String()); s != "" {
			return fmt.Errorf("mysqlbinlog: %w (stderr: %s)", binlogErr, s)
		}
		return fmt.Errorf("mysqlbinlog: %w", binlogErr)
	}
	return nil
}
