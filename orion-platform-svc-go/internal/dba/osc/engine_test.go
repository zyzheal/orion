package osc

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap"
)

func newTestEngine(t *testing.T, bin string) *GhOstEngine {
	t.Helper()
	if bin == "" {
		bin = DefaultGhOstBinary
	}
	return NewGhOstEngine(bin, 10008, zap.NewNop())
}

// writeFakeBinary writes a tiny executable that echoes its args and
// exits with the code on the first line of its content.
//
// We use a shell script because the OSC engine is expected to invoke a
// real binary; the fake stands in for gh-ost during unit tests.
func writeFakeBinary(t *testing.T, body string) string {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("posix script fake not available on windows")
	}
	dir := t.TempDir()
	p := filepath.Join(dir, "fake-gh-ost")
	if err := os.WriteFile(p, []byte(body), 0o755); err != nil {
		t.Fatalf("write fake: %v", err)
	}
	return p
}

func TestBuildArgs_HappyPath(t *testing.T) {
	e := newTestEngine(t, "/usr/local/bin/gh-ost")
	cfg := GhOstConfig{
		Host:         "db.example",
		Port:         3306,
		User:         "osc",
		Password:     "secret",
		DBName:       "app",
		Table:        "orders",
		AlterSQL:     "ADD COLUMN note TEXT",
		Cutover:      CutoverAtomic,
		MaxLagMillis: 2000,
		ChunkSize:    500,
		Threads:      8,
	}
	args := e.BuildArgs(cfg)

	mustContain := []string{
		"--host=db.example",
		"--port=3306",
		"--user=osc",
		"--password=secret",
		"--database=app",
		"--table=orders",
		"--alter=\"ADD COLUMN note TEXT\"",
		"--execute",
		"--assume-rbr",
		"--assume-replicated-auto-increment",
		"--chunk-size=500",
		"--max-lag-millis=2000",
		"--heartbeat-interval-millis=100",
		"--concurrency=8",
		"--cutover-method=atomic",
	}
	for _, want := range mustContain {
		if !containsStr(args, want) {
			t.Fatalf("BuildArgs missing %q in %v", want, args)
		}
	}
}

func TestBuildArgs_DryRunOmitsExecute(t *testing.T) {
	e := newTestEngine(t, "")
	cfg := GhOstConfig{
		Host: "h", Port: 0, User: "u", Password: "p",
		DBName: "d", Table: "t", AlterSQL: "ALTER",
		DryRun: true,
	}
	args := e.BuildArgs(cfg)
	if containsStr(args, "--execute") {
		t.Fatalf("dry-run must not contain --execute: %v", args)
	}
	// Other flags should be present to validate the plan against real args.
	for _, want := range []string{"--host=h", "--table=t", "--database=d"} {
		if !containsStr(args, want) {
			t.Fatalf("dry-run BuildArgs missing %q", want)
		}
	}
}

func TestBuildArgs_DefaultsWhenZero(t *testing.T) {
	e := newTestEngine(t, "")
	cfg := GhOstConfig{Host: "h", User: "u", DBName: "d", Table: "t", AlterSQL: "A"}
	args := e.BuildArgs(cfg)
	for _, want := range []string{
		"--port=3306",
		fmt.Sprintf("--max-lag-millis=%d", DefaultMaxLagMillis),
		fmt.Sprintf("--chunk-size=%d", DefaultChunkSize),
		"--concurrency=4",
	} {
		if !containsStr(args, want) {
			t.Fatalf("defaults missing %q in %v", want, args)
		}
	}
}

func TestBuildArgs_GhostTableAndWebPort(t *testing.T) {
	e := newTestEngine(t, "")
	cfg := GhOstConfig{
		Host: "h", User: "u", DBName: "d", Table: "t", AlterSQL: "A",
		GhostTable: "custom_gho", WebPort: 12008,
	}
	args := e.BuildArgs(cfg)
	if !containsStr(args, "--ghost-table=custom_gho") {
		t.Fatalf("missing ghost-table flag in %v", args)
	}
	if !containsStr(args, "--web-port=12008") {
		t.Fatalf("missing web-port flag in %v", args)
	}
	if !containsStr(args, "--hooks-hint=api") {
		t.Fatalf("missing hooks-hint=api in %v", args)
	}
}

func TestStripExecute_RemovesOnlyExecute(t *testing.T) {
	in := []string{"--host=h", "--execute", "--table=t", "--assume-rbr"}
	out := stripExecute(in)
	if len(out) != 3 {
		t.Fatalf("stripExecute: got %d args want 3: %v", len(out), out)
	}
	if containsStr(out, "--execute") {
		t.Fatalf("stripExecute still contains --execute: %v", out)
	}
}

func TestRedactArgs_MasksPassword(t *testing.T) {
	in := []string{"--user=u", "--password=secret", "--host=h"}
	out := redactArgs(in)
	if out[1] != "--password=***" {
		t.Fatalf("redactArgs did not mask password: %v", out)
	}
	if out[0] != "--user=u" || out[2] != "--host=h" {
		t.Fatalf("redactArgs mangled non-password args: %v", out)
	}
}

func TestValidateBinary_Missing(t *testing.T) {
	e := NewGhOstEngine("/definitely/not/a/real/path/gh-ost", 0, zap.NewNop())
	err := e.ValidateBinary()
	if err == nil {
		t.Fatal("ValidateBinary should fail for missing path")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Fatalf("ValidateBinary error message missing 'not found': %v", err)
	}
}

func TestValidateBinary_Present(t *testing.T) {
	bin := writeFakeBinary(t, "#!/bin/sh\necho hello\n")
	e := NewGhOstEngine(bin, 0, zap.NewNop())
	if err := e.ValidateBinary(); err != nil {
		t.Fatalf("ValidateBinary unexpected: %v", err)
	}
}

func TestStart_SuccessWithFakeBinary(t *testing.T) {
	body := `#!/bin/sh
echo "launching migration"
echo "copying rows"
echo "cut over complete"
exit 0
`
	bin := writeFakeBinary(t, body)
	e := NewGhOstEngine(bin, 0, zap.NewNop())

	cfg := GhOstConfig{Host: "h", User: "u", DBName: "d", Table: "t", AlterSQL: "ALTER"}
	res, err := e.Start(context.Background(), "job-1", cfg)
	if err != nil {
		t.Fatalf("Start returned error: %v", err)
	}
	if !res.Success {
		t.Fatalf("Start: expected success, got: %+v", res)
	}
	if res.ExitCode != 0 {
		t.Fatalf("Start: exit code %d", res.ExitCode)
	}
	joined := strings.Join(res.Log, "\n")
	if !strings.Contains(joined, "launching migration") {
		t.Fatalf("Start: log missing expected output: %q", joined)
	}
	if !strings.Contains(joined, "cut over complete") {
		t.Fatalf("Start: log missing cut over line: %q", joined)
	}
	if res.JobID != "job-1" {
		t.Fatalf("Start: job id %q", res.JobID)
	}
}

func TestStart_FailureCapturesExitAndLog(t *testing.T) {
	body := `#!/bin/sh
echo "attempting migration"
echo "boom: table not found" >&2
exit 42
`
	bin := writeFakeBinary(t, body)
	e := NewGhOstEngine(bin, 0, zap.NewNop())

	cfg := GhOstConfig{Host: "h", User: "u", DBName: "d", Table: "missing", AlterSQL: "A"}
	res, err := e.Start(context.Background(), "job-2", cfg)
	if err != nil {
		t.Fatalf("Start returned hard error: %v", err)
	}
	if res.Success {
		t.Fatal("Start: expected failure for non-zero exit")
	}
	if res.ExitCode != 42 {
		t.Fatalf("Start: exit code %d, want 42", res.ExitCode)
	}
	joined := strings.Join(res.Log, "\n")
	if !strings.Contains(joined, "boom: table not found") {
		t.Fatalf("Start: log missing stderr: %q", joined)
	}
}

func TestStart_ContextCancelStops(t *testing.T) {
	// A shell script that sleeps long enough that cancellation fires.
	body := "#!/bin/sh\necho starting\nsleep 30\necho never\n"
	bin := writeFakeBinary(t, body)
	e := NewGhOstEngine(bin, 0, zap.NewNop())

	cfg := GhOstConfig{Host: "h", User: "u", DBName: "d", Table: "t", AlterSQL: "A"}
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	start := time.Now()
	_, err := e.Start(ctx, "job-3", cfg)
	elapsed := time.Since(start)

	// The command should have been killed by the context, not run to
	// completion (30s sleep). Allow generous margin for slow CI.
	if elapsed > 5*time.Second {
		t.Fatalf("Start did not honour context cancel; waited %v", elapsed)
	}
	if err != nil && !strings.Contains(err.Error(), "start gh-ost") {
		// err may be nil; the failure is captured in result.
	}
}

func TestStart_MissingBinaryReturnsClearError(t *testing.T) {
	e := NewGhOstEngine("/definitely/not/gh-ost", 0, zap.NewNop())
	cfg := GhOstConfig{Host: "h", User: "u", DBName: "d", Table: "t", AlterSQL: "A"}
	_, err := e.Start(context.Background(), "job-x", cfg)
	if err == nil {
		t.Fatal("expected error when gh-ost is missing")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Fatalf("Start error should mention missing binary: %v", err)
	}
}

func TestStart_ValidationGates(t *testing.T) {
	e := newTestEngine(t, "")
	cfg := GhOstConfig{Host: "h", User: "u", DBName: "d", Table: "", AlterSQL: "A"}
	if _, err := e.Start(context.Background(), "job", cfg); err == nil {
		t.Fatal("Start should reject empty table")
	}
	cfg.Table = "t"
	cfg.AlterSQL = ""
	if _, err := e.Start(context.Background(), "job", cfg); err == nil {
		t.Fatal("Start should reject empty alter_sql")
	}
}

func TestStop_UnregisteredJob(t *testing.T) {
	e := newTestEngine(t, "")
	err := e.Stop(context.Background(), "nope")
	if err == nil {
		t.Fatal("Stop should error for unknown job")
	}
	if !strings.Contains(err.Error(), "no running gh-ost process") {
		t.Fatalf("Stop error message: %v", err)
	}
}

func TestStop_ActiveJob(t *testing.T) {
	body := "#!/bin/sh\necho running\nsleep 30\necho done\n"
	bin := writeFakeBinary(t, body)
	e := NewGhOstEngine(bin, 0, zap.NewNop())

	cfg := GhOstConfig{Host: "h", User: "u", DBName: "d", Table: "t", AlterSQL: "A"}
	done := make(chan struct{})
	var res *GhOstResult
	go func() {
		defer close(done)
		res, _ = e.Start(context.Background(), "job-stop", cfg)
	}()

	// Wait until the job is registered.
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) && !e.IsRunning("job-stop") {
		time.Sleep(10 * time.Millisecond)
	}
	if !e.IsRunning("job-stop") {
		t.Fatal("job never registered; cannot test Stop")
	}
	if err := e.Stop(context.Background(), "job-stop"); err != nil {
		t.Fatalf("Stop: %v", err)
	}
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Start did not return after Stop")
	}
	if res.Success {
		t.Fatal("cancelled job should not report success")
	}
}

func TestStatus_FromHTTPAPI(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/status" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"Running":       true,
			"Completed":     false,
			"Error":         false,
			"total_rows":    1000,
			"rows_copied":   500,
			"lag":           123,
			"current_schema": "app",
			"current_table": "orders",
		})
	}))
	defer server.Close()

	// Extract host/port from the httptest URL.
	port := server.URL[strings.LastIndex(server.URL, ":")+1:]

	e := NewGhOstEngine("/tmp/gh-ost", 0, zap.NewNop())
	// We can't easily re-target Status()'s host; hit the HTTP path via
	// fetchStatus directly to avoid a localhost assumption.
	st, err := fetchStatus(context.Background(), e.httpClient, server.URL+"/api/status")
	if err != nil {
		t.Fatalf("fetchStatus: %v", err)
	}
	if !st.Running {
		t.Fatal("status.Running should be true")
	}
	if st.Lag == nil || *st.Lag != 123 {
		t.Fatalf("lag = %v want 123", st.Lag)
	}
	if st.RowsCopied == nil || *st.RowsCopied != 500 {
		t.Fatalf("rows_copied = %v want 500", st.RowsCopied)
	}
	_ = port
}

func TestStatus_InvalidPortReturnsError(t *testing.T) {
	e := NewGhOstEngine("/tmp/gh-ost", 0, zap.NewNop())
	_, err := e.Status(context.Background(), 0)
	if err == nil {
		t.Fatal("Status should error when web port not configured")
	}
}

func TestStatus_404FromAPI(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()
	e := NewGhOstEngine("/tmp/gh-ost", 0, zap.NewNop())
	_, err := fetchStatus(context.Background(), e.httpClient, server.URL+"/api/status")
	if err == nil || !strings.Contains(err.Error(), "http 404") {
		t.Fatalf("expected 404 error, got %v", err)
	}
}

func TestFormatStatusLine(t *testing.T) {
	st := &GhOstStatus{Running: true}
	total := int64(1000)
	copied := int64(500)
	lag := int64(42)
	st.TotalRows = &total
	st.RowsCopied = &copied
	st.Lag = &lag
	line := formatStatusLine(st)
	if !strings.Contains(line, "running=true") || !strings.Contains(line, "lag=42ms") {
		t.Fatalf("formatStatusLine missing fields: %q", line)
	}
}

func TestLogBuffer_Bounded(t *testing.T) {
	b := newLogBuffer()
	for i := 0; i < maxLogLines+50; i++ {
		b.append(fmt.Sprintf("line-%d", i))
	}
	snap := b.snapshot()
	if len(snap) > maxLogLines {
		t.Fatalf("logBuffer overflowed: got %d want <= %d", len(snap), maxLogLines)
	}
}

func TestTruncateErr_CapsLength(t *testing.T) {
	long := strings.Repeat("x", 5000)
	err := fmt.Errorf("%s", long)
	out := truncateErr(err)
	if len(out) > 2100 {
		t.Fatalf("truncateErr should cap length, got %d", len(out))
	}
}

func TestStreamLogs_AggregatesLines(t *testing.T) {
	buf := newLogBuffer()
	src := bytes.NewBufferString("line-1\nline-2\nline-3\n")
	streamLogs(src, buf, zap.NewNop(), "job", nil, context.Background())
	snap := buf.snapshot()
	if len(snap) != 3 {
		t.Fatalf("streamLogs: got %d lines want 3: %v", len(snap), snap)
	}
}

// io.Reader interface adapter — small because we only care about Read.
type ioReader interface{ Read(p []byte) (int, error) }

var _ io.Reader = nil
var _ ioReader = (*bytes.Buffer)(nil)

func containsStr(haystack []string, needle string) bool {
	for _, h := range haystack {
		if h == needle {
			return true
		}
	}
	return false
}

var _ = context.Background // keep imports live if tests are trimmed
