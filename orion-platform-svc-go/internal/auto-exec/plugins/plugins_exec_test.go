package plugins

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"strings"
	"sync/atomic"
	"testing"
)

// A non-zero exit is a failed task. It used to come back as a nil error with
// the failure parked in ErrorMessage, which the engine read as success, so a
// broken CI step was recorded as completed.
func TestShellExecutorPluginFailsOnNonZeroExit(t *testing.T) {
	res, err := NewShellPlugin().Execute(context.Background(), map[string]interface{}{
		"command": "echo out-before; echo err-out >&2; exit 3",
	})
	if err == nil {
		t.Fatalf("expected error for exit code 3, got nil; result=%+v", res)
	}
	if res == nil {
		t.Fatalf("expected the result to survive for diagnostics, got nil")
	}
	if res.ExitCode != 3 {
		t.Fatalf("ExitCode = %d, want 3", res.ExitCode)
	}
	if !strings.Contains(res.Stdout, "out-before") {
		t.Fatalf("stdout = %q, want it to contain the command output", res.Stdout)
	}
	if !strings.Contains(res.Stderr, "err-out") {
		t.Fatalf("stderr = %q, want it to contain the command output", res.Stderr)
	}
	if !strings.Contains(err.Error(), "code 3") {
		t.Fatalf("error = %q, want it to name the exit code", err.Error())
	}
}

func TestShellExecutorPluginSucceedsOnZeroExit(t *testing.T) {
	res, err := NewShellPlugin().Execute(context.Background(), map[string]interface{}{
		"command": "echo ok",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.ExitCode != 0 {
		t.Fatalf("ExitCode = %d, want 0", res.ExitCode)
	}
	if !strings.Contains(res.Stdout, "ok") {
		t.Fatalf("stdout = %q, want it to contain the command output", res.Stdout)
	}
}

// ProcessState is nil when the binary never starts at all; calling
// ExitCode() on it panics, which would take the platform process down. This is
// a different failure mode from a non-zero exit, so it gets its own test.
func TestRunProcessMissingBinaryDoesNotPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("runProcess panicked on a missing binary: %v", r)
		}
	}()

	res, err := runProcess(context.Background(), "/nonexistent/orion-test-binary", "--flag")
	if err == nil {
		t.Fatal("expected an error when the binary cannot be started")
	}
	if res == nil {
		t.Fatal("expected a result, got nil")
	}
	if res.ExitCode != 0 {
		t.Fatalf("ExitCode = %d, want 0 for a process that never started", res.ExitCode)
	}
}

func TestPythonExecutorPluginFailsOnNonZeroExit(t *testing.T) {
	if _, perr := exec.LookPath("python3"); perr != nil {
		t.Skip("python3 not available: " + perr.Error())
	}
	res, err := NewPythonPlugin().Execute(context.Background(), map[string]interface{}{
		"script": "import sys; print('pout'); print('perr', file=sys.stderr); sys.exit(5)",
	})
	if err == nil {
		t.Fatalf("expected error for exit code 5, got nil; result=%+v", res)
	}
	if res == nil {
		t.Fatalf("expected the result to survive for diagnostics, got nil")
	}
	if res.ExitCode != 5 {
		t.Fatalf("ExitCode = %d, want 5", res.ExitCode)
	}
	if !strings.Contains(res.Stdout, "pout") {
		t.Fatalf("stdout = %q, want it to contain the script output", res.Stdout)
	}
}

// The HTTP plugin used to return "HTTP plugin (stub)" and exit 0 without
// touching the network. Both directions must now be real.
func TestHTTPExecutorPluginRealRequest(t *testing.T) {
	var hits int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
		if r.Header.Get("X-Test") != "yes" {
			t.Errorf("header X-Test = %q, want yes", r.Header.Get("X-Test"))
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	res, err := NewHTTPPlugin().Execute(context.Background(), map[string]interface{}{
		"url":     srv.URL,
		"headers": map[string]interface{}{"X-Test": "yes"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if atomic.LoadInt32(&hits) != 1 {
		t.Fatalf("server hits = %d, want 1: the plugin did not perform an HTTP request", hits)
	}
	if res.ExitCode != 0 {
		t.Fatalf("ExitCode = %d, want 0", res.ExitCode)
	}
	if res.Stdout == "HTTP plugin (stub)" {
		t.Fatal("stdout is still the stub sentinel")
	}
	if res.Output["status_code"] != http.StatusNoContent {
		t.Fatalf("status_code = %v, want %d", res.Output["status_code"], http.StatusNoContent)
	}
}

func TestHTTPExecutorPluginFailsOnNon2xx(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer srv.Close()

	res, err := NewHTTPPlugin().Execute(context.Background(), map[string]interface{}{"url": srv.URL})
	if err == nil {
		t.Fatalf("expected error for HTTP 500, got nil; result=%+v", res)
	}
	if res == nil {
		t.Fatal("expected a result, got nil")
	}
	if res.ExitCode == 0 {
		t.Fatal("ExitCode = 0: a 500 response must not be recorded as success")
	}
	if !strings.Contains(res.Stderr+res.Stdout, "boom") {
		t.Fatalf("stdout = %q, want the response body", res.Stdout)
	}
}

func TestHTTPExecutorPluginFailsOnUnreachableHost(t *testing.T) {
	res, err := NewHTTPPlugin().Execute(context.Background(), map[string]interface{}{
		"url": "http://127.0.0.1:1/",
	})
	if err == nil {
		t.Fatal("expected an error for an unreachable host")
	}
	if res == nil {
		t.Fatal("expected a result, got nil")
	}
}

// Webhook defaults to POST and rejects a bad status.
func TestWebhookExecutorPluginRealRequest(t *testing.T) {
	var method string
	var gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		method = r.Method
		buf := make([]byte, 256)
		n, _ := r.Body.Read(buf)
		gotBody = string(buf[:n])
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()

	res, err := NewWebhookPlugin().Execute(context.Background(), map[string]interface{}{
		"url":  srv.URL,
		"body": "payload",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if method != http.MethodPost {
		t.Fatalf("method = %q, want POST", method)
	}
	if gotBody != "payload" {
		t.Fatalf("body = %q, want payload", gotBody)
	}
	if res.Stdout == "Webhook plugin (stub)" {
		t.Fatal("stdout is still the stub sentinel")
	}
}

func TestWebhookExecutorPluginFailsOnNon2xx(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer srv.Close()

	_, err := NewWebhookPlugin().Execute(context.Background(), map[string]interface{}{"url": srv.URL})
	if err == nil {
		t.Fatal("expected error for HTTP 403")
	}
}

func TestHTTPExecutorPluginValidatesURL(t *testing.T) {
	plug := NewHTTPPlugin()
	if err := plug.Validate(map[string]interface{}{}); err == nil {
		t.Fatal("expected validation error for a missing url")
	}
	if err := plug.Validate(map[string]interface{}{"url": ""}); err == nil {
		t.Fatal("expected validation error for an empty url")
	}
	if err := plug.Validate(map[string]interface{}{"url": "https://example.com"}); err != nil {
		t.Fatalf("unexpected validation error: %v", err)
	}

	webhook := NewWebhookPlugin()
	if err := webhook.Validate(map[string]interface{}{}); err == nil {
		t.Fatal("expected validation error for a missing url")
	}
	if err := webhook.Validate(map[string]interface{}{"url": "https://example.com"}); err != nil {
		t.Fatalf("unexpected validation error: %v", err)
	}
}
