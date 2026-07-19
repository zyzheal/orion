// Package plugin defines the SPI (Service Provider Interface) for the Orion
// plugin system.  Every plugin type must implement the Plugin interface; the
// framework provides lifecycle management, sub-process execution, and
// resource-governed sandboxing.
//
// This package lives in go-common so that both the platform service and
// individual plugin binaries can import it without circular dependencies.
package plugin

import "context"

// =============================================================================
// Plugin — the core SPI contract
// =============================================================================

// Plugin is the interface every plugin must implement.
type Plugin interface {
	// Init is called once when the plugin is loaded.  The implementation should
	// parse its Config, open connections, etc.  Returning an error causes the
	// framework to mark the plugin as unhealthy and skip it for execution.
	Init(ctx context.Context, cfg PluginConfig) error

	// Execute runs the plugin against the given context and input.  The
	// implementation MUST be idempotent where possible — the framework may
	// retry on transient failures.
	Execute(ctx context.Context, pctx PluginContext, input map[string]interface{}) (*ExecuteResult, error)

	// Shutdown is called when the plugin is being unloaded or the host is
	// shutting down.  Implementations should close connections, flush buffers,
	// and release resources.  The context has a short deadline.
	Shutdown(ctx context.Context) error

	// Health returns a health check result.  Returning nil means healthy;
	// returning an error means the plugin is degraded or unavailable.
	Health(ctx context.Context) error
}

// =============================================================================
// PluginConfig — static configuration supplied at install time
// =============================================================================

// PluginConfig carries the static configuration for a plugin instance.
type PluginConfig struct {
	// ID is the unique plugin identifier (e.g. "slack-notifier").
	ID string `json:"id"`

	// Version is the semantic version of the plugin.
	Version string `json:"version"`

	// Entrypoint is the path to the plugin binary (for sub-process plugins)
	// or the Go plugin .so file (for Go plugin.Open() plugins).
	Entrypoint string `json:"entrypoint,omitempty"`

	// Settings is the free-form configuration map supplied at install time.
	Settings map[string]interface{} `json:"settings,omitempty"`

	// TimeoutMs is the maximum execution time in milliseconds.  Zero means
	// the host default applies.
	TimeoutMs int `json:"timeout_ms,omitempty"`

	// MaxConcurrency is the maximum number of concurrent executions for
	// this plugin.  Zero means the host default applies.
	MaxConcurrency int `json:"max_concurrency,omitempty"`
}

// =============================================================================
// PluginContext — per-execution context
// =============================================================================

// PluginContext provides per-execution metadata and capabilities.
type PluginContext struct {
	// TaskID uniquely identifies the execution task.
	TaskID string `json:"task_id"`

	// PipelineRunID is the pipeline run that triggered this execution
	// (empty for standalone executions).
	PipelineRunID string `json:"pipeline_run_id,omitempty"`

	// StageID is the pipeline stage that triggered this execution
	// (empty for standalone executions).
	StageID string `json:"stage_id,omitempty"`

	// TenantID is the tenant that owns this execution.
	TenantID string `json:"tenant_id"`

	// Config is the resolved configuration (PluginConfig.Settings merged
	// with tenant-level overrides).
	Config map[string]interface{} `json:"config,omitempty"`
}

// =============================================================================
// ExecuteResult — the output of a single Execute call
// =============================================================================

// ExecuteResult is the structured output of a plugin execution.
type ExecuteResult struct {
	// Success indicates whether the plugin completed its work successfully.
	Success bool `json:"success"`

	// ExitCode is the process exit code (for sub-process plugins).
	ExitCode int `json:"exit_code,omitempty"`

	// Stdout is the standard output captured from the plugin (for
	// sub-process plugins).
	Stdout string `json:"stdout,omitempty"`

	// Stderr is the standard error captured from the plugin (for
	// sub-process plugins).
	Stderr string `json:"stderr,omitempty"`

	// Output is the structured output data returned by the plugin.
	Output map[string]interface{} `json:"output,omitempty"`

	// ErrorMessage describes the failure when Success is false.
	ErrorMessage string `json:"error_message,omitempty"`

	// DurationMs is the wall-clock execution time in milliseconds.
	DurationMs int `json:"duration_ms,omitempty"`
}

// =============================================================================
// PluginInfo — metadata returned by the host about a loaded plugin
// =============================================================================

// PluginInfo exposes runtime information about a loaded plugin.
type PluginInfo struct {
	ID       string `json:"id"`
	Version  string `json:"version"`
	Healthy  bool   `json:"healthy"`
	Running  int    `json:"running"`
	Executed int    `json:"executed"`
	Failed   int    `json:"failed"`
}