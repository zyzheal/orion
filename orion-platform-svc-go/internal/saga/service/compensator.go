package service

import (
	"context"
	"sync"

	"orion/platform-svc-go/internal/saga/models"
)

// StepCompensator defines the interface for a step's compensation logic.
// A Compensate function receives the step that succeeded and its output,
// and returns a CompensationResult indicating success/failure.
// Compensators MUST be idempotent — they may be called multiple times.
type StepCompensator interface {
	// Compensate reverses the effects of a completed step.
	// step contains the original step data including input/output.
	Compensate(ctx context.Context, step *models.SagaStep) (*CompensationResult, error)
}

// CompensationResult records the outcome of a single compensation attempt.
type CompensationResult struct {
	Success bool
	Output  map[string]interface{}
	Error   string
}

// StepRegistry manages registered compensators for each step type.
type StepRegistry struct {
	compensators map[string]StepCompensator
	mu           sync.RWMutex
}

// NewStepRegistry creates a new StepRegistry.
func NewStepRegistry() *StepRegistry {
	return &StepRegistry{
		compensators: make(map[string]StepCompensator),
	}
}

// Register registers a compensator for a given step name.
// If a compensator is already registered, the new one overwrites the old.
func (r *StepRegistry) Register(stepName string, compensator StepCompensator) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.compensators[stepName] = compensator
}

// Get returns the compensator for a step name, or nil if none is registered.
func (r *StepRegistry) Get(stepName string) StepCompensator {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.compensators[stepName]
}

// List returns all registered step names.
func (r *StepRegistry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.compensators))
	for name := range r.compensators {
		names = append(names, name)
	}
	return names
}

// CompensateStep attempts to compensate a step, returning the result.
// If no compensator is registered for the step's name, it returns a
// default result with Success=true and a warning in Output.
func (r *StepRegistry) CompensateStep(ctx context.Context, step *models.SagaStep) (*CompensationResult, error) {
	comp := r.Get(step.StepName)
	if comp == nil {
		return &CompensationResult{
			Success: true,
			Output: map[string]interface{}{
				"step":    step.StepName,
				"message": "no compensator registered for step; skipping",
			},
			Error: "",
		}, nil
	}
	return comp.Compensate(ctx, step)
}
