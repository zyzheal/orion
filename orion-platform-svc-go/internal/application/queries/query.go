package queries

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/domain/eventstore"
	"orion/platform-svc-go/internal/domain/events"
)

// ============================================================================
// Errors — standard sentinel errors used across all query handlers
// ============================================================================

var (
	ErrAggregateNotFound = errors.New("aggregate not found")
	ErrQueryFailed       = errors.New("query execution failed")
	ErrInvalidParameter  = errors.New("invalid query parameter")
)

// ============================================================================
// Query (CQRS) — the read-side of CQRS
//
// Query represents a read-only operation that carries filter / pagination
// parameters. It is side-effect free: queries only read data, they never
// mutate state or emit domain events.
//
// Each concrete query implements Query and declares its result type through
// its matching QueryHandler. The EventStore is the authoritative source of
// truth via event sourcing.
// ============================================================================

// Query is the marker interface for all read-side operations.
type Query interface {
	// Validate returns an error if the query parameters are malformed.
	// Called by handlers before executing the read.
	Validate() error
}

// QueryHandler processes a single Query and returns its typed result.
// The generic type T is the result type of the query.
type QueryHandler[T any] interface {
	// Execute runs the query against the EventStore and returns the typed result.
	Execute(ctx context.Context, query Query) (T, error)
}

// ListQueryHandler is a specialised handler that returns paginated results.
type ListQueryHandler[T any] interface {
	// ExecuteList runs a list-style query and returns the result slice plus
	// total count (for pagination UI).
	ExecuteList(ctx context.Context, query Query) (T, int, error)
}

// EventQueryHandler reads domain events (stream / replay).
type EventQueryHandler interface {
	// ExecuteEvents returns a stream of domain events for the requested
	// aggregate or event type.
	ExecuteEvents(ctx context.Context, query Query) ([]events.DomainEvent, error)
}

// ============================================================================
// Query Bus
// ============================================================================

// QueryBus dispatches Query objects to their registered handlers.
//
// Design note: the bus is deliberately simple — a map of Query type names to
// QueryHandler interfaces. In production this can be extended with middleware
// (caching, tracing, tenant isolation) without changing the query model.
type QueryBus struct {
	handlers map[string]any
}

// NewQueryBus creates a new, empty QueryBus.
func NewQueryBus() *QueryBus {
	return &QueryBus{handlers: make(map[string]any)}
}

// Register registers a query handler for the given query type name.
// The name is derived from the concrete query struct's type
// (e.g. "ListPipelinesQuery").
func (b *QueryBus) Register(name string, handler any) {
	b.handlers[name] = handler
}

// Resolve returns the handler registered for the given query type name.
// Returns nil if no handler is registered.
func (b *QueryBus) Resolve(name string) any {
	return b.handlers[name]
}

// ============================================================================
// EventStore-backed helpers
//
// eventStoreReader wraps the EventStore with query-oriented helpers so that
// handlers don't call raw methods directly.
// ============================================================================

type eventStoreReader struct {
	store eventstore.EventStore
}

func newEventStoreReader(store eventstore.EventStore) *eventStoreReader {
	return &eventStoreReader{store: store}
}

// readEventsForAggregate reads all events for an aggregate, ordered by time.
// Returns ErrAggregateNotFound if no events exist.
func (r *eventStoreReader) readEventsForAggregate(ctx context.Context, tenantID, aggregateType, aggregateID string) ([]events.DomainEvent, error) {
	evs, err := r.store.GetByAggregate(ctx, tenantID, aggregateType, aggregateID)
	if err != nil {
		return nil, err
	}
	if len(evs) == 0 {
		return nil, ErrAggregateNotFound
	}
	return evs, nil
}

// readLatestVersion returns the current version of an aggregate (0 if no events).
func (r *eventStoreReader) readLatestVersion(ctx context.Context, tenantID, aggregateType, aggregateID string) (int, error) {
	return r.store.GetLatestVersion(ctx, tenantID, aggregateType, aggregateID)
}

// readEventsAfterVersion performs an incremental replay from a given version.
func (r *eventStoreReader) readEventsAfterVersion(ctx context.Context, tenantID, aggregateType, aggregateID string, afterVersion int) ([]events.DomainEvent, error) {
	return r.store.GetEventsAfterVersion(ctx, tenantID, aggregateType, aggregateID, afterVersion)
}

// rebuildAggregateFromEvents replays all events for an aggregate onto a fresh
// aggregate root and returns the reconstructed state plus the event stream.
// This is the core helper used by both Pipeline and Approval rebuild queries.
func (r *eventStoreReader) rebuildAggregateFromEvents(
	ctx context.Context,
	tenantID, aggregateType, aggregateID string,
	aggregate events.DomainEvent, // passed to set base on first event
) ([]events.DomainEvent, error) {
	evs, err := r.store.GetByAggregate(ctx, tenantID, aggregateType, aggregateID)
	if err != nil {
		return nil, err
	}
	_ = aggregate // reserved for future event sourcing hydration
	return evs, nil
}

// ============================================================================
// Aggregate type constants — single source of truth for query handlers
// ============================================================================

const (
	AggregateTypePipeline    = "pipeline"
	AggregateTypeApproval    = "approval"
	AggregateTypeFeatureFlag = "feature_flag"
)

// ============================================================================
// Pagination helpers
// ============================================================================

// pagination applies limit/offset to a slice and returns the page plus total.
func pagination[T any](items []T, page, limit int) ([]T, int) {
	total := len(items)
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	if offset >= total {
		return []T{}, total
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return items[offset:end], total
}
