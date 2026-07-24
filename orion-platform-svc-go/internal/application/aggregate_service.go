package application

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"orion/platform-svc-go/internal/domain/aggregates"
	"orion/platform-svc-go/internal/domain/eventstore"
)

// AggregateService encapsulates aggregate root lifecycle: creation, persistence
// (via EventStore) and reconstruction (replay from EventStore). It is the
// application-layer façade that command handlers use to work with aggregates.
type AggregateService struct {
	store          eventstore.EventStore
	snapshotStore  eventstore.SnapshotStore
	snapshotPeriod int // save snapshot every N versions
}

// Aggregate type constants — single source of truth for aggregate identification.
// These match the values used when events are persisted so that rebuild queries
// and command handlers stay in sync.
const (
	AggregateTypePipeline    = "pipeline"
	AggregateTypeApproval    = "approval"
	AggregateTypeFeatureFlag = "feature_flag"
)

// NewAggregateService creates an AggregateService backed by the given EventStore.
func NewAggregateService(store eventstore.EventStore) *AggregateService {
	return NewAggregateServiceWithSnapshot(store, nil, 0)
}

// NewAggregateServiceWithSnapshot creates an AggregateService with optional SnapshotStore.
func NewAggregateServiceWithSnapshot(
	store eventstore.EventStore,
	snapshotStore eventstore.SnapshotStore,
	snapshotPeriod int,
) *AggregateService {
	return &AggregateService{
		store:         store,
		snapshotStore:  snapshotStore,
		snapshotPeriod: snapshotPeriod,
	}
}

// When snapshotStore is non-nil, rebuild first loads the latest snapshot, then replays
// only events after the snapshot version.  snapshotPeriod > 0 enables periodic saves.

// ===========================================================================
// Factory methods — create fresh aggregate roots with type metadata set.
// ===========================================================================

// NewPipelineAggregate creates a blank PipelineAggregate identified by the
// given type and ID. Call RebuildPipeline to hydrate an existing aggregate
// from the event store.
func (s *AggregateService) NewPipelineAggregate() *aggregates.PipelineAggregate {
	return &aggregates.PipelineAggregate{
		BaseAggregate: aggregates.BaseAggregate{
			AggregateType: AggregateTypePipeline,
		},
	}
}

// NewApprovalAggregate creates a blank ApprovalAggregate.
func (s *AggregateService) NewApprovalAggregate() *aggregates.ApprovalAggregate {
	return &aggregates.ApprovalAggregate{
		BaseAggregate: aggregates.BaseAggregate{
			AggregateType: AggregateTypeApproval,
		},
	}
}

// NewFeatureFlagAggregate creates a blank FeatureFlagAggregate.
func (s *AggregateService) NewFeatureFlagAggregate() *aggregates.FeatureFlagAggregate {
	return &aggregates.FeatureFlagAggregate{
		BaseAggregate: aggregates.BaseAggregate{
			AggregateType: AggregateTypeFeatureFlag,
		},
	}
}

// ===========================================================================
// Rebuild methods — query EventStore and replay events onto a fresh aggregate.
// ===========================================================================

// RebuildPipeline reconstructs a PipelineAggregate from its stored events.
// Returns ErrAggregateNotFound if no events exist for the given ID.
func (s *AggregateService) RebuildPipeline(ctx context.Context, tenantID, pipelineID string) (*aggregates.PipelineAggregate, error) {
	agg, err := s.rebuildAggregate(ctx, tenantID, AggregateTypePipeline, pipelineID,
		func() aggregates.AggregateRoot { return s.NewPipelineAggregate() })
	if err != nil {
		return nil, err
	}
	return agg.(*aggregates.PipelineAggregate), nil
}

// RebuildApproval reconstructs an ApprovalAggregate from its stored events.
// Returns ErrAggregateNotFound if no events exist for the given ID.
func (s *AggregateService) RebuildApproval(ctx context.Context, tenantID, approvalID string) (*aggregates.ApprovalAggregate, error) {
	agg, err := s.rebuildAggregate(ctx, tenantID, AggregateTypeApproval, approvalID,
		func() aggregates.AggregateRoot { return s.NewApprovalAggregate() })
	if err != nil {
		return nil, err
	}
	return agg.(*aggregates.ApprovalAggregate), nil
}

// RebuildFeatureFlag reconstructs a FeatureFlagAggregate from its stored events.
// The flagKey is used as the aggregate ID. Returns ErrAggregateNotFound if no
// events exist for the given key.
func (s *AggregateService) RebuildFeatureFlag(ctx context.Context, tenantID, flagKey string) (*aggregates.FeatureFlagAggregate, error) {
	agg, err := s.rebuildAggregate(ctx, tenantID, AggregateTypeFeatureFlag, flagKey,
		func() aggregates.AggregateRoot { return s.NewFeatureFlagAggregate() })
	if err != nil {
		return nil, err
	}
	return agg.(*aggregates.FeatureFlagAggregate), nil
}

// ===========================================================================
// Generic rebuild
// ===========================================================================

// rebuildAggregate is the shared replay pipeline used by all typed rebuild
// methods. It queries the EventStore for every event belonging to the
// aggregate, creates a fresh root via the factory, applies each event in order,
// and returns the hydrated aggregate.
// rebuildAggregate is the shared replay pipeline used by all typed rebuild
// methods.  It first tries to load the latest snapshot (if SnapshotStore is
// configured), then replays only events newer than the snapshot version.
func (s *AggregateService) rebuildAggregate(
	ctx context.Context,
	tenantID, aggType, aggID string,
	factory func() aggregates.AggregateRoot,
) (aggregates.AggregateRoot, error) {
	if s.store == nil {
		return nil, errors.New("aggregate service: EventStore is nil")
	}

	agg := factory()
	agg.SetAggregateID(aggID)
	agg.SetTenantID(tenantID)

	// Step 1: Try to load the latest snapshot (if SnapshotStore is configured).
	snapshotVersion := 0
	if s.snapshotStore != nil {
		if snap, err := s.snapshotStore.GetLatest(ctx, tenantID, aggType, aggID); err == nil {
			snapshotVersion = snap.Version
			agg.SetVersion(snapshotVersion)
		}
		// ErrSnapshotNotFound is silently ignored — no snapshot means replay from scratch.
	}

	// Step 2: Replay events (skip those already captured by snapshot).
	evs, err := s.store.GetByAggregate(ctx, tenantID, aggType, aggID)
	if err != nil {
		return nil, err
	}
	if len(evs) == 0 {
		return nil, ErrAggregateNotFound
	}

	for _, ev := range evs {
		if ev.Version() <= snapshotVersion {
			continue // already captured by snapshot
		}
		agg.SetVersion(agg.GetVersion() + 1)
		agg.Apply(ev)
	}

	return agg, nil
}

// ErrAggregateNotFound is returned by rebuild methods when the aggregate has
// no events in the store.

// SaveSnapshot saves the current aggregate state as a snapshot, reducing future replay cost.
// Called after a command that pushes the aggregate past the configured snapshot period.
func (s *AggregateService) SaveSnapshot(ctx context.Context, agg aggregates.AggregateRoot) error {
	if s.snapshotStore == nil {
		return nil // snapshotting disabled
	}
	stateJSON, err := json.Marshal(agg.GetPendingEvents())
	if err != nil {
		return fmt.Errorf("marshal aggregate state: %w", err)
	}
	snap := &eventstore.Snapshot{
		AggregateType: agg.GetAggregateType(),
		AggregateID:   agg.GetAggregateID(),
		TenantID:      agg.GetTenantID(),
		Version:       agg.GetVersion(),
		State:         string(stateJSON),
	}
	return s.snapshotStore.Save(ctx, snap)
}

// ShouldSaveSnapshot returns true when a periodic snapshot should be written.
func (s *AggregateService) ShouldSaveSnapshot(agg aggregates.AggregateRoot) bool {
	if s.snapshotPeriod <= 0 || s.snapshotStore == nil {
		return false
	}
	return agg.GetVersion()%s.snapshotPeriod == 0
}

var ErrAggregateNotFound = errors.New("aggregate not found")
