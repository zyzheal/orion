package plugins

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"strings"
	"time"

	"orion/platform-svc-go/internal/auto-exec/interfaces"
	"orion/platform-svc-go/internal/auto-exec/models"
)

// maxHTTPResponseBytes caps how much of an HTTP response body is captured.
// An unbounded ReadAll on an attacker-controlled endpoint would let a single
// task pin arbitrary memory in the platform process.
const maxHTTPResponseBytes = 1 << 20 // 1 MiB

// maxDiagOutput bounds the command output embedded in an error. AutoExecEngine
// stores this string in the task's error column, so unbounded output would bloat
// the database row.
const maxDiagOutput = 1024

// ProcessExitError is returned by the process plugins when a command exits
// non-zero. AutoExecEngine stores this string as the task's error, so it
// carries the exit code and the tail of stderr for diagnosis.
type ProcessExitError struct {
	ExitCode int
	Output   string
}

func (e *ProcessExitError) Error() string {
	out := tail(strings.TrimSpace(e.Output), maxDiagOutput)
	if out == "" {
		return fmt.Sprintf("command exited with code %d", e.ExitCode)
	}
	return fmt.Sprintf("command exited with code %d: %s", e.ExitCode, out)
}

// runProcess runs one command and reports a failure for any non-zero exit.
//
// The result is returned alongside the error so stdout/stderr survive for
// debugging; AutoExecEngine keys the task status off the error alone.
func runProcess(ctx context.Context, name string, args ...string) (*models.Result, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr

	start := time.Now()
	runErr := cmd.Run()
	dur := time.Since(start)

	result := &models.Result{
		Stdout:     stdout.String(),
		Stderr:     stderr.String(),
		DurationMs: dur.Milliseconds(),
	}
	// ProcessState is nil when the process never started (missing binary,
	// permission denied); calling ExitCode() there panics.
	if cmd.ProcessState != nil {
		result.ExitCode = cmd.ProcessState.ExitCode()
	}
	if runErr != nil {
		result.ErrorMessage = runErr.Error()
	}

	var exitErr *exec.ExitError
	if errors.As(runErr, &exitErr) {
		return result, &ProcessExitError{ExitCode: result.ExitCode, Output: stderr.String()}
	}
	if runErr != nil {
		return result, fmt.Errorf("failed to start %s: %w", name, runErr)
	}
	return result, nil
}

// tail keeps the last n characters of s.
func tail(s string, n int) string {
	if n <= 0 || len(s) <= n {
		return s
	}
	return s[len(s)-n:]
}

// PluginTypeShell is the shell executor plugin type.
const PluginTypeShell = "shell"

// ShellExecutorPlugin runs shell commands.
type ShellExecutorPlugin struct{}

func (p *ShellExecutorPlugin) Name() string                  { return PluginTypeShell }
func (p *ShellExecutorPlugin) Description() string           { return "Execute shell commands" }
func (p *ShellExecutorPlugin) DefaultTimeout() time.Duration { return 5 * time.Minute }
func (p *ShellExecutorPlugin) Validate(params map[string]interface{}) error {
	_, ok := params["command"].(string)
	if !ok {
		return interfaces.ErrInvalidParams
	}
	return nil
}

func (p *ShellExecutorPlugin) Execute(ctx context.Context, params map[string]interface{}) (*models.Result, error) {
	cmdStr, _ := params["command"].(string)
	return runProcess(ctx, "/bin/sh", "-c", cmdStr)
}

// PluginTypePython is the python executor plugin type.
const PluginTypePython = "python"

// PythonExecutorPlugin runs Python scripts.
type PythonExecutorPlugin struct{}

func (p *PythonExecutorPlugin) Name() string                  { return PluginTypePython }
func (p *PythonExecutorPlugin) Description() string           { return "Execute Python scripts" }
func (p *PythonExecutorPlugin) DefaultTimeout() time.Duration { return 10 * time.Minute }
func (p *PythonExecutorPlugin) Validate(params map[string]interface{}) error {
	_, ok := params["script"].(string)
	if !ok {
		return interfaces.ErrInvalidParams
	}
	return nil
}
func (p *PythonExecutorPlugin) Execute(ctx context.Context, params map[string]interface{}) (*models.Result, error) {
	script, _ := params["script"].(string)
	return runProcess(ctx, "python3", "-c", script)
}

// PluginTypeHTTP is the http executor plugin type.
const PluginTypeHTTP = "http"

// HTTPExecutorPlugin executes HTTP requests.
type HTTPExecutorPlugin struct{}

// Parameters:
//   - "url"      (string, required)
//   - "method"   (string, optional; default GET)
//   - "headers"  (map[string]interface{}, optional)
//   - "body"     (string, optional)
func (p *HTTPExecutorPlugin) Name() string                  { return PluginTypeHTTP }
func (p *HTTPExecutorPlugin) Description() string           { return "Execute HTTP requests" }
func (p *HTTPExecutorPlugin) DefaultTimeout() time.Duration { return 30 * time.Second }
func (p *HTTPExecutorPlugin) Validate(params map[string]interface{}) error {
	url, ok := params["url"].(string)
	if !ok || url == "" {
		return interfaces.ErrInvalidParams
	}
	return nil
}
func (p *HTTPExecutorPlugin) Execute(ctx context.Context, params map[string]interface{}) (*models.Result, error) {
	return executeHTTPRequest(ctx, params, http.MethodGet, &http.Client{Timeout: p.DefaultTimeout()})
}

// PluginTypeWebhook is the webhook executor plugin type.
const PluginTypeWebhook = "webhook"

// WebhookExecutorPlugin executes webhook callbacks. Same parameters as
// HTTPExecutorPlugin, but the default method is POST.
type WebhookExecutorPlugin struct{}

func (p *WebhookExecutorPlugin) Name() string                  { return PluginTypeWebhook }
func (p *WebhookExecutorPlugin) Description() string           { return "Execute webhook callbacks" }
func (p *WebhookExecutorPlugin) DefaultTimeout() time.Duration { return 30 * time.Second }
func (p *WebhookExecutorPlugin) Validate(params map[string]interface{}) error {
	url, ok := params["url"].(string)
	if !ok || url == "" {
		return interfaces.ErrInvalidParams
	}
	return nil
}
func (p *WebhookExecutorPlugin) Execute(ctx context.Context, params map[string]interface{}) (*models.Result, error) {
	return executeHTTPRequest(ctx, params, http.MethodPost, &http.Client{Timeout: p.DefaultTimeout()})
}

// executeHTTPRequest performs a real HTTP request and reports the response.
//
// It was previously "return Stdout: HTTP plugin (stub)" — the plugin was
// registered at startup and advertised by the API, but a task that used it
// printed nothing, exited 0, and was recorded as completed. Non-2xx responses
// now fail the task: recording a 500 as completed is how a broken integration
// ends up looking green in the task history.
func executeHTTPRequest(ctx context.Context, params map[string]interface{}, defaultMethod string, client *http.Client) (*models.Result, error) {
	url, _ := params["url"].(string)

	method := defaultMethod
	if m, ok := params["method"].(string); ok && m != "" {
		method = strings.ToUpper(m)
	}

	var body io.Reader
	if b, ok := params["body"].(string); ok {
		body = strings.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, fmt.Errorf("http request build failed: %w", err)
	}
	req.Header.Set("User-Agent", "orion-auto-exec/1.0")
	if hdrs, ok := params["headers"].(map[string]interface{}); ok {
		for k, v := range hdrs {
			if s, ok := v.(string); ok {
				req.Header.Set(k, s)
			}
		}
	}

	start := time.Now()
	resp, err := client.Do(req)
	dur := time.Since(start)
	if err != nil {
		return &models.Result{
			DurationMs:   dur.Milliseconds(),
			ErrorMessage: err.Error(),
		}, fmt.Errorf("http %s %s failed: %w", method, url, err)
	}
	defer resp.Body.Close()

	bodyBytes, rerr := io.ReadAll(io.LimitReader(resp.Body, maxHTTPResponseBytes))

	result := &models.Result{
		Stdout:     string(bodyBytes),
		DurationMs: dur.Milliseconds(),
		Output: map[string]interface{}{
			"status_code": resp.StatusCode,
			"status":      resp.Status,
			"method":      method,
			"url":         url,
		},
	}
	if rerr != nil {
		result.ErrorMessage = rerr.Error()
		return result, fmt.Errorf("reading http response from %s failed: %w", url, rerr)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := fmt.Sprintf("http %s %s returned %s", method, url, resp.Status)
		result.ExitCode = 1
		result.ErrorMessage = msg
		return result, errors.New(msg)
	}
	return result, nil
}

// NewShellPlugin creates a shell executor plugin.
func NewShellPlugin() interfaces.ExecutorPlugin { return &ShellExecutorPlugin{} }

// NewPythonPlugin creates a python executor plugin.
func NewPythonPlugin() interfaces.ExecutorPlugin { return &PythonExecutorPlugin{} }

// NewHTTPPlugin creates an HTTP executor plugin.
func NewHTTPPlugin() interfaces.ExecutorPlugin { return &HTTPExecutorPlugin{} }

// NewWebhookPlugin creates a webhook executor plugin.
func NewWebhookPlugin() interfaces.ExecutorPlugin { return &WebhookExecutorPlugin{} }

// Note: there is deliberately no SQL executor plugin. The type was registered
// at startup and advertised by the plugin API, but Execute returned a constant
// "(stub)" string and exit code 0. Rewiring it properly would mean handing an
// arbitrary-SQL executor the platform's own primary database connection, which
// is a separate and riskier feature than closing a stub, so the plugin was
// removed rather than shipped as a placeholder.
