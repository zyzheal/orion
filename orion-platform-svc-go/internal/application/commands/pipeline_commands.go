package commands

import (
	"context"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/application/queries"
	"orion/platform-svc-go/internal/domain/eventstore"
	"orion/platform-svc-go/internal/domain/events"
)

// ============================================================================
// Pipeline Command Handlers (CQRS Write-Side)
//
// All Pipeline commands mutate state by executing domain methods on the
// PipelineAggregate, persisting new events to EventStore, and publishing
// them via EventPublisher.
// ============================================================================

// ---------------------------------------------------------------------------
// Command Definitions
// ---------------------------------------------------------------------------

// ActivatePipelineCommand activates a pipeline (DRAFT → ACTIVE).
type ActivatePipelineCommand struct {
	baseCommand
	ID string // pipeline aggregate ID
}

func (c *ActivatePipelineCommand) Validate() error {
	if err := requireTenant(c.tenantID); err != nil {
		return err
	}
	if err := requireID(c.ID, "pipeline ID"); err != nil {
		return err
	}
	return nil
}

// DeactivatePipelineCommand deactivates an active pipeline (ACTIVE → DEPRECATED).
type DeactivatePipelineCommand struct {
	baseCommand
	ID     string // pipeline aggregate ID
	Reason string // optional reason for deprecation
}

func (c *DeactivatePipelineCommand) Validate() error {
	if err := requireTenant(c.tenantID); err != nil {
		return err
	}
	if err := requireID(c.ID, "pipeline ID"); err != nil {
		return err
	}
	return nil
}

// UpdatePipelineYAMLCommand updates the YAML definition of a pipeline.
type UpdatePipelineYAMLCommand struct {
	baseCommand
	ID        string // pipeline aggregate ID
	NewYAML   string // new YAML content
	ChangedBy string // user who initiated the change
}

func (c *UpdatePipelineYAMLCommand) Validate() error {
	if err := requireTenant(c.tenantID); err != nil {
		return err
	}
	if err := requireID(c.ID, "pipeline ID"); err != nil {
		return err
	}
	if c.NewYAML == "" {
		return fmt.Errorf("%w: pipeline YAML is required", ErrInvalidCommand)
	}
	return nil
}

// ---------------------------------------------------------------------------
// ActivatePipelineHandler
// ---------------------------------------------------------------------------

// ActivatePipelineHandler processes ActivatePipelineCommand.
type ActivatePipelineHandler struct {
	store     eventstore.EventStore
	publisher events.EventPublisher
}

func NewActivatePipelineHandler(store eventstore.EventStore, publisher events.EventPublisher) *ActivatePipelineHandler {
	return &ActivatePipelineHandler{store: store, publisher: publisher}
}

// Execute activates the specified pipeline.
func (h *ActivatePipelineHandler) Execute(ctx context.Context, cmd *ActivatePipelineCommand) (*CommandResult, error) {
	agg, err := loadPipelineAggregate(h.store, ctx, cmd.GetTenantID(), cmd.ID)
	if err != nil {
		return nil, err
	}

	// Execute domain method
	newEvent := agg.ActivatePipeline()
	if newEvent == nil {
		return nil, ErrAggregateNotReady
	}

	// Set event base fields (occurredAt)
	newEvent.SetAggregateID(agg.GetAggregateID())
	newEvent.SetTenantID(agg.GetTenantID())

	// ComposedEventPublisher handles both persistence and notification
	if err := h.publisher.Publish(ctx, newEvent); err != nil {
		return &CommandResult{
			Success:       true,
			AggregateID:   cmd.ID,
			AggregateType: queries.AggregateTypePipeline,
			Version:       agg.GetVersion(),
			Events:        []events.DomainEvent{newEvent},
		}, errors.Join(ErrPublishFailed, err)
	}

	return &CommandResult{
		Success:       true,
		AggregateID:   cmd.ID,
		AggregateType: queries.AggregateTypePipeline,
		Version:       agg.GetVersion(),
		Events:        []events.DomainEvent{newEvent},
	}, nil
}

// ---------------------------------------------------------------------------
// DeactivatePipelineHandler
// ---------------------------------------------------------------------------

// DeactivatePipelineHandler processes DeactivatePipelineCommand.
type DeactivatePipelineHandler struct {
	store     eventstore.EventStore
	publisher events.EventPublisher
}

func NewDeactivatePipelineHandler(store eventstore.EventStore, publisher events.EventPublisher) *DeactivatePipelineHandler {
	return &DeactivatePipelineHandler{store: store, publisher: publisher}
}

// Execute deactivates the specified pipeline.
func (h *DeactivatePipelineHandler) Execute(ctx context.Context, cmd *DeactivatePipelineCommand) (*CommandResult, error) {
	agg, err := loadPipelineAggregate(h.store, ctx, cmd.GetTenantID(), cmd.ID)
	if err != nil {
		return nil, err
	}

	// Execute domain method
	newEvent := agg.DeactivatePipeline()
	if newEvent == nil {
		return nil, ErrAggregateNotReady
	}

	newEvent.SetAggregateID(agg.GetAggregateID())
	newEvent.SetTenantID(agg.GetTenantID())

	if err := h.publisher.Publish(ctx, newEvent); err != nil {
		return &CommandResult{
			Success:       true,
			AggregateID:   cmd.ID,
			AggregateType: queries.AggregateTypePipeline,
			Version:       agg.GetVersion(),
			Events:        []events.DomainEvent{newEvent},
		}, errors.Join(ErrPublishFailed, err)
	}

	return &CommandResult{
		Success:       true,
		AggregateID:   cmd.ID,
		AggregateType: queries.AggregateTypePipeline,
		Version:       agg.GetVersion(),
		Events:        []events.DomainEvent{newEvent},
	}, nil
}

// ---------------------------------------------------------------------------
// UpdatePipelineYAMLHandler
// ---------------------------------------------------------------------------

// UpdatePipelineYAMLHandler processes UpdatePipelineYAMLCommand.
type UpdatePipelineYAMLHandler struct {
	store     eventstore.EventStore
	publisher events.EventPublisher
}

func NewUpdatePipelineYAMLHandler(store eventstore.EventStore, publisher events.EventPublisher) *UpdatePipelineYAMLHandler {
	return &UpdatePipelineYAMLHandler{store: store, publisher: publisher}
}

// Execute updates the YAML definition of the specified pipeline.
func (h *UpdatePipelineYAMLHandler) Execute(ctx context.Context, cmd *UpdatePipelineYAMLCommand) (*CommandResult, error) {
	agg, err := loadPipelineAggregate(h.store, ctx, cmd.GetTenantID(), cmd.ID)
	if err != nil {
		return nil, err
	}

	// Execute domain method
	newEvent := agg.UpdatePipelineYAML(cmd.NewYAML)
	if newEvent == nil {
		return nil, ErrAggregateNotReady
	}

	newEvent.SetAggregateID(agg.GetAggregateID())
	newEvent.SetTenantID(agg.GetTenantID())

	if err := h.publisher.Publish(ctx, newEvent); err != nil {
		return &CommandResult{
			Success:       true,
			AggregateID:   cmd.ID,
			AggregateType: queries.AggregateTypePipeline,
			Version:       agg.GetVersion(),
			Events:        []events.DomainEvent{newEvent},
		}, errors.Join(ErrPublishFailed, err)
	}

	return &CommandResult{
		Success:       true,
		AggregateID:   cmd.ID,
		AggregateType: queries.AggregateTypePipeline,
		Version:       agg.GetVersion(),
		Events:        []events.DomainEvent{newEvent},
	}, nil
}