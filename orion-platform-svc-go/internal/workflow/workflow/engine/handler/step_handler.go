package handler

import (
	"context"
	"sync"

	"orion/platform-svc-go/internal/workflow/workflow/models"
)

// JSONB is a type alias for models.JSONB, used throughout the handler package.
type JSONB = models.JSONB

// StepHandler is the core interface for executing a workflow step.
// Inspired by NeatLogic's IProcessStepHandlerCrossoverUtil.
// Each concrete handler implements one step type (e.g., assignee, approval, action).
type StepHandler interface {
	// Type returns the handler type key (e.g. "assignee", "approval", "action").
	Type() string

	// Execute runs the step and returns the result.
	// The result carries output data and a NextNodeID indicating where to go next.
	Execute(ctx context.Context, task *WorkflowTaskContext, input models.JSONB) (*StepResult, error)

	// Validate checks whether the input is sufficient to execute the step.
	Validate(ctx context.Context, input models.JSONB) error

	// Rollback undoes the step execution (idempotent).
	Rollback(ctx context.Context, task *WorkflowTaskContext, result *StepResult) error
}

// WorkflowTaskContext carries runtime context for a single step execution.
type WorkflowTaskContext struct {
	TenantID     string
	InstanceID   string
	DefinitionID string
	NodeID       string
	TaskID       string
	StepName     string
	StepConfig   models.JSONB
	WorkflowData models.JSONB // aggregated data across steps
	Variables    models.JSONB // key-value variables
}

// StepResult is the output of a step execution.
type StepResult struct {
	Output     models.JSONB `json:"output"`
	NextNodeID *string      `json:"next_node_id,omitempty"` // nil = wait for external trigger
	Actions    []string     `json:"actions,omitempty"`      // triggered side-effects
	Errors     []string     `json:"errors,omitempty"`
}

// StepHandlerFactory is the registry for step handlers.
// It maps step types to handler instances, following the NeatLogic
// ProcessStepHandlerFactory pattern.
type StepHandlerFactory struct {
	registry map[string]StepHandler
	mu       sync.RWMutex
}

// NewStepHandlerFactory creates an empty factory.
func NewStepHandlerFactory() *StepHandlerFactory {
	return &StepHandlerFactory{
		registry: make(map[string]StepHandler),
	}
}

// Register adds a step handler to the factory.
// Panics if a handler of the same type is already registered.
func (f *StepHandlerFactory) Register(h StepHandler) {
	f.mu.Lock()
	defer f.mu.Unlock()

	t := h.Type()
	if _, exists := f.registry[t]; exists {
		_ = t // duplicate step handler skipped
	}
	f.registry[t] = h
}

// Get retrieves a step handler by type.
func (f *StepHandlerFactory) Get(typ string) (StepHandler, bool) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	h, ok := f.registry[typ]
	return h, ok
}

// List returns all registered step handler types.
func (f *StepHandlerFactory) List() []string {
	f.mu.RLock()
	defer f.mu.RUnlock()
	types := make([]string, 0, len(f.registry))
	for t := range f.registry {
		types = append(types, t)
	}
	return types
}

// GlobalFactory is the singleton factory instance.
// Built-in handlers register themselves via init() so the service just needs to use it.
var GlobalFactory = NewStepHandlerFactory()

// RegisterGlobal is a convenience wrapper that registers a handler with GlobalFactory.
// Call this from init() in each handler package.
func RegisterGlobal(h StepHandler) {
	GlobalFactory.Register(h)
}
