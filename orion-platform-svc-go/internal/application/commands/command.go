package commands

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/domain/eventstore"
	"orion/platform-svc-go/internal/domain/events"
)

// ============================================================================
// Errors — standard sentinel errors used across all command handlers
// ============================================================================

var (
	ErrCommandFailed     = errors.New("command execution failed")
	ErrInvalidCommand    = errors.New("invalid command")
	ErrAggregateNotFound = errors.New("aggregate not found")
	ErrAggregateNotReady = errors.New("aggregate is not in a valid state for this command")
	ErrAppendFailed      = errors.New("failed to persist events")
	ErrPublishFailed     = errors.New("failed to publish event")
)

// ============================================================================
// Command (CQRS) — the write-side of CQRS
//
// Command represents a state-mutating operation. Unlike Query (read-only),
// commands may change domain state, emit domain events, and trigger side
// effects. Each concrete command carries the minimal data needed to execute
// its action, plus tenant isolation via GetTenantID.
//
// Execution flow:
//   1. Validate() — reject malformed commands early
//   2. Load aggregate from EventStore (rebuild from event stream)
//   3. Execute domain method → collect new events
//   4. EventStore.Append(events) — persist atomically
//   5. EventPublisher.PublishBatch(events) — broadcast to subscribers
// ============================================================================

// Command is the marker interface for all write-side operations.
type Command interface {
	// Validate returns an error if the command is malformed.
	// Called by handlers before any domain logic.
	Validate() error

	// GetTenantID returns the tenant ID for multi-tenant isolation.
	GetTenantID() string
}

// CommandResult is the unified return type for all command handlers.
// It carries the result payload and metadata about the command execution.
type CommandResult struct {
	// Success indicates whether the command executed successfully.
	Success bool `json:"success"`

	// AggregateID is the ID of the aggregate that was modified.
	AggregateID string `json:"aggregateID,omitempty"`

	// AggregateType is the type of the aggregate that was modified.
	AggregateType string `json:"aggregateType,omitempty"`

	// Version is the new version of the aggregate after the command.
	Version int `json:"version,omitempty"`

	// Payload is an optional result payload (e.g. generated ID, summary).
	Payload any `json:"payload,omitempty"`

	// Events are the domain events produced by this command.
	Events []events.DomainEvent `json:"-"`
}

// CommandHandler processes a single Command and returns its typed result.
// The generic types C and R are the command type and result type respectively.
type CommandHandler[C any, R any] interface {
	// Execute runs the command and returns its result.
	// On failure, the result may be a zero-value R with an error.
	Execute(ctx context.Context, cmd C) (R, error)
}

// ---------------------------------------------------------------------------
// Command Bus
// ---------------------------------------------------------------------------

// CommandBus dispatches Command objects to their registered handlers.
//
// Design note: the bus mirrors the QueryBus pattern for symmetry. Handlers
// are registered by command type name (e.g. "ActivatePipelineCommand") and
// resolved at dispatch time. In production this can be extended with
// middleware (validation, auth, tracing, retry) without changing the model.
type CommandBus struct {
	handlers map[string]any
}

// NewCommandBus creates a new, empty CommandBus.
func NewCommandBus() *CommandBus {
	return &CommandBus{handlers: make(map[string]any)}
}

// Register registers a command handler for the given command type name.
// The name is derived from the concrete command struct's type
// (e.g. "ActivatePipelineCommand").
func (b *CommandBus) Register(name string, handler any) {
	b.handlers[name] = handler
}

// Resolve returns the handler registered for the given command type name.
// Returns nil if no handler is registered.
func (b *CommandBus) Resolve(name string) any {
	return b.handlers[name]
}

// ---------------------------------------------------------------------------
// baseCommand — shared embedding struct that provides tenantID and validation
// ---------------------------------------------------------------------------

// baseCommand provides the GetTenantID() implementation for all commands.
// Embed this struct in concrete command types to avoid repeating tenantID.
type baseCommand struct {
	tenantID string
}

// GetTenantID returns the tenant ID for multi-tenant isolation.
func (b *baseCommand) GetTenantID() string { return b.tenantID }

// requireTenant validates that tenantID is set.
// Call this from concrete command Validate() methods.
func requireTenant(tenantID string) error {
	if tenantID == "" {
		return errors.New("tenantID is required")
	}
	return nil
}

// requireID validates that a resource ID is set.
// Call this from concrete command Validate() methods.
func requireID(id string, name string) error {
	if id == "" {
		return errors.New(name + " is required")
	}
	return nil
}

// ---------------------------------------------------------------------------
// Command helper — execute flow documentation
// ---------------------------------------------------------------------------

// Each command handler implements the standard execution flow:
//   1. Validate command via cmd.Validate()
//   2. Load aggregate from EventStore.GetByAggregate (rebuild from events)
//   3. Execute domain method on aggregate → collect new event(s)
//   4. EventStore.Append(events) — persist atomically
//   5. EventPublisher.Publish(events) — broadcast to subscribers
//   6. Return CommandResult with version and events
//
// This pattern is implemented inline in each handler to allow per-handler
// customization (e.g. CreateApprovalCommand builds a fresh aggregate rather
// than loading from event stream).
