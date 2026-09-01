package service

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/infrastructure/backup/executor"
)

// ProbeTarget is the subset of executor.ConnInfo that a probe needs.
type ProbeTarget = executor.ConnInfo

// ProbeResult captures the outcome of a single dialect-specific probe.
type ProbeResult struct {
	Dialect     string    `json:"dialect"`
	TableCount  int       `json:"tableCount"`
	SampledRows int64     `json:"sampledRows"`
	CheckedAt   time.Time `json:"checkedAt"`
	DurationMs  int64     `json:"durationMs"`
	Detail      string    `json:"detail,omitempty"`
	Err         error     `json:"-"`
}

// ProbeTargetDB runs a dialect-appropriate probe against the target DB
// and reports table count + a sampled row total. It uses the same CLI
// binaries the executors already depend on (psql / mysql / ob-loader-dumper),
// so no new DB driver is added.
//
// Fail-closed: any error becomes a ProbeResult with Err set and Err != nil.
// Callers should inspect ProbeResult.Err (not just Detail) to distinguish
// connectivity failures from "0 tables found".
func ProbeTargetDB(ctx context.Context, dialect executor.Dialect, target ProbeTarget) (*ProbeResult, error) {
	start := time.Now()
	res := &ProbeResult{Dialect: string(dialect), CheckedAt: time.Now().UTC()}

	switch dialect {
	case executor.DialectPostgreSQL:
		return probePostgres(ctx, target, res, start)
	case executor.DialectMySQL:
		return probeMySQL(ctx, target, res, start, "")
	case executor.DialectOceanBase:
		// OceanBase in MySQL mode: same client, tenant flag appended.
		return probeMySQL(ctx, target, res, start, target.TenantName)
	default:
		res.Err = fmt.Errorf("unsupported dialect: %q", dialect)
		res.Detail = res.Err.Error()
		return res, res.Err
	}
}

func probePostgres(ctx context.Context, target ProbeTarget, res *ProbeResult, start time.Time) (*ProbeResult, error) {
	bin := executor.DefaultBinPath("psql")
	// Two-column output: non-system table count + total rows in the
	// current database (excluding information_schema + pg_catalog).
	query := `SELECT
		(SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')),
		(COALESCE((SELECT SUM(COALESCE(c.relrows,0)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast') AND c.relkind='r'), 0));`

	args := []string{"-t", "-A", "-F", "\t", "-c", query}
	stdout, err := runCLI(ctx, bin, args, map[string]string{
		"PGHOST":     target.Host,
		"PGPORT":     target.Port,
		"PGUSER":     target.User,
		"PGPASSWORD": target.Password,
		"PGDATABASE": target.DB,
		"PGSSLMODE":  target.SSLMode,
	})
	res.DurationMs = time.Since(start).Milliseconds()
	if err != nil {
		res.Err = err
		res.Detail = strings.TrimSpace(stdout)
		return res, err
	}
	parseProbeCount(stdout, res)
	res.Detail = "psql SELECT from information_schema.tables + pg_class"
	return res, nil
}

// probeMySQL handles both vanilla MySQL and OceanBase (MySQL mode).
// When tenant != "", it is passed as the -t flag after the db argument.
func probeMySQL(ctx context.Context, target ProbeTarget, res *ProbeResult, start time.Time, tenant string) (*ProbeResult, error) {
	bin := executor.DefaultBinPath("mysql")
	query := `SELECT
		COUNT(*),
		COALESCE((SELECT COALESCE(SUM(TABLE_ROWS),0) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()), 0)
		FROM information_schema.tables
		WHERE TABLE_SCHEMA = DATABASE();`

	args := []string{
		"-h", target.Host,
		"-P", target.Port,
		"-u", target.User,
		"-B", // tab-separated
		"--skip-column-names",
	}
	if tenant != "" {
		args = append(args, "-t", tenant)
	}
	args = append(args, target.DB, "-e", query)

	stdout, err := runCLI(ctx, bin, args, map[string]string{
		"MYSQL_PWD": target.Password,
		"MYSQL_P":   target.Password,
	})
	res.DurationMs = time.Since(start).Milliseconds()
	if err != nil {
		res.Err = err
		res.Detail = strings.TrimSpace(stdout)
		return res, err
	}
	parseProbeCount(stdout, res)
	if tenant != "" {
		res.Detail = "ob mysql-mode SELECT from information_schema.tables"
	} else {
		res.Detail = "mysql SELECT from information_schema.tables"
	}
	return res, nil
}

// runCLI executes a single CLI invocation with the given env additions and
// captures stdout + stderr. It returns an error when the command exits
// non-zero, but still returns the captured stdout so callers can log it.
// Passwords are passed via env (MYSQL_PWD / PGPASSWORD), never argv, so
// they don't show up in `ps` output.
func runCLI(ctx context.Context, bin string, args []string, extraEnv map[string]string) (string, error) {
	if _, err := exec.LookPath(bin); err != nil {
		return "", fmt.Errorf("binary %q not found: %w", bin, err)
	}
	cmd := exec.CommandContext(ctx, bin, args...)
	env := append([]string{}, os.Environ()...)
	for k, v := range extraEnv {
		env = append(env, k+"="+v)
	}
	cmd.Env = env

	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), err
	}
	return string(out), nil
}

// parseProbeCount extracts the two numbers from a "tables rows" line.
// psql -t -A -F "\t" and mysql -B --skip-column-names both produce a
// single tab-separated line.
func parseProbeCount(stdout string, res *ProbeResult) {
	line := strings.TrimSpace(stdout)
	if line == "" {
		return
	}
	// Take the first non-empty line (psql sometimes emits a trailing newline).
	if idx := strings.IndexByte(line, '\n'); idx >= 0 {
		line = line[:idx]
	}
	parts := strings.Split(line, "\t")
	if len(parts) < 2 {
		parts = strings.Fields(line)
	}
	if len(parts) >= 1 {
		n, _ := strconv.Atoi(strings.TrimSpace(parts[0]))
		res.TableCount = n
	}
	if len(parts) >= 2 {
		n, _ := strconv.ParseInt(strings.TrimSpace(parts[1]), 10, 64)
		res.SampledRows = n
	}
}
