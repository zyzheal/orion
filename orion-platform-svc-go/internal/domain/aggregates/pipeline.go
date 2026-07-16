package aggregates

import (
	"time"
	"orion/platform-svc-go/internal/domain/events"
)

// PipelineAggregate represents the Pipeline aggregate root.
type PipelineAggregate struct {
	BaseAggregate
	Name       string            `json:"name"`
	Status     string            `json:"status"` // DRAFT/ACTIVE/DEPRECATED
	YAML       string            `json:"yaml"`
	Metadata   map[string]string `json:"metadata"`
	ActivatedAt *time.Time        `json:"activatedAt"`
	DeprecatedAt *time.Time       `json:"deprecatedAt"`
}

// ActivatePipeline creates a PipelineActivatedEvent.
func (p *PipelineAggregate) ActivatePipeline() events.DomainEvent {
	p.Status = "ACTIVE"
	now := time.Now().UTC()
	p.ActivatedAt = &now
	return &events.PipelineActivatedEvent{
		PipelineName: p.Name,
	}
}

// DeactivatePipeline creates a PipelineDeactivatedEvent.
func (p *PipelineAggregate) DeactivatePipeline() events.DomainEvent {
	if p.Status != "ACTIVE" {
		return nil
	}
	p.Status = "DEPRECATED"
	now := time.Now().UTC()
	p.DeprecatedAt = &now
	return &events.PipelineDeactivatedEvent{
		PipelineName: p.Name,
	}
}

// UpdatePipelineYAML creates a PipelineUpdatedEvent.
func (p *PipelineAggregate) UpdatePipelineYAML(newYaml string) events.DomainEvent {
	p.YAML = newYaml
	return &events.PipelineUpdatedEvent{
		PipelineName: p.Name,
	}
}

// Apply applies a domain event to the Pipeline aggregate state.
func (p *PipelineAggregate) Apply(e events.DomainEvent) {
	switch e.(type) {
	case *events.PipelineActivatedEvent:
		p.Status = "ACTIVE"
		now := time.Now().UTC()
		p.ActivatedAt = &now
	case *events.PipelineDeactivatedEvent:
		p.Status = "DEPRECATED"
		now := time.Now().UTC()
		p.DeprecatedAt = &now
	case *events.PipelineUpdatedEvent:
	}
}
