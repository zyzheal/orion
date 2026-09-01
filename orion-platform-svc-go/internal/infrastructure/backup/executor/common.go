package executor

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"
)

// BinPathResolver returns the absolute path to a backup/restore binary.
// Tests inject a resolver that returns a fake binary; production uses
// DefaultBinPath which reads from config defaults.
type BinPathResolver func(name string) string

// DefaultBinPath returns the production path for a well-known binary name.
func DefaultBinPath(name string) string {
	switch name {
	case "pg_dump":
		return "/usr/bin/pg_dump"
	case "pg_restore":
		return "/usr/bin/pg_restore"
	case "mysqldump":
		return "/usr/bin/mysqldump"
	case "mysql":
		return "/usr/bin/mysql"
	case "ob-loader-dumper":
		return "/usr/bin/ob-loader-dumper"
	case "oblogminer":
		return "/usr/bin/oblogminer"
	case "ob_client":
		return "/usr/bin/obclient"
	case "expdp":
		return "/usr/bin/expdp"
	case "impdp":
		return "/usr/bin/impdp"
	case "rman":
		return "/usr/bin/rman"
	case "db2":
		return "/usr/bin/db2"
	case "sqlcmd":
		return "/opt/mssql-tools18/bin/sqlcmd"
	}
	// Fall back to PATH lookup for anything else.
	return name
}

// SHA256File computes the SHA256 hex digest of a file, streaming in 64 KiB
// chunks so memory stays bounded regardless of artifact size.
func SHA256File(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, io.LimitReader(f, 1<<60)); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// FileSize returns the byte size of a file at path, or an error if missing.
func FileSize(path string) (int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		return 0, err
	}
	return info.Size(), nil
}

// RunCommand executes cmd with the given args, capturing stdout and stderr
// for error reporting. It is intentionally simple — executors wrap it with
// their own argument construction and env injection.
func RunCommand(ctx context.Context, path string, args []string, env []string, stdout io.Writer) (string, error) {
	cmd := exec.CommandContext(ctx, path, args...)
	cmd.Env = env
	if stdout != nil {
		cmd.Stdout = stdout
	}
	var stderr strings.Builder
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil {
		return stderr.String(), fmt.Errorf("%s: %w (stderr: %s)", path, err, strings.TrimSpace(stderr.String()))
	}
	return "", nil
}

// WithTimeout returns a new context with the given timeout. When timeout is
// non-positive, ctx is returned unchanged so callers can pass the parent
// timeout verbatim.
func WithTimeout(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	if timeout <= 0 {
		return ctx, func() {}
	}
	return context.WithTimeout(ctx, timeout)
}
