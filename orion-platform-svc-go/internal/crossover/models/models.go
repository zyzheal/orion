// Package models defines data models for the Crossover cross-module call system.
//
// The Crossover system provides a unified mechanism for cross-module operations
// including request/response, event-based, and async processing patterns.
//
// Core types:
//   - CrossoverCall: the call envelope (source → target → operation → parameters → result)
//   - CallOperation: a registered operation that modules expose
//   - CrossoverRequest / CrossoverResponse: request/response payloads
//   - CallType: enumerates the call patterns (sync, event, async)
//   - CrossoverEvent: event-based crossover notifications
//   - CrossoverAsyncJob: async processing jobs
//   - ModuleRegistry: in-memory registry for available modules
//
// See also:
//   - registry/registry.go for the CallOperationRegistry
//   - router/router.go for the CallRouter
//   - dispatcher/dispatcher.go for async job management
package models

import (
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// CallType — the invocation pattern
// ---------------------------------------------------------------------------

// CallType represents the invocation pattern for a crossover call.
type CallType string

const (
	CallTypeRequestResponse CallType = "request_response" // synchronous request/response
	CallTypeEvent           CallType = "event"            // fire-and-forget event
	CallTypeAsync           CallType = "async"            // async with deferred result
)

// ValidCallTypes holds the set of valid call types.
var ValidCallTypes = map[CallType]bool{
	CallTypeRequestResponse: true,
	CallTypeEvent:           true,
	CallTypeAsync:           true,
}

// ---------------------------------------------------------------------------
// OperationStatus — lifecycle of a registered operation
// ---------------------------------------------------------------------------

// OperationStatus represents the lifecycle state of a registered operation.
type OperationStatus string

const (
	OperationStatusActive   OperationStatus = "active"
	OperationStatusDisabled OperationStatus = "disabled"
)

// ---------------------------------------------------------------------------
// CallResult — the outcome of a crossover call
// ---------------------------------------------------------------------------

// CallResult represents the outcome of a crossover call.
type CallResult string

const (
	CallResultPending    CallResult = "pending"
	CallResultSucceeded  CallResult = "succeeded"
	CallResultFailed     CallResult = "failed"
	CallResultTimeout    CallResult = "timeout"
	CallResultNoHandler  CallResult = "no_handler"
	CallResultDeprecated CallResult = "deprecated"
)

// ---------------------------------------------------------------------------
// CrossoverCall — the call envelope (source → target → operation → params → result)
// ---------------------------------------------------------------------------

// CrossoverCall is the call envelope for cross-module operations.
type CrossoverCall struct {
	ID             string         `json:"id" db:"id"`
	TenantID       string         `json:"tenantId" db:"tenant_id"`
	CallType       CallType       `json:"callType" db:"call_type"`
	SourceModule   string         `json:"sourceModule" db:"source_module"`
	TargetModule   string         `json:"targetModule" db:"target_module"`
	Operation      string         `json:"operation" db:"operation"`
	Parameters     CallParameters `json:"parameters" db:"parameters"` // JSON-encoded map
	Result         *CallResultObj `json:"result,omitempty" db:"result"`
	Status         string         `json:"status" db:"status"`
	CreatedAt      time.Time      `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time      `json:"updatedAt" db:"updated_at"`
}

// CallParameters is a JSON-encoded map of operation parameters.
type CallParameters map[string]interface{}

// CallResultObj holds the structured result of a crossover call.
type CallResultObj struct {
	Value  map[string]interface{} `json:"value,omitempty"`
	Error  string                 `json:"error,omitempty"`
	DoneAt time.Time              `json:"doneAt" db:"done_at"`
}

// ---------------------------------------------------------------------------
// CrossoverRequest — request to dispatch a crossover call
// ---------------------------------------------------------------------------

// CreateCrossoverCallRequest is the request body for creating a crossover call.
type CreateCrossoverCallRequest struct {
	CallType     CallType       `json:"callType" binding:"required"`
	TargetModule string         `json:"targetModule" binding:"required"`
	Operation    string         `json:"operation" binding:"required"`
	Parameters   CallParameters `json:"parameters,omitempty"`
	SourceModule string         `json:"sourceModule"` // optional; filled by system if absent
}

// InvokeCrossoverRequest is the request body for invoking a crossover operation.
type InvokeCrossoverRequest struct {
	TargetModule string         `json:"targetModule" binding:"required"`
	Operation    string         `json:"operation" binding:"required"`
	Parameters   CallParameters `json:"parameters,omitempty"`
}

// ---------------------------------------------------------------------------
// CallOperation — a registered cross-module operation
// ---------------------------------------------------------------------------

// CallOperation represents a registered cross-module operation.
type CallOperation struct {
	ID           string                 `json:"id" db:"id"`
	TenantID     string                 `json:"tenant_id" db:"tenant_id"`
	Module       string                 `json:"module" db:"module"`            // owning module (target)
	Name         string                 `json:"name" db:"name"`               // operation name
	CallType     CallType               `json:"callType" db:"call_type"`       // supported call pattern
	Status       OperationStatus        `json:"status" db:"status"`            // active / disabled
	Description  string                 `json:"description" db:"description"`
	InputSchema  map[string]interface{} `json:"inputSchema" db:"input_schema"` // expected params shape
	OutputSchema map[string]interface{} `json:"outputSchema" db:"output_schema"` // expected result shape
	RegisteredBy string               `json:"registeredBy" db:"registered_by"`
	CreatedAt    time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time              `json:"updatedAt" db:"updated_at"`
}

// RegisterOperationRequest is the request body for registering a new operation.
type RegisterOperationRequest struct {
	Module       string                 `json:"module" binding:"required"`
	Name         string                 `json:"name" binding:"required"`
	CallType     CallType               `json:"callType" binding:"required"`
	Description  string                 `json:"description,omitempty"`
	InputSchema  map[string]interface{} `json:"inputSchema,omitempty"`
	OutputSchema map[string]interface{} `json:"outputSchema,omitempty"`
	RegisteredBy string               `json:"registeredBy,omitempty"`
}

// ---------------------------------------------------------------------------
// CrossoverEvent — an event-based crossover notification
// ---------------------------------------------------------------------------

// CrossoverEvent represents an event-based crossover notification.
type CrossoverEvent struct {
	ID          string                 `json:"id"`
	TenantID    string                 `json:"tenantId"`
	Type        string                 `json:"type"`                   // event type, e.g. "module.operation.completed"
	Source      string                 `json:"source"`                 // emitting module
	Payload     map[string]interface{} `json:"payload,omitempty"`
	Correlation string                 `json:"correlation,omitempty"`  // correlates with a call ID
	OccurredAt  time.Time              `json:"occurredAt"`
}

// ---------------------------------------------------------------------------
// CrossoverAsyncJob — an async processing job
// ---------------------------------------------------------------------------

// CrossoverAsyncJob represents an async processing job.
type CrossoverAsyncJob struct {
	ID           string         `json:"id" db:"id"`
	TenantID     string         `json:"tenant_id" db:"tenant_id"`
	CallID       string         `json:"callId" db:"call_id"`
	TargetModule string         `json:"targetModule" db:"target_module"`
	Operation    string         `json:"operation" db:"operation"`
	Parameters   CallParameters `json:"parameters" db:"parameters"`
	Status       string         `json:"status" db:"status"` // pending, running, completed, failed
	Result       *CallResultObj `json:"result,omitempty"`
	CreatedAt    time.Time      `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time      `json:"updatedAt" db:"updated_at"`
}

// CreateAsyncJobRequest is the request body for creating an async job.
type CreateAsyncJobRequest struct {
	TargetModule string         `json:"targetModule" binding:"required"`
	Operation    string         `json:"operation" binding:"required"`
	Parameters   CallParameters `json:"parameters,omitempty"`
}

// ---------------------------------------------------------------------------
// CrossoverCallStats — aggregated statistics for crossover calls
// ---------------------------------------------------------------------------

// CrossoverCallStats holds aggregated statistics for crossover calls.
type CrossoverCallStats struct {
	Total        int64            `json:"total"`
	Success      int64            `json:"success"`
	Failed       int64            `json:"failed"`
	Timeout      int64            `json:"timeout"`
	ByModule     map[string]int64 `json:"byModule"` // per target module
	AvgLatencyMs float64         `json:"avgLatencyMs"`
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

// ListOptions holds pagination and filter parameters.
type ListOptions struct {
	Offset int `json:"offset"`
	Limit  int `json:"limit"`
}

// NewListOptions creates default pagination (page 1, pageSize 20).
func NewListOptions(page, pageSize int) ListOptions {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		// cap at 100
	}
	return ListOptions{
		Offset: (page - 1) * pageSize,
		Limit:  pageSize,
	}
}

// ---------------------------------------------------------------------------
// ModuleRegistry — in-memory registry for available modules
// ---------------------------------------------------------------------------

// ModuleInfo holds metadata about a registered module.
type ModuleInfo struct {
	Name        string   `json:"name"`
	Domain      string   `json:"domain"`
	Description string   `json:"description"`
	Operations  []string `json:"operations"` // operation names exposed by this module
}

// ModuleRegistry provides a thread-safe registry of available modules.
type ModuleRegistry struct {
	mu      sync.RWMutex
	modules map[string]*ModuleInfo // keyed by module name
}

// NewModuleRegistry creates a new ModuleRegistry.
func NewModuleRegistry() *ModuleRegistry {
	return &ModuleRegistry{
		modules: make(map[string]*ModuleInfo),
	}
}

// Register adds or updates a module.
func (r *ModuleRegistry) Register(info *ModuleInfo) {
	r.mu.Lock()
	defer r.mu.Unlock()
	infoCopy := &ModuleInfo{
		Name:        info.Name,
		Domain:      info.Domain,
		Description: info.Description,
		Operations:  make([]string, len(info.Operations)),
	}
	copy(infoCopy.Operations, info.Operations)
	r.modules[infoCopy.Name] = infoCopy
}

// Unregister removes a module.
func (r *ModuleRegistry) Unregister(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.modules, name)
}

// Get returns the module info by name, or nil if not found.
func (r *ModuleRegistry) Get(name string) *ModuleInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	m := r.modules[name]
	if m == nil {
		return nil
	}
	result := &ModuleInfo{
		Name:        m.Name,
		Domain:      m.Domain,
		Description: m.Description,
		Operations:  make([]string, len(m.Operations)),
	}
	copy(result.Operations, m.Operations)
	return result
}

// Has returns whether a module is registered.
func (r *ModuleRegistry) Has(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.modules[name] != nil
}

// HasOperation returns whether a module exposes a given operation.
func (r *ModuleRegistry) HasOperation(module, operation string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	m, ok := r.modules[module]
	if !ok {
		return false
	}
	for _, op := range m.Operations {
		if op == operation {
			return true
		}
	}
	return false
}

// List returns all registered modules.
func (r *ModuleRegistry) List() []ModuleInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]ModuleInfo, 0, len(r.modules))
	for _, m := range r.modules {
		info := ModuleInfo{
			Name:        m.Name,
			Domain:      m.Domain,
			Description: m.Description,
			Operations:  make([]string, len(m.Operations)),
		}
		copy(info.Operations, m.Operations)
		result = append(result, info)
	}
	return result
}
