// Package interfaces defines the Executor and ExecutorPlugin SPI.
//
// Executor — the orchestrator that manages job lifecycle (state machine, retry,
// timeout, cancellation, and result persistence).
//
// ExecutorPlugin — the SPI that execution plugins implement.  The factory
// dispatches jobs to the appropriate plugin by job.Type, and the plugin
// performs the actual work (shell, Python, HTTP, SQL, webhook).
package interfaces

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/auto-exec/models"
)

// =============================================================================
// Executor — orchestrator interface
// =============================================================================

// Executor manages the full lifecycle of an execution job: submission, state
// transitions (pending -> running -> completed/failed/cancelled), timeout,
// retry, cancellation, and result retrieval.
type Executor interface {
	// Execute submits a job for execution and blocks until completion, failure,
	// timeout, or cancellation.  The job's state is updated in the repository.
	Execute(ctx context.Context, job *models.Job) (*models.Result, error)

	// Cancel cancels a pending or running job.  The job's status transitions to
	// "cancelled".
	Cancel(ctx context.Context, jobID string) error

	// Status returns the current job status and metadata.
	Status(ctx context.Context, jobID string) (*models.Job, error)
}

// =============================================================================
// ExecutorPlugin — the SPI every execution plugin must implement
// =============================================================================

// ExecutorPlugin is the service-provider interface for execution plugins.
// Each plugin targets one execution type (shell, python, http, sql, webhook).
//
// Plugins are registered at startup via the ExecutorFactory and must be
// thread-safe: Execute may be called concurrently.
type ExecutorPlugin interface {
	// Name returns the plugin identifier used for dispatch (e.g. "shell").
	Name() string

	// Description returns a human-readable description.
	Description() string

	// Execute runs the plugin against the given parameters.  The context carries
	// the job's timeout and cancellation signal.
	//   - params["command"] / params["url"] / etc. are plugin-specific.
	//   - params["inputs"] contains runtime user inputs merged into the command.
	Execute(ctx context.Context, params map[string]interface{}) (*models.Result, error)

	// Validate checks that the provided parameters are sufficient and well-formed
	// for this plugin.  Returning an error prevents the job from being queued.
	Validate(params map[string]interface{}) error

	// DefaultTimeout returns the timeout the plugin requests when the caller
	// does not specify one.  Zero means no timeout (not recommended).
	DefaultTimeout() time.Duration
}

// =============================================================================
// Registry — plugin registration and lookup
// =============================================================================

// Registry provides thread-safe registration and lookup of ExecutorPlugins.
type Registry interface {
	Register(plugin ExecutorPlugin) error
	Unregister(name string)
	Get(name string) (ExecutorPlugin, bool)
	All() []ExecutorPlugin
	Metadata() []models.PluginMetadata
}
