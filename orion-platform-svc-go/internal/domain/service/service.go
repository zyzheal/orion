package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/domain/commands"
	"orion/platform-svc-go/internal/domain/events"
	"orion/platform-svc-go/internal/domain/eventstore"
	"orion/platform-svc-go/internal/domain/readmodel"

	"go.uber.org/zap"
)

type Service struct {
	bus        commands.CommandBus
	publisher  events.EventPublisher
	eventStore eventstore.EventStore
	proj       *readmodel.PostgresReadModelProjector
	logger     *zap.Logger
}

func NewService(
	bus commands.CommandBus,
	publisher events.EventPublisher,
	eventStore eventstore.EventStore,
	proj *readmodel.PostgresReadModelProjector,
	logger *zap.Logger,
) *Service {
	return &Service{bus: bus, publisher: publisher, eventStore: eventStore, proj: proj, logger: logger}
}

func (s *Service) GetRunByID(ctx context.Context, runID string) (*readmodel.PipelineRunProjection, error) {
	if s.proj == nil { return nil, nil }
	return s.proj.GetRunByID(ctx, runID)
}

func (s *Service) ListRunsByPipeline(ctx context.Context, tenantID, pipelineID string, limit, offset int) ([]readmodel.PipelineRunProjection, error) {
	if s.proj == nil { return nil, nil }
	return s.proj.ListRunsByPipeline(ctx, tenantID, pipelineID, limit, offset)
}

func (s *Service) GetLatestVersion(ctx context.Context, tenantID, aggregateType, aggregateID string) (int, error) {
	if s.eventStore == nil { return 0, nil }
	return s.eventStore.GetLatestVersion(ctx, tenantID, aggregateType, aggregateID)
}

func (s *Service) GetEventHistory(ctx context.Context, tenantID, aggregateType, aggregateID string) ([]events.DomainEvent, error) {
	if s.eventStore == nil { return nil, nil }
	return s.eventStore.GetByAggregate(ctx, tenantID, aggregateType, aggregateID)
}

func (s *Service) DispatchCommand(ctx context.Context, cmd commands.Command) error {
	if s.bus == nil { return nil }
	return s.bus.Send(ctx, cmd)
}

func (s *Service) PublishEvent(ctx context.Context, evt events.DomainEvent) error {
	if s.publisher == nil { return nil }
	return s.publisher.Publish(ctx, evt)
}

func (s *Service) RebuildReadModel(ctx context.Context) error {
	if s.proj == nil { return nil }
	return s.proj.Rebuild(ctx, time.Now().AddDate(0, 0, -1))
}
