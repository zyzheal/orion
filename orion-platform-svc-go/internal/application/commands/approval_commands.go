package commands

import (
	"context"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/application/queries"
	"orion/platform-svc-go/internal/domain/aggregates"
	"orion/platform-svc-go/internal/domain/eventstore"
	"orion/platform-svc-go/internal/domain/events"
)

// ============================================================================
// Approval Command Handlers (CQRS Write-Side)
//
// All Approval commands mutate state by executing domain methods on the
// ApprovalAggregate, persisting new events to EventStore, and publishing
// them via EventPublisher.
// ============================================================================

// ---------------------------------------------------------------------------
// Command Definitions
// ---------------------------------------------------------------------------

// CreateApprovalCommand creates a new approval request with one or more levels.
type CreateApprovalCommand struct {
	baseCommand
	ID           string // approval aggregate ID
	ApprovalType string // e.g. multi_level, emergency
	TotalLevels  int    // number of approval levels
	Title        string // human-readable title
	ReqByID      string // user who created the request
	Levels       []LevelInfo // approval levels to set up
}

// LevelInfo describes a single approval level for CreateApprovalCommand.
type LevelInfo struct {
	Order int    // 1-based position
	ID    string // level identifier
}

func (c *CreateApprovalCommand) Validate() error {
	if err := requireTenant(c.tenantID); err != nil {
		return err
	}
	if err := requireID(c.ID, "approval ID"); err != nil {
		return err
	}
	if c.ApprovalType == "" {
		return fmt.Errorf("%w: approval type is required", ErrInvalidCommand)
	}
	if c.TotalLevels <= 0 || c.TotalLevels != len(c.Levels) {
		return fmt.Errorf("%w: totalLevels must match number of levels", ErrInvalidCommand)
	}
	return nil
}

// ApproveLevelCommand approves a single level of an approval request.
type ApproveLevelCommand struct {
	baseCommand
	ApprovalID string
	LevelID    string
	ApproverID string
	Comment    string
}

func (c *ApproveLevelCommand) Validate() error {
	if err := requireTenant(c.tenantID); err != nil {
		return err
	}
	if err := requireID(c.ApprovalID, "approval ID"); err != nil {
		return err
	}
	if err := requireID(c.LevelID, "level ID"); err != nil {
		return err
	}
	if err := requireID(c.ApproverID, "approver ID"); err != nil {
		return err
	}
	return nil
}

// RejectLevelCommand rejects a single level of an approval request.
type RejectLevelCommand struct {
	baseCommand
	ApprovalID string
	LevelID    string
	ApproverID string
	Comment    string
}

func (c *RejectLevelCommand) Validate() error {
	if err := requireTenant(c.tenantID); err != nil {
		return err
	}
	if err := requireID(c.ApprovalID, "approval ID"); err != nil {
		return err
	}
	if err := requireID(c.LevelID, "level ID"); err != nil {
		return err
	}
	if err := requireID(c.ApproverID, "approver ID"); err != nil {
		return err
	}
	return nil
}

// CancelApprovalCommand cancels a pending approval request.
type CancelApprovalCommand struct {
	baseCommand
	ID      string // approval aggregate ID
	Reason  string // cancellation reason
	CancelledBy string // user who cancelled
}

func (c *CancelApprovalCommand) Validate() error {
	if err := requireTenant(c.tenantID); err != nil {
		return err
	}
	if err := requireID(c.ID, "approval ID"); err != nil {
		return err
	}
	return nil
}

// ---------------------------------------------------------------------------
// CreateApprovalHandler
// ---------------------------------------------------------------------------

// CreateApprovalHandler processes CreateApprovalCommand.
type CreateApprovalHandler struct {
	store     eventstore.EventStore
	publisher events.EventPublisher
}

func NewCreateApprovalHandler(store eventstore.EventStore, publisher events.EventPublisher) *CreateApprovalHandler {
	return &CreateApprovalHandler{store: store, publisher: publisher}
}

// Execute creates a new approval request and initializes its approval levels.
func (h *CreateApprovalHandler) Execute(ctx context.Context, cmd *CreateApprovalCommand) (*CommandResult, error) {
	// Build the aggregate from scratch (no event stream yet)
	levels := make([]aggregates.ApprovalLevel, len(cmd.Levels))
	for i, l := range cmd.Levels {
		levels[i] = aggregates.ApprovalLevel{
			LevelID: l.ID,
			Order:   l.Order,
			Status:  "PENDING",
		}
	}
	agg := &aggregates.ApprovalAggregate{
		BaseAggregate: aggregates.BaseAggregate{
			AggregateID:   cmd.ID,
			AggregateType: queries.AggregateTypeApproval,
			TenantID:      cmd.GetTenantID(),
		},
		ApprovalType: cmd.ApprovalType,
		TotalLevels:  cmd.TotalLevels,
		Approvals:    levels,
	}

	// Execute domain method to create the initial event
	newEvent := agg.CreateApproval()
	if newEvent == nil {
		return nil, ErrAggregateNotReady
	}
	newEvent.SetAggregateID(agg.GetAggregateID())
	newEvent.SetTenantID(agg.GetTenantID())

	// Persist the initial event
	if err := h.store.Append(ctx, newEvent); err != nil {
		return nil, errors.Join(ErrAppendFailed, err)
	}

	// Publish the event
	if err := h.publisher.Publish(ctx, newEvent); err != nil {
		return &CommandResult{
			Success:       true,
			AggregateID:   cmd.ID,
			AggregateType: queries.AggregateTypeApproval,
			Version:       agg.GetVersion(),
			Events:        []events.DomainEvent{newEvent},
		}, errors.Join(ErrPublishFailed, err)
	}

	return &CommandResult{
		Success:       true,
		AggregateID:   cmd.ID,
		AggregateType: queries.AggregateTypeApproval,
		Version:       agg.GetVersion(),
		Events:        []events.DomainEvent{newEvent},
	}, nil
}

// ---------------------------------------------------------------------------
// ApproveLevelHandler
// ---------------------------------------------------------------------------

// ApproveLevelHandler processes ApproveLevelCommand.
type ApproveLevelHandler struct {
	store     eventstore.EventStore
	publisher events.EventPublisher
}

func NewApproveLevelHandler(store eventstore.EventStore, publisher events.EventPublisher) *ApproveLevelHandler {
	return &ApproveLevelHandler{store: store, publisher: publisher}
}

// Execute approves the specified level of an approval request.
func (h *ApproveLevelHandler) Execute(ctx context.Context, cmd *ApproveLevelCommand) (*CommandResult, error) {
	agg, err := loadApprovalAggregate(h.store, ctx, cmd.GetTenantID(), cmd.ApprovalID)
	if err != nil {
		return nil, err
	}

	newEvent := agg.ApproveLevel(cmd.LevelID, cmd.ApproverID, cmd.Comment)
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
			AggregateID:   cmd.ApprovalID,
			AggregateType: queries.AggregateTypeApproval,
			Version:       agg.GetVersion(),
			Events:        []events.DomainEvent{newEvent},
		}, errors.Join(ErrPublishFailed, err)
	}

	return &CommandResult{
		Success:       true,
		AggregateID:   cmd.ApprovalID,
		AggregateType: queries.AggregateTypeApproval,
		Version:       agg.GetVersion(),
		Events:        []events.DomainEvent{newEvent},
	}, nil
}

// ---------------------------------------------------------------------------
// RejectLevelHandler
// ---------------------------------------------------------------------------

// RejectLevelHandler processes RejectLevelCommand.
type RejectLevelHandler struct {
	store     eventstore.EventStore
	publisher events.EventPublisher
}

func NewRejectLevelHandler(store eventstore.EventStore, publisher events.EventPublisher) *RejectLevelHandler {
	return &RejectLevelHandler{store: store, publisher: publisher}
}

// Execute rejects the specified level of an approval request.
func (h *RejectLevelHandler) Execute(ctx context.Context, cmd *RejectLevelCommand) (*CommandResult, error) {
	agg, err := loadApprovalAggregate(h.store, ctx, cmd.GetTenantID(), cmd.ApprovalID)
	if err != nil {
		return nil, err
	}

	newEvent := agg.RejectLevel(cmd.LevelID, cmd.ApproverID, cmd.Comment)
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
			AggregateID:   cmd.ApprovalID,
			AggregateType: queries.AggregateTypeApproval,
			Version:       agg.GetVersion(),
			Events:        []events.DomainEvent{newEvent},
		}, errors.Join(ErrPublishFailed, err)
	}

	return &CommandResult{
		Success:       true,
		AggregateID:   cmd.ApprovalID,
		AggregateType: queries.AggregateTypeApproval,
		Version:       agg.GetVersion(),
		Events:        []events.DomainEvent{newEvent},
	}, nil
}

// ---------------------------------------------------------------------------
// CancelApprovalHandler
// ---------------------------------------------------------------------------

// CancelApprovalHandler processes CancelApprovalCommand.
type CancelApprovalHandler struct {
	store     eventstore.EventStore
	publisher events.EventPublisher
}

func NewCancelApprovalHandler(store eventstore.EventStore, publisher events.EventPublisher) *CancelApprovalHandler {
	return &CancelApprovalHandler{store: store, publisher: publisher}
}

// Execute cancels a pending approval request.
func (h *CancelApprovalHandler) Execute(ctx context.Context, cmd *CancelApprovalCommand) (*CommandResult, error) {
	agg, err := loadApprovalAggregate(h.store, ctx, cmd.GetTenantID(), cmd.ID)
	if err != nil {
		return nil, err
	}

	newEvent := agg.CancelApproval(cmd.Reason)
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
			AggregateID:   cmd.ID,
			AggregateType: queries.AggregateTypeApproval,
			Version:       agg.GetVersion(),
			Events:        []events.DomainEvent{newEvent},
		}, errors.Join(ErrPublishFailed, err)
	}

	return &CommandResult{
		Success:       true,
		AggregateID:   cmd.ID,
		AggregateType: queries.AggregateTypeApproval,
		Version:       agg.GetVersion(),
		Events:        []events.DomainEvent{newEvent},
	}, nil
}

// ---------------------------------------------------------------------------
