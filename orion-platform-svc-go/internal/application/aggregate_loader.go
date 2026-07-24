package application

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/domain/aggregates"
	"orion/platform-svc-go/internal/domain/eventstore"
)

// AggregateLoader provides a generic method to load and reconstruct any
// aggregate root from the EventStore. This eliminates duplicated load logic
// across command handlers (P1-4).
type AggregateLoader struct {
	store eventstore.EventStore
}

// NewAggregateLoader creates a loader backed by the given EventStore.
func NewAggregateLoader(store eventstore.EventStore) *AggregateLoader {
	return &AggregateLoader{store: store}
}

// Load reconstructs an aggregate root from its stored events. The caller
// provides a factory that creates a fresh aggregate with the type metadata set.
// Returns ErrAggregateNotFound if no events exist for the given ID.
func (l *AggregateLoader) Load(
	ctx context.Context,
	tenantID, aggType, aggID string,
	factory func() aggregates.AggregateRoot,
) (aggregates.AggregateRoot, error) {
	if l.store == nil {
		return nil, errors.New("aggregate loader: EventStore is nil")
	}

	evs, err := l.store.GetByAggregate(ctx, tenantID, aggType, aggID)
	if err != nil {
		return nil, err
	}
	if len(evs) == 0 {
		return nil, ErrAggregateNotFound
	}

	agg := factory()
	agg.SetAggregateID(aggID)
	agg.SetTenantID(tenantID)
	agg.SetVersion(0)

	for i, ev := range evs {
		ev.SetVersion(i + 1)
		agg.Apply(ev)
	}

	return agg, nil
}
