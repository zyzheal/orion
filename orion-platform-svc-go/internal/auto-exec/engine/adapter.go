package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/auto-exec/interfaces"
	"orion/platform-svc-go/internal/auto-exec/models"
)

// executorPluginAdapter wraps an interfaces.ExecutorPlugin to satisfy
// the engine's PluginHandler SPI.  This bridges the factory registry
// (which stores ExecutorPlugin) with the engine (which dispatches via
// PluginHandler).
type executorPluginAdapter struct {
	plugin interfaces.ExecutorPlugin
}

// Name returns the plugin identifier used for dispatch.
func (a *executorPluginAdapter) Name() string {
	return a.plugin.Name()
}

// Category maps the plugin type to a semantic category.
func (a *executorPluginAdapter) Category() string {
	name := a.plugin.Name()
	switch name {
	case "shell":
		return "process"
	case "python":
		return "process"
	case "http":
		return "network"
	case "sql":
		return "database"
	case "webhook":
		return "integration"
	default:
		return "custom"
	}
}

// Execute adapts the ExecutorPlugin signature to the PluginHandler signature.
// Converts map[string]string → map[string]interface{}, discards the task
// pointer (ExecutorPlugin does not need it), and wraps the result as a
// string.
func (a *executorPluginAdapter) Execute(ctx context.Context, params map[string]string, task *models.ExecutionTask) (string, error) {
	conv := make(map[string]interface{}, len(params))
	for k, v := range params {
		conv[k] = v
	}

	// Apply plugin's own timeout if the caller context has none
	if task != nil && task.Timeout > 0 {
		if _, ok := ctx.Deadline(); !ok {
			c, cancel := context.WithTimeout(ctx, time.Duration(task.Timeout)*time.Second)
			defer cancel()
			ctx = c
		}
	}

	result, err := a.plugin.Execute(ctx, conv)
	if err != nil {
		return "", fmt.Errorf("plugin %q execution failed: %w", a.plugin.Name(), err)
	}
	if result == nil {
		return "", nil
	}
	// Build result string from plugin output: stdout + stderr + error message.
	var resultStr strings.Builder
	if result.Stdout != "" {
		resultStr.WriteString(result.Stdout)
	}
	if result.Stderr != "" {
		if resultStr.Len() > 0 {
			resultStr.WriteString("\n")
		}
		resultStr.WriteString(result.Stderr)
	}
	if result.ErrorMessage != "" {
		if resultStr.Len() > 0 {
			resultStr.WriteString("\n")
		}
		resultStr.WriteString("error: " + result.ErrorMessage)
	}
	if result.Output != nil {
		if resultStr.Len() > 0 {
			resultStr.WriteString("\n")
		}
		if b, jerr := json.Marshal(result.Output); jerr == nil {
			resultStr.WriteString(string(b))
		}
	}
	return resultStr.String(), nil
}

// Validate adapts the ExecutorPlugin Validate call.
func (a *executorPluginAdapter) Validate(ctx context.Context, params map[string]string) error {
	conv := make(map[string]interface{}, len(params))
	for k, v := range params {
		conv[k] = v
	}
	return a.plugin.Validate(conv)
}

// RegisterExecutorPlugin registers an interfaces.ExecutorPlugin into the engine
// by wrapping it with an adapter that satisfies the PluginHandler SPI.
func (e *AutoExecEngine) RegisterExecutorPlugin(p interfaces.ExecutorPlugin) {
	e.RegisterPlugin(&executorPluginAdapter{plugin: p})
}
