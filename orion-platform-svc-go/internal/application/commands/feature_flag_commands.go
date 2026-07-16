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
// FeatureFlag Command Handlers (CQRS Write-Side)
//
// All FeatureFlag commands mutate state by executing domain methods on the
// FeatureFlagAggregate, persisting new events to EventStore, and publishing
// them via EventPublisher.
// ============================================================================

// ---------------------------------------------------------------------------
// Command Definitions
// ---------------------------------------------------------------------------

// ToggleFeatureFlagCommand toggles a feature flag on or off.
type ToggleFeatureFlagCommand struct {
	baseCommand
	FlagKey  string // feature flag key
	Enabled  bool   // target enabled state
	ToggledBy string // user who toggled the flag
}

func (c *ToggleFeatureFlagCommand) Validate() error {
	if err := requireTenant(c.tenantID); err != nil {
		return err
	}
	if err := requireID(c.FlagKey, "flag key"); err != nil {
		return err
	}
	return nil
}

// UpdateRolloutCommand updates the rollout percentage and strategy of a feature flag.
type UpdateRolloutCommand struct {
	baseCommand
	FlagKey     string // feature flag key
	Percent     int    // rollout percentage (0-100)
	Strategy    string // ALL/NONE/PERCENTAGE/TARGETING
	UpdatedBy  string // user who made the change
}

func (c *UpdateRolloutCommand) Validate() error {
	if err := requireTenant(c.tenantID); err != nil {
		return err
	}
	if err := requireID(c.FlagKey, "flag key"); err != nil {
		return err
	}
	if c.Percent < 0 || c.Percent > 100 {
		return fmt.Errorf("%w: rollout percent must be between 0 and 100", ErrInvalidCommand)
	}
	if c.Strategy == "" {
		return fmt.Errorf("%w: rollout strategy is required", ErrInvalidCommand)
	}
	return nil
}

// ---------------------------------------------------------------------------
// ToggleFeatureFlagHandler
// ---------------------------------------------------------------------------

// ToggleFeatureFlagHandler processes ToggleFeatureFlagCommand.
type ToggleFeatureFlagHandler struct {
	store     eventstore.EventStore
	publisher events.EventPublisher
}

func NewToggleFeatureFlagHandler(store eventstore.EventStore, publisher events.EventPublisher) *ToggleFeatureFlagHandler {
	return &ToggleFeatureFlagHandler{store: store, publisher: publisher}
}

// Execute toggles the specified feature flag.
func (h *ToggleFeatureFlagHandler) Execute(ctx context.Context, cmd *ToggleFeatureFlagCommand) (*CommandResult, error) {
	agg, err := loadFeatureFlagAggregate(h.store, ctx, cmd.GetTenantID(), cmd.FlagKey)
	if err != nil {
		return nil, err
	}

	newEvent := agg.ToggleFeatureFlag(cmd.Enabled)
	if newEvent == nil {
		return nil, ErrAggregateNotReady
	}
	newEvent.SetAggregateID(agg.GetAggregateID())
	newEvent.SetTenantID(agg.GetTenantID())

	// If event is a concrete *events.FeatureFlagToggledEvent, set toggledBy
	if toggled, ok := newEvent.(*events.FeatureFlagToggledEvent); ok {
		toggled.ToggledBy = cmd.ToggledBy
	}

	if err := h.store.Append(ctx, newEvent); err != nil {
		return nil, errors.Join(ErrAppendFailed, err)
	}

	if err := h.publisher.Publish(ctx, newEvent); err != nil {
		return &CommandResult{
			Success:       true,
			AggregateID:   cmd.FlagKey,
			AggregateType: queries.AggregateTypeFeatureFlag,
			Version:       agg.GetVersion(),
			Events:        []events.DomainEvent{newEvent},
		}, errors.Join(ErrPublishFailed, err)
	}

	return &CommandResult{
		Success:       true,
		AggregateID:   cmd.FlagKey,
		AggregateType: queries.AggregateTypeFeatureFlag,
		Version:       agg.GetVersion(),
		Events:        []events.DomainEvent{newEvent},
	}, nil
}

// ---------------------------------------------------------------------------
// UpdateRolloutHandler
// ---------------------------------------------------------------------------

// UpdateRolloutHandler processes UpdateRolloutCommand.
type UpdateRolloutHandler struct {
	store     eventstore.EventStore
	publisher events.EventPublisher
}

func NewUpdateRolloutHandler(store eventstore.EventStore, publisher events.EventPublisher) *UpdateRolloutHandler {
	return &UpdateRolloutHandler{store: store, publisher: publisher}
}

// Execute updates the rollout configuration of the specified feature flag.
func (h *UpdateRolloutHandler) Execute(ctx context.Context, cmd *UpdateRolloutCommand) (*CommandResult, error) {
	agg, err := loadFeatureFlagAggregate(h.store, ctx, cmd.GetTenantID(), cmd.FlagKey)
	if err != nil {
		return nil, err
	}

	newEvent := agg.UpdateRollout(cmd.Percent, cmd.Strategy)
	if newEvent == nil {
		return nil, ErrAggregateNotReady
	}
	newEvent.SetAggregateID(agg.GetAggregateID())
	newEvent.SetTenantID(agg.GetTenantID())

	if err := h.store.Append(ctx, newEvent); err != nil {
		return nil, errors.Join(ErrAppendFailed, err)
	}

	if err := h.publisher.Publish(ctx, newEvent); err != nil {
		return &CommandResult{
			Success:       true,
			AggregateID:   cmd.FlagKey,
			AggregateType: queries.AggregateTypeFeatureFlag,
			Version:       agg.GetVersion(),
			Events:        []events.DomainEvent{newEvent},
		}, errors.Join(ErrPublishFailed, err)
	}

	return &CommandResult{
		Success:       true,
		AggregateID:   cmd.FlagKey,
		AggregateType: queries.AggregateTypeFeatureFlag,
		Version:       agg.GetVersion(),
		Events:        []events.DomainEvent{newEvent},
	}, nil
}

// ---------------------------------------------------------------------------
