package plugins

import (
	"context"
	"os/exec"
	"syscall"
	"time"

	"orion/platform-svc-go/internal/auto-exec/interfaces"
	"orion/platform-svc-go/internal/auto-exec/models"
)

// PluginTypeShell is the shell executor plugin type.
const PluginTypeShell = "shell"

// ShellExecutorPlugin runs shell commands.
type ShellExecutorPlugin struct{}

func (p *ShellExecutorPlugin) Name() string                { return PluginTypeShell }
func (p *ShellExecutorPlugin) Description() string         { return "Execute shell commands" }
func (p *ShellExecutorPlugin) DefaultTimeout() time.Duration { return 5 * time.Minute }
func (p *ShellExecutorPlugin) Validate(params map[string]interface{}) error {
	_, ok := params["command"].(string)
	if !ok {
		return interfaces.ErrInvalidParams
	}
	return nil
}

func (p *ShellExecutorPlugin) Execute(ctx context.Context, params map[string]interface{}) (*models.PluginResult, error) {
	cmdStr, _ := params["command"].(string)
	cmd := exec.CommandContext(ctx, "/bin/sh", "-c", cmdStr)
	start := time.Now()
	output, err := cmd.CombinedOutput()
	dur := time.Since(start)
	return &models.PluginResult{
		ExitCode:   cmd.ProcessState.ExitCode(),
		Stdout:     string(output),
		DurationMs: dur.Milliseconds(),
		Error:      err,
	}, nil
}

// PluginTypePython is the python executor plugin type.
const PluginTypePython = "python"

// PythonExecutorPlugin runs Python scripts.
type PythonExecutorPlugin struct{}

func (p *PythonExecutorPlugin) Name() string                { return PluginTypePython }
func (p *PythonExecutorPlugin) Description() string         { return "Execute Python scripts" }
func (p *PythonExecutorPlugin) DefaultTimeout() time.Duration { return 10 * time.Minute }
func (p *PythonExecutorPlugin) Validate(params map[string]interface{}) error {
	_, ok := params["script"].(string)
	if !ok {
		return interfaces.ErrInvalidParams
	}
	return nil
}
func (p *PythonExecutorPlugin) Execute(ctx context.Context, params map[string]interface{}) (*models.PluginResult, error) {
	script, _ := params["script"].(string)
	cmd := exec.CommandContext(ctx, "python3", "-c", script)
	start := time.Now()
	output, err := cmd.CombinedOutput()
	dur := time.Since(start)
	return &models.PluginResult{
		ExitCode:   cmd.ProcessState.ExitCode(),
		Stdout:     string(output),
		DurationMs: dur.Milliseconds(),
		Error:      err,
	}, nil
}

// PluginTypeHTTP is the http executor plugin type.
const PluginTypeHTTP = "http"

// HTTPExecutorPlugin executes HTTP requests.
type HTTPExecutorPlugin struct{}

func (p *HTTPExecutorPlugin) Name() string                { return PluginTypeHTTP }
func (p *HTTPExecutorPlugin) Description() string         { return "Execute HTTP requests" }
func (p *HTTPExecutorPlugin) DefaultTimeout() time.Duration { return 30 * time.Second }
func (p *HTTPExecutorPlugin) Validate(params map[string]interface{}) error {
	_, ok := params["url"].(string)
	if !ok {
		return interfaces.ErrInvalidParams
	}
	return nil
}
func (p *HTTPExecutorPlugin) Execute(ctx context.Context, params map[string]interface{}) (*models.PluginResult, error) {
	return &models.PluginResult{Stdout: "HTTP plugin (stub)"}, nil
}

// PluginTypeSQL is the sql executor plugin type.
const PluginTypeSQL = "sql"

// SQLEXecutorPlugin executes SQL queries.
type SQLEXecutorPlugin struct{}

func (p *SQLEXecutorPlugin) Name() string                { return PluginTypeSQL }
func (p *SQLEXecutorPlugin) Description() string         { return "Execute SQL queries" }
func (p *SQLEXecutorPlugin) DefaultTimeout() time.Duration { return 1 * time.Minute }
func (p *SQLEXecutorPlugin) Validate(params map[string]interface{}) error {
	_, ok := params["query"].(string)
	if !ok {
		return interfaces.ErrInvalidParams
	}
	return nil
}
func (p *SQLEXecutorPlugin) Execute(ctx context.Context, params map[string]interface{}) (*models.PluginResult, error) {
	return &models.PluginResult{Stdout: "SQL plugin (stub)"}, nil
}

// PluginTypeWebhook is the webhook executor plugin type.
const PluginTypeWebhook = "webhook"

// WebhookExecutorPlugin executes webhook callbacks.
type WebhookExecutorPlugin struct{}

func (p *WebhookExecutorPlugin) Name() string                { return PluginTypeWebhook }
func (p *WebhookExecutorPlugin) Description() string         { return "Execute webhook callbacks" }
func (p *WebhookExecutorPlugin) DefaultTimeout() time.Duration { return 30 * time.Second }
func (p *WebhookExecutorPlugin) Validate(params map[string]interface{}) error {
	_, ok := params["url"].(string)
	if !ok {
		return interfaces.ErrInvalidParams
	}
	return nil
}
func (p *WebhookExecutorPlugin) Execute(ctx context.Context, params map[string]interface{}) (*models.PluginResult, error) {
	return &models.PluginResult{Stdout: "Webhook plugin (stub)"}, nil
}

// NewShellPlugin creates a shell executor plugin.
func NewShellPlugin() interfaces.ExecutorPlugin { return &ShellExecutorPlugin{} }

// NewPythonPlugin creates a python executor plugin.
func NewPythonPlugin() interfaces.ExecutorPlugin { return &PythonExecutorPlugin{} }

// NewHTTPPlugin creates an HTTP executor plugin.
func NewHTTPPlugin() interfaces.ExecutorPlugin { return &HTTPExecutorPlugin{} }

// NewSQLPlugin creates an SQL executor plugin.
func NewSQLPlugin() interfaces.ExecutorPlugin { return &SQLEXecutorPlugin{} }

// NewWebhookPlugin creates a webhook executor plugin.
func NewWebhookPlugin() interfaces.ExecutorPlugin { return &WebhookExecutorPlugin{} }
