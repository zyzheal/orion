package osc

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"go.uber.org/zap"
	_ "github.com/go-sql-driver/mysql"
)

// DefaultGhOstBinary is the standard install location for gh-ost.
const DefaultGhOstBinary = "/usr/local/bin/gh-ost"

// DefaultMaxLagMillis is the safe default for gh-ost --max-lag-millis.
const DefaultMaxLagMillis = 1500

// DefaultChunkSize is the safe default for gh-ost --chunk-size.
const DefaultChunkSize = 1000

// maxLogLines caps the size of the in-memory log tail returned to callers.
const maxLogLines = 500

// logTailLineLen caps a single log line so an attacker-controlled gh-ost
// output cannot blow up the caller's memory.
const logTailLineLen = 2048

// runningJob tracks an in-flight gh-ost process for Stop().
type runningJob struct {
	cmd    *exec.Cmd
	cancel context.CancelFunc
	seq    int // unique per register, used for unregister identity
}

// registerSeq is a monotonic counter so unregister only removes the
// job we just finished, not a re-registered one.
var registerSeq atomic.Int64

// GhOstConfig is the runtime configuration of a single gh-ost invocation.
type GhOstConfig struct {
	Host      string
	Port      int
	User      string
	Password  string
	DBName    string
	Table     string
	AlterSQL  string
	// GhostTable is optional; gh-ost defaults to gho_<table>.
	GhostTable string
	// DryRun omits --execute; gh-ost prints the migration plan and exits.
	DryRun bool
	// Cutover selects the cutover strategy: "two-step", "atomic" or
	// "instant". Empty means gh-ost's default (atomic).
	Cutover string
	// Threads is the gh-ost --concurrency value (row-copy workers).
	Threads int
	// MaxLagMillis pauses gh-ost if replication lag exceeds this value.
	MaxLagMillis int
	// ChunkSize controls how many rows are migrated per chunk.
	ChunkSize int
	// WebPort is the gh-ost web UI/API port. 0 disables the API.
	WebPort int
	// AdditionalArgs lets callers append advanced flags without touching
	// the schema; used sparingly for experimentation.
	AdditionalArgs []string
}

// GhOstStatus mirrors a subset of gh-ost's REST /api/* endpoints. The
// full schema is documented at https://github.com/github/gh-ost#api.
//
// All fields are pointers because gh-ost's JSON is deeply optional and we
// want to distinguish "field absent" from "field is zero".
type GhOstStatus struct {
	Running        bool    `json:"Running"`
	Error          bool    `json:"Error"`
	Completed      bool    `json:"Completed"`
	Progress       *int64  `json:"progress,omitempty"`
	TotalRows      *int64  `json:"total_rows,omitempty"`
	RowsCopied     *int64  `json:"rows_copied,omitempty"`
	Lag            *int64  `json:"lag,omitempty"`
	CPUUsage       *float64 `json:"cpu_usage,omitempty"`
	CurrentSchema  *string `json:"current_schema,omitempty"`
	CurrentTable   *string `json:"current_table,omitempty"`
	CurrentTableRows *int64 `json:"current_table_rows,omitempty"`
}

// GhOstResult is the post-mortem payload of a Start() call. It is
// intentionally flat (no gh-ost API data embedded) because the caller is
// expected to persist it in dba_osc_jobs.
type GhOstResult struct {
	JobID      string
	Success    bool
	Lag        int64
	Rows       int64
	Duration   time.Duration
	ExitCode   int
	Error      string
	Log        []string
	StatusURL  string
}

// GhOstEngine launches gh-ost processes and talks to the local gh-ost
// web API. It is safe for concurrent use; jobs are tracked in a
// per-instance map so multiple OSC jobs can run in parallel.
type GhOstEngine struct {
	binaryPath string
	webPort    int
	httpClient *http.Client
	log        *zap.Logger

	mu    sync.Mutex
	runs  map[string]*runningJob
}

// NewGhOstEngine constructs the engine. binaryPath may be empty to fall
// back to DefaultGhOstBinary; webPort of 0 disables Status() polling.
// If logger is nil, a no-op logger is used.
func NewGhOstEngine(binaryPath string, webPort int, logger *zap.Logger) *GhOstEngine {
	if binaryPath == "" {
		binaryPath = DefaultGhOstBinary
	}
	if logger == nil {
		logger = zap.NewNop()
	}
	return &GhOstEngine{
		binaryPath: binaryPath,
		webPort:    webPort,
		httpClient: &http.Client{Timeout: 3 * time.Second},
		log:        logger,
		runs:       make(map[string]*runningJob),
	}
}

// BuildArgs constructs the gh-ost CLI argument slice for cfg. This is
// the single source of truth for command shape and is exercised directly
// by unit tests.
//
// Ordering note: gh-ost parses --alter before --execute so we place
// --execute last to make failure modes obvious when grep-ing logs.
func (e *GhOstEngine) BuildArgs(cfg GhOstConfig) []string {
	port := cfg.Port
	if port <= 0 {
		port = 3306
	}
	maxLag := cfg.MaxLagMillis
	if maxLag <= 0 {
		maxLag = DefaultMaxLagMillis
	}
	chunk := cfg.ChunkSize
	if chunk <= 0 {
		chunk = DefaultChunkSize
	}
	concurrency := cfg.Threads
	if concurrency <= 0 {
		concurrency = 4
	}

	args := []string{
		fmt.Sprintf("--host=%s", cfg.Host),
		fmt.Sprintf("--port=%d", port),
		fmt.Sprintf("--user=%s", cfg.User),
		fmt.Sprintf("--password=%s", cfg.Password),
		fmt.Sprintf("--database=%s", cfg.DBName),
		fmt.Sprintf("--table=%s", cfg.Table),
		fmt.Sprintf("--alter=%q", cfg.AlterSQL),
		"--execute",
		"--assume-rbr",
		"--assume-replicated-auto-increment",
		fmt.Sprintf("--chunk-size=%d", chunk),
		fmt.Sprintf("--max-lag-millis=%d", maxLag),
		"--heartbeat-interval-millis=100",
		fmt.Sprintf("--concurrency=%d", concurrency),
	}

	if cfg.GhostTable != "" {
		args = append(args, fmt.Sprintf("--ghost-table=%s", cfg.GhostTable))
	}
	if cfg.Cutover != "" {
		args = append(args, fmt.Sprintf("--cutover-method=%s", cfg.Cutover))
	}
	if cfg.WebPort > 0 {
		args = append(args, fmt.Sprintf("--hooks-hint=api"))
		args = append(args, fmt.Sprintf("--web-port=%d", cfg.WebPort))
	}
	if cfg.DryRun {
		// Dry run: strip --execute so gh-ost prints the plan and exits.
		args = stripExecute(args)
	}
	args = append(args, cfg.AdditionalArgs...)
	return args
}

// stripExecute removes --execute from args. We keep the rest of the
// command shape identical to the execute path so dry runs validate the
// exact same arguments that would run in production.
func stripExecute(args []string) []string {
	out := make([]string, 0, len(args))
	for _, a := range args {
		if a == "--execute" {
			continue
		}
		out = append(out, a)
	}
	return out
}

// BinaryPath returns the configured gh-ost binary location.
func (e *GhOstEngine) BinaryPath() string { return e.binaryPath }

// ValidateBinary returns a helpful error when gh-ost is missing.
// Called by the service before launching a job.
func (e *GhOstEngine) ValidateBinary() error {
	if _, err := os.Stat(e.binaryPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("gh-ost binary not found at %s; install gh-ost or configure OSC_GHOST_BINARY", e.binaryPath)
		}
		return fmt.Errorf("gh-ost binary check failed: %w", err)
	}
	// Executable bit is best-effort; gh-ost wrappers sometimes land here
	// with only read bits and a shell wrapper handles the exec.
	if fi, err := os.Stat(e.binaryPath); err == nil && fi.Mode()&0100 == 0 {
		e.log.Warn("gh-ost binary is not executable, attempting anyway",
			zap.String("path", e.binaryPath), zap.String("mode", fi.Mode().String()))
	}
	return nil
}

// PingMySQL opens a short-lived MySQL connection and runs SELECT 1 to
// validate the caller-supplied credentials before spawning gh-ost.
// gh-ost connects on its own but failing fast here yields a much better
// UX than a gh-ost subprocess dying 30 seconds into its run.
func PingMySQL(ctx context.Context, cfg GhOstConfig) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?timeout=3s",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.DBName)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("open mysql: %w", err)
	}
	defer db.Close()
	db.SetConnMaxLifetime(3 * time.Second)
	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("mysql ping %s:%d/%s: %w", cfg.Host, cfg.Port, cfg.DBName, err)
	}
	return nil
}

// Start launches gh-ost and blocks until it exits (or ctx is cancelled).
// A DryRun cfg causes Start to omit --execute so gh-ost prints the plan
// and exits with 0.
//
// Real-time output is streamed to the engine logger as well as captured
// into a bounded ring buffer that ends up in GhOstResult.Log.
func (e *GhOstEngine) Start(ctx context.Context, jobID string, cfg GhOstConfig) (*GhOstResult, error) {
	if cfg.Table == "" {
		return nil, errors.New("table is required")
	}
	if cfg.AlterSQL == "" {
		return nil, errors.New("alter_sql is required")
	}

	if err := e.ValidateBinary(); err != nil {
		return nil, err
	}

	args := e.BuildArgs(cfg)
	e.log.Info("launching gh-ost",
		zap.String("job_id", jobID),
		zap.String("table", cfg.Table),
		zap.Bool("dry_run", cfg.DryRun),
		zap.Strings("args", redactArgs(args)))

	started := time.Now()
	res := &GhOstResult{JobID: jobID, Log: []string{}}

	// Create our own cancellable context so Stop() can terminate the
	// process without the caller needing to hold onto the original ctx.
	runCtx, cancel := context.WithCancel(ctx)
	cmd := exec.CommandContext(runCtx, e.binaryPath, args...)

	run := &runningJob{cmd: cmd, cancel: cancel, seq: int(registerSeq.Add(1))}
	e.register(jobID, run)
	defer e.unregister(jobID, run.seq)

	// Wire stdout/stderr into a shared bounded ring buffer so the
	// engine can tail gh-ost output in real-time. Pipes MUST be set
	// up BEFORE cmd.Start() or Go returns "StdoutPipe after process
	// started".
	buf := newLogBuffer()
	outPipe, outErr := cmd.StdoutPipe()
	if outErr != nil {
		cancel()
		return nil, fmt.Errorf("stdout pipe: %w", outErr)
	}
	errPipe, errErr := cmd.StderrPipe()
	if errErr != nil {
		cancel()
		return nil, fmt.Errorf("stderr pipe: %w", errErr)
	}

	if err := cmd.Start(); err != nil {
		cancel()
		return nil, fmt.Errorf("start gh-ost: %w", err)
	}

	g := new(sync.WaitGroup)
	g.Add(2)
	go streamLogs(outPipe, buf, e.log, jobID, g, runCtx)
	go streamLogs(errPipe, buf, e.log, jobID, g, runCtx)

	// Poll the gh-ost web API if enabled; store the final status in res.
	if cfg.WebPort > 0 {
		res.StatusURL = fmt.Sprintf("http://localhost:%d", cfg.WebPort)
		g.Add(1)
		go pollStatus(cfg.WebPort, buf, e.log, runCtx, g, res)
	}

	g.Wait()
	waitErr := cmd.Wait()

	cancel()
	res.Duration = time.Since(started)
	res.Log = buf.snapshot()

	if waitErr != nil {
		res.Success = false
		res.ExitCode = cmd.ProcessState.ExitCode()
		res.Error = truncateErr(waitErr)
		e.log.Warn("gh-ost exited with error",
			zap.String("job_id", jobID),
			zap.Int("exit_code", res.ExitCode),
			zap.Error(waitErr),
			zap.Duration("duration", res.Duration))
	} else {
		res.Success = true
		res.ExitCode = 0
		e.log.Info("gh-ost completed",
			zap.String("job_id", jobID),
			zap.Duration("duration", res.Duration),
			zap.Bool("dry_run", cfg.DryRun))
	}
	return res, nil
}

// Stop gracefully stops a running gh-ost process by cancelling its
// context. Returns an error when no process is registered under jobID.
func (e *GhOstEngine) Stop(ctx context.Context, jobID string) error {
	_ = ctx
	e.mu.Lock()
	run, ok := e.runs[jobID]
	if !ok {
		e.mu.Unlock()
		return fmt.Errorf("no running gh-ost process for job %s", jobID)
	}
	e.mu.Unlock()
	run.cancel()
	e.log.Info("cancelled gh-ost", zap.String("job_id", jobID))
	return nil
}

// IsRunning reports whether a job has an active gh-ost subprocess.
func (e *GhOstEngine) IsRunning(jobID string) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	_, ok := e.runs[jobID]
	return ok
}

// Status queries the gh-ost web API at localhost:port/api/* and parses
// the JSON response. If the API is unreachable (not started or already
// finished) the caller gets (nil, err).
func (e *GhOstEngine) Status(ctx context.Context, port int) (*GhOstStatus, error) {
	if port <= 0 {
		return nil, errors.New("web port not configured; status unavailable")
	}
	url := fmt.Sprintf("http://localhost:%d/api/status", port)
	return fetchStatus(ctx, e.httpClient, url)
}

func (e *GhOstEngine) register(jobID string, run *runningJob) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.runs[jobID] = run
}

func (e *GhOstEngine) unregister(jobID string, seq int) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if run, ok := e.runs[jobID]; ok && run.seq == seq {
		delete(e.runs, jobID)
	}
}

// fetchStatus performs the HTTP fetch + JSON decode. Extracted so tests
// can inject a custom client.
func fetchStatus(ctx context.Context, client *http.Client, url string) (*GhOstStatus, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gh-ost status: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gh-ost status: http %d", resp.StatusCode)
	}
	var st GhOstStatus
	if err := json.NewDecoder(resp.Body).Decode(&st); err != nil {
		return nil, fmt.Errorf("decode gh-ost status: %w", err)
	}
	return &st, nil
}

// pollStatus is a background goroutine that periodically pulls the
// gh-ost API status and pushes a status line into the shared log buffer.
// This gives operators a live-ish feed in the job log without adding a
// second transport to the client.
func pollStatus(port int, buf *logBuffer, log *zap.Logger, ctx context.Context, g *sync.WaitGroup, res *GhOstResult) {
	defer g.Done()
	client := &http.Client{Timeout: 2 * time.Second}
	url := fmt.Sprintf("http://localhost:%d/api/status", port)
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			st, err := fetchStatus(ctx, client, url)
			if err != nil {
				continue
			}
			line := formatStatusLine(st)
			buf.append(line)
			log.Debug("gh-ost status", zap.String("line", line))
			// Capture the freshest metrics in the result.
			if st.Lag != nil {
				res.Lag = *st.Lag
			}
			if st.RowsCopied != nil {
				res.Rows = *st.RowsCopied
			}
		}
	}
}

func formatStatusLine(st *GhOstStatus) string {
	parts := []string{fmt.Sprintf("running=%t", st.Running)}
	if st.TotalRows != nil && *st.TotalRows > 0 && st.RowsCopied != nil {
		parts = append(parts, fmt.Sprintf("progress=%.1f%%",
			float64(*st.RowsCopied)*100/float64(*st.TotalRows)))
	}
	if st.Lag != nil {
		parts = append(parts, fmt.Sprintf("lag=%dms", *st.Lag))
	}
	if st.Error {
		parts = append(parts, "error=true")
	}
	if st.Completed {
		parts = append(parts, "completed=true")
	}
	return "gh-ost: " + strings.Join(parts, " ")
}

// redactArgs masks the --password=... argument for logging.
func redactArgs(args []string) []string {
	out := make([]string, len(args))
	for i, a := range args {
		if strings.HasPrefix(a, "--password=") {
			out[i] = "--password=***"
		} else {
			out[i] = a
		}
	}
	return out
}

// truncateErr caps an error string to 2KB so a runaway gh-ost error
// message can't blow out the log or the response body.
func truncateErr(err error) string {
	s := err.Error()
	if len(s) > 2048 {
		return s[:2048] + "... (truncated)"
	}
	return s
}

// logBuffer is a thread-safe bounded ring buffer of log lines. Two
// goroutines (stdout and stderr) write to it, one reader snapshots it.
type logBuffer struct {
	mu    sync.Mutex
	lines []string
	drop  int64
}

func newLogBuffer() *logBuffer { return &logBuffer{lines: make([]string, 0, 128)} }

func (b *logBuffer) append(line string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if len(line) > logTailLineLen {
		line = line[:logTailLineLen] + "..."
	}
	if len(b.lines) >= maxLogLines {
		atomic.AddInt64(&b.drop, 1)
		return
	}
	b.lines = append(b.lines, line)
}

func (b *logBuffer) snapshot() []string {
	b.mu.Lock()
	defer b.mu.Unlock()
	out := make([]string, len(b.lines))
	copy(out, b.lines)
	return out
}

// streamLogs reads a stream until EOF, ctx cancellation, or scanner
// error, and appends each line to buf. It also mirrors the line to the
// logger at Debug level. When ctx is cancelled we close the pipe (if
// it implements io.Closer) so scanner.Scan() returns with an error and
// the goroutine can exit — otherwise a subprocess holding the pipe open
// would block the WaitGroup forever.
func streamLogs(r io.Reader, buf *logBuffer, log *zap.Logger, jobID string, g *sync.WaitGroup, ctx context.Context) {
	if g != nil {
		defer g.Done()
	}
	// Watch for ctx cancellation and close the pipe to unblock the scanner.
	if ctx != nil {
		if c, ok := r.(io.Closer); ok {
			go func() {
				select {
				case <-ctx.Done():
					_ = c.Close()
				}
			}()
		}
	}
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 4096), 65536)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}
		line := scanner.Text()
		buf.append(line)
		log.Debug("gh-ost output", zap.String("job_id", jobID), zap.String("line", line))
	}
	if err := scanner.Err(); err != nil {
		buf.append(fmt.Sprintf("read error: %s", err))
	}
}
