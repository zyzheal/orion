package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/domain/events"
	"orion/platform-svc-go/internal/domain/eventstore"
	"orion/platform-svc-go/internal/domain/readmodel"
)

type Repository struct {
	eventStore eventstore.EventStore
	proj       *readmodel.PostgresReadModelProjector
}

func NewRepository(es eventstore.EventStore, proj *readmodel.PostgresReadModelProjector) *Repository {
	return &Repository{eventStore: es, proj: proj}
}

func (r *Repository) Append(ctx context.Context, evt ...events.DomainEvent) error {
	if r.eventStore == nil { return nil }
	return r.eventStore.Append(ctx, evt...)
}

func (r *Repository) GetByAggregate(ctx context.Context, tenantID, aggregateType, aggregateID string) ([]events.DomainEvent, error) {
	if r.eventStore == nil { return nil, nil }
	return r.eventStore.GetByAggregate(ctx, tenantID, aggregateType, aggregateID)
}

func (r *Repository) GetLatestVersion(ctx context.Context, tenantID, aggregateType, aggregateID string) (int, error) {
	if r.eventStore == nil { return 0, nil }
	return r.eventStore.GetLatestVersion(ctx, tenantID, aggregateType, aggregateID)
}

func (r *Repository) GetRunByID(ctx context.Context, runID string) (*readmodel.PipelineRunProjection, error) {
	if r.proj == nil { return nil, nil }
	return r.proj.GetRunByID(ctx, runID)
}

func (r *Repository) ListRunsByPipeline(ctx context.Context, tenantID, pipelineID string, limit, offset int) ([]readmodel.PipelineRunProjection, error) {
	if r.proj == nil { return nil, nil }
	return r.proj.ListRunsByPipeline(ctx, tenantID, pipelineID, limit, offset)
}

func (r *Repository) Rebuild(ctx context.Context) error {
	if r.proj == nil { return nil }
	return r.proj.Rebuild(ctx, time.Now().AddDate(0, 0, -1))
}
