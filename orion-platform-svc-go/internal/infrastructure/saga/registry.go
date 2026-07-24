package saga

import (
	"context"
)

// StepRegistry manages the registration of saga steps with their execute/compensate functions.
type StepRegistry interface {
	Register(step SagaStep)
	Get(stepID string) (SagaStep, bool)
	List() []SagaStep
}

// DefaultStepRegistry is an in-memory implementation.
type DefaultStepRegistry struct {
	steps map[string]SagaStep
}

func NewStepRegistry() *DefaultStepRegistry {
	return &DefaultStepRegistry{steps: make(map[string]SagaStep)}
}

func (r *DefaultStepRegistry) Register(step SagaStep) {
	r.steps[step.ID] = step
}

func (r *DefaultStepRegistry) Get(stepID string) (SagaStep, bool) {
	step, ok := r.steps[stepID]
	return step, ok
}

func (r *DefaultStepRegistry) List() []SagaStep {
	result := make([]SagaStep, 0, len(r.steps))
	for _, s := range r.steps {
		result = append(result, s)
	}
	return result
}

// SagaRepository provides persistence for saga instances.
type SagaRepository interface {
	Create(ctx context.Context, instance *SagaInstance) error
	Update(ctx context.Context, instance *SagaInstance) error
	Get(ctx context.Context, tenantID, sagaID string) (*SagaInstance, error)
	ListPending(ctx context.Context, tenantID string) ([]*SagaInstance, error)
}
