package commands

import (
	"context"

	"orion/platform-svc-go/internal/application/queries"
	"orion/platform-svc-go/internal/domain/aggregates"
	"orion/platform-svc-go/internal/domain/eventstore"
)

// ---------------------------------------------------------------------------
// Reusable aggregate loader for all command handlers.
//
// Each command handler used to duplicate 3-4 loadAggregate methods with
// identical logic. These functions extract that pattern once.
// ---------------------------------------------------------------------------

// loadPipelineAggregate loads the event stream and rebuilds a PipelineAggregate
// by replaying all events onto a fresh instance.
func loadPipelineAggregate(store eventstore.EventStore, ctx context.Context, tenantID, aggregateID string) (*aggregates.PipelineAggregate, error) {
	evs, err := store.GetByAggregate(ctx, tenantID, queries.AggregateTypePipeline, aggregateID)
	if err != nil {
		return nil, err
	}
	if len(evs) == 0 {
		return nil, ErrAggregateNotFound
	}
	agg := &aggregates.PipelineAggregate{
		BaseAggregate: aggregates.BaseAggregate{
			AggregateID:   aggregateID,
			AggregateType: queries.AggregateTypePipeline,
			TenantID:      tenantID,
		},
	}
	for _, ev := range evs {
		agg.Apply(ev)
	}
	return agg, nil
}

// loadApprovalAggregate loads the event stream and rebuilds an ApprovalAggregate
// by replaying all events onto a fresh instance.
func loadApprovalAggregate(store eventstore.EventStore, ctx context.Context, tenantID, aggregateID string) (*aggregates.ApprovalAggregate, error) {
	evs, err := store.GetByAggregate(ctx, tenantID, queries.AggregateTypeApproval, aggregateID)
	if err != nil {
		return nil, err
	}
	if len(evs) == 0 {
		return nil, ErrAggregateNotFound
	}
	agg := &aggregates.ApprovalAggregate{
		BaseAggregate: aggregates.BaseAggregate{
			AggregateID:   aggregateID,
			AggregateType: queries.AggregateTypeApproval,
			TenantID:      tenantID,
		},
	}
	for _, ev := range evs {
		agg.Apply(ev)
	}
	return agg, nil
}

// loadFeatureFlagAggregate loads the event stream and rebuilds a FeatureFlagAggregate
// by replaying all events onto a fresh instance.
func loadFeatureFlagAggregate(store eventstore.EventStore, ctx context.Context, tenantID, flagKey string) (*aggregates.FeatureFlagAggregate, error) {
	evs, err := store.GetByAggregate(ctx, tenantID, queries.AggregateTypeFeatureFlag, flagKey)
	if err != nil {
		return nil, err
	}
	if len(evs) == 0 {
		return nil, ErrAggregateNotFound
	}
	agg := &aggregates.FeatureFlagAggregate{
		BaseAggregate: aggregates.BaseAggregate{
			AggregateID:   flagKey,
			AggregateType: queries.AggregateTypeFeatureFlag,
			TenantID:      tenantID,
		},
	}
	for _, ev := range evs {
		agg.Apply(ev)
	}
	return agg, nil
}
