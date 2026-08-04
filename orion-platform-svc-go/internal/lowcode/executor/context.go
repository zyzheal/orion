package executor

import (
	"sync"
	"time"
)

// NodeStatus tracks the execution state of a single node.
type NodeStatus int

const (
	StatusPending  NodeStatus = iota // not yet started
	StatusRunning                    // currently executing
	StatusDone                       // completed successfully
	StatusFailed                     // execution raised an error
	StatusSkipped                    // skipped due to condition or parent failure
	StatusTimeout                    // timed out
)

func (s NodeStatus) String() string {
	switch s {
	case StatusPending:
		return "PENDING"
	case StatusRunning:
		return "RUNNING"
	case StatusDone:
		return "DONE"
	case StatusFailed:
		return "FAILED"
	case StatusSkipped:
		return "SKIPPED"
	case StatusTimeout:
		return "TIMEOUT"
		default:
		return "UNKNOWN"
	}
}

// NodeRecord holds the runtime state for one node during execution.
type NodeRecord struct {
	NodeID      string      // node identifier
	Status      NodeStatus  // current status
	StartedAt   *time.Time  // when execution began (nil if not started)
	FinishedAt  *time.Time  // when execution completed (nil if not finished)
	Outputs     map[string]interface{} // accumulated outputs
	Error       error       // error if failed
	ErrorNode   string      // upstream node ID that caused failure
	Iteration   int         // current iteration for loop nodes
}

// ExecutionCtx is the mutable runtime context for a DAG execution.
// It holds variables, node statuses, and execution metadata.
type ExecutionCtx struct {
	ID      string            // unique execution ID (UUID)
	DAGName string            // DAG being executed

	varMu   sync.RWMutex       // guards variables
	variables map[string]interface{} // runtime variable store

	statusMu sync.RWMutex       // guards records
	records  map[string]*NodeRecord // per-node execution records

	Errors   []error  // collected errors during execution

	StartTime time.Time
	EndTime   *time.Time

	// Cancelled is set to true when the context is cancelled externally.
	Cancelled bool

	// ErrorCaptures maps node IDs to their captured errors (for error handling).
	ErrorCaptures map[string]error
}

// NewExecutionCtx creates a fresh execution context with the given DAG name.
func NewExecutionCtx(dagName string) *ExecutionCtx {
	return &ExecutionCtx{
		DAGName:       dagName,
		variables:     make(map[string]interface{}),
		records:       make(map[string]*NodeRecord),
		ErrorCaptures: make(map[string]error),
		StartTime:     time.Now(),
	}
}

// --- Variable access (thread-safe) ---

// SetVar stores a variable in the execution context.
func (ctx *ExecutionCtx) SetVar(key string, value interface{}) {
	ctx.varMu.Lock()
	defer ctx.varMu.Unlock()
	ctx.variables[key] = value
}

// GetVar retrieves a variable from the execution context.
func (ctx *ExecutionCtx) GetVar(key string) (interface{}, bool) {
	ctx.varMu.RLock()
	defer ctx.varMu.RUnlock()
	v, ok := ctx.variables[key]
	return v, ok
}

// GetVars returns a copy of all variables.
func (ctx *ExecutionCtx) GetVars() map[string]interface{} {
	ctx.varMu.RLock()
	defer ctx.varMu.RUnlock()
	cp := make(map[string]interface{}, len(ctx.variables))
	for k, v := range ctx.variables {
		cp[k] = v
	}
	return cp
}

// SetVars merges a batch of variables into the context.
func (ctx *ExecutionCtx) SetVars(vars map[string]interface{}) {
	ctx.varMu.Lock()
	defer ctx.varMu.Unlock()
	for k, v := range vars {
		ctx.variables[k] = v
	}
}

// --- Node record access (thread-safe) ---

// EnsureRecord returns the NodeRecord for a node, creating one if absent.
func (ctx *ExecutionCtx) EnsureRecord(nodeID string) *NodeRecord {
	ctx.statusMu.Lock()
	defer ctx.statusMu.Unlock()
	r, ok := ctx.records[nodeID]
	if !ok {
		r = &NodeRecord{
			NodeID:  nodeID,
			Status:  StatusPending,
			Outputs: make(map[string]interface{}),
		}
		ctx.records[nodeID] = r
	}
	return r
}

// GetRecord returns the NodeRecord for a node, or nil if not yet tracked.
func (ctx *ExecutionCtx) GetRecord(nodeID string) *NodeRecord {
	ctx.statusMu.RLock()
	defer ctx.statusMu.RUnlock()
	return ctx.records[nodeID]
}

// AllRecords returns a copy of all node records.
func (ctx *ExecutionCtx) AllRecords() map[string]*NodeRecord {
	ctx.statusMu.RLock()
	defer ctx.statusMu.RUnlock()
	cp := make(map[string]*NodeRecord, len(ctx.records))
	for k, r := range ctx.records {
		cp[k] = r
	}
	return cp
}

// RecordError adds an error to the context's error log.
func (ctx *ExecutionCtx) RecordError(err error) {
	ctx.Errors = append(ctx.Errors, err)
}
