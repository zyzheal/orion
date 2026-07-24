package plugin

// =============================================================================
// ExecutionState — the lifecycle states of a plugin execution
// =============================================================================

// ExecutionState describes the current state of a plugin execution.
type ExecutionState string

const (
	StatePending   ExecutionState = "pending"
	StateRunning   ExecutionState = "running"
	StateCompleted ExecutionState = "completed"
	StateFailed    ExecutionState = "failed"
	StateKilled    ExecutionState = "killed"
	StateTimedOut  ExecutionState = "timed_out"
)

// =============================================================================
// ExecutionFilter — used to query execution history
// =============================================================================

type ExecutionFilter struct {
	TenantID string        `json:"tenant_id,omitempty"`
	PluginID string        `json:"plugin_id,omitempty"`
	TaskID   string        `json:"task_id,omitempty"`
	State    ExecutionState `json:"state,omitempty"`
	Limit    int           `json:"limit,omitempty"`
	Offset   int           `json:"offset,omitempty"`
}

// =============================================================================
// ResourceQuota — resource limits for a plugin or tenant
// =============================================================================

type ResourceQuota struct {
	CPUCores     int   `json:"cpu_cores"`
	MemoryBytes  int64 `json:"memory_bytes"`
	TimeoutMs    int   `json:"timeout_ms"`
	MaxConcurrent int  `json:"max_concurrent"`
}

// =============================================================================
// SecurityEvent — security-relevant events emitted by the plugin system
// =============================================================================

type SecurityEvent struct {
	EventType string `json:"event_type"`
	Severity  string `json:"severity"`
	TaskID    string `json:"task_id,omitempty"`
	PluginID  string `json:"plugin_id,omitempty"`
	TenantID  string `json:"tenant_id,omitempty"`
	Message   string `json:"message,omitempty"`
}