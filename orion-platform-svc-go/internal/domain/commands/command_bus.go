// Package commands provides the command bus infrastructure for CQRS/event-driven
// processing.  Commands represent intent to change state; each command is routed
// to exactly one registered handler based on its CommandType.
package commands

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Command represents a request to perform an action on an aggregate.
type Command struct {
	// CommandID is a unique identifier for this command instance.
	CommandID string `json:"command_id"`

	// CommandType identifies the type of command (e.g., "pipeline.start").
	CommandType string `json:"command_type"`

	// AggregateID is the ID of the aggregate this command targets.
	AggregateID string `json:"aggregate_id"`

	// TenantID is the tenant for multi-tenant isolation.
	TenantID string `json:"tenant_id"`

	// Data carries the command payload as raw JSON bytes.
	Data json.RawMessage `json:"data"`

	// Timestamp is when the command was created.
	Timestamp time.Time `json:"timestamp"`
}

// NewCommand creates a new Command with a generated ID and the current timestamp.
func NewCommand(commandType, aggregateID, tenantID string, data json.RawMessage) Command {
	return Command{
		CommandID:   uuid.New().String(),
		CommandType: commandType,
		AggregateID: aggregateID,
		TenantID:    tenantID,
		Data:        data,
		Timestamp:   time.Now().UTC(),
	}
}

// CommandHandler processes a single command and returns an error if the
// operation could not be completed.
type CommandHandler interface {
	// Handle processes the given command.  Implementations should be idempotent
	// when possible.
	Handle(ctx context.Context, cmd Command) error
}

// CommandHandlerFunc is an adapter that turns a plain function into a
// CommandHandler.
type CommandHandlerFunc func(ctx context.Context, cmd Command) error

// Handle implements CommandHandler by calling the underlying function.
func (f CommandHandlerFunc) Handle(ctx context.Context, cmd Command) error {
	return f(ctx, cmd)
}

// CommandBus defines the interface for sending commands and registering
// handlers.  Each command type can have at most one registered handler.
type CommandBus interface {
	// Send dispatches a command to its registered handler.  Returns
	// ErrHandlerNotFound if no handler is registered for the command type.
	Send(ctx context.Context, cmd Command) error

	// RegisterHandler registers a handler for a specific command type.
	// If a handler is already registered for the same command type, it is
	// replaced.
	RegisterHandler(commandType string, handler CommandHandler)
}

// ErrHandlerNotFound is returned by Send when no handler has been registered
// for the command's CommandType.
var ErrHandlerNotFound = &HandlerNotFoundError{}

// HandlerNotFoundError indicates that no handler was registered for a command type.
type HandlerNotFoundError struct {
	CommandType string
}

func (e *HandlerNotFoundError) Error() string {
	if e.CommandType == "" {
		return "command handler not found"
	}
	return "no handler registered for command type: " + e.CommandType
}

// InMemoryCommandBus is a thread-safe, in-memory implementation of CommandBus.
// Handlers are stored in a sync.Map keyed by command type.
type InMemoryCommandBus struct {
	handlers sync.Map
}

// NewInMemoryCommandBus creates a new InMemoryCommandBus.
func NewInMemoryCommandBus() *InMemoryCommandBus {
	return &InMemoryCommandBus{}
}

// Send dispatches the command to the handler registered for cmd.CommandType.
// Returns ErrHandlerNotFound if no handler is registered.
func (b *InMemoryCommandBus) Send(ctx context.Context, cmd Command) error {
	if cmd.CommandID == "" {
		cmd.CommandID = uuid.New().String()
	}
	if cmd.Timestamp.IsZero() {
		cmd.Timestamp = time.Now().UTC()
	}

	handler, ok := b.handlers.Load(cmd.CommandType)
	if !ok {
		return &HandlerNotFoundError{CommandType: cmd.CommandType}
	}

	return handler.(CommandHandler).Handle(ctx, cmd)
}

// RegisterHandler stores a handler for the given command type.  If a handler
// already exists for this command type, it is replaced.
func (b *InMemoryCommandBus) RegisterHandler(commandType string, handler CommandHandler) {
	b.handlers.Store(commandType, handler)
}

// UnregisterHandler removes the handler for a command type.  This is a helper
// method not required by the CommandBus interface but useful for lifecycle
// management.
func (b *InMemoryCommandBus) UnregisterHandler(commandType string) {
	b.handlers.Delete(commandType)
}

// HandlerCount returns the number of registered handlers.  Useful for testing.
func (b *InMemoryCommandBus) HandlerCount() int {
	count := 0
	b.handlers.Range(func(_, _ interface{}) bool {
		count++
		return true
	})
	return count
}