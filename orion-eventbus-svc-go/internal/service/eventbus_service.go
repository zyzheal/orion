package service

import (
	"context"
	"time"

	natspkg "orion/eventbus-svc-go/internal"
	"orion/eventbus-svc-go/internal/model"
	"orion/eventbus-svc-go/internal/repository"
	"go.uber.org/zap"
)

type EventBusService struct {
	repo *repository.EventBusRepository
	nats *natspkg.NATSClient
	log  *zap.Logger
}

func NewEventBusService(repo *repository.EventBusRepository, nats *natspkg.NATSClient, log *zap.Logger) *EventBusService {
	return &EventBusService{repo: repo, nats: nats, log: log}
}

func (s *EventBusService) PublishEvent(ctx context.Context, e *model.Event) error {
	e.CreatedAt = time.Now()

	// Dual-write: PostgreSQL (source of truth) + NATS JetStream (messaging)
	if err := s.repo.CreateEvent(ctx, e); err != nil {
		return err
	}

	// Best-effort NATS publish (do not block DB write on messaging failure)
	if s.nats != nil {
		if pubErr := s.nats.Publish(ctx, e); pubErr != nil {
			s.log.Warn("nats publish failed, event persisted to DB",
				zap.String("event_id", e.ID),
				zap.Error(pubErr),
			)
		}
	}

	return nil
}

func (s *EventBusService) ListEvents(ctx context.Context, tenantID, eventType string, page, pageSize int) ([]model.Event, error) {
	return s.repo.ListEvents(ctx, tenantID, eventType, page, pageSize)
}

func (s *EventBusService) CreateSubscription(ctx context.Context, sub *model.Subscription) error {
	sub.CreatedAt = time.Now()
	sub.UpdatedAt = time.Now()
	return s.repo.CreateSubscription(ctx, sub)
}

func (s *EventBusService) GetSubscription(ctx context.Context, id string) (*model.Subscription, error) {
	return s.repo.FindSubscriptionByID(ctx, id)
}

func (s *EventBusService) ListSubscriptions(ctx context.Context, tenantID string) ([]model.Subscription, error) {
	return s.repo.ListSubscriptions(ctx, tenantID)
}

func (s *EventBusService) RecordDelivery(ctx context.Context, d *model.EventDelivery) error {
	d.CreatedAt = time.Now()
	return s.repo.CreateEventDelivery(ctx, d)
}

func (s *EventBusService) UpdateDelivery(ctx context.Context, d *model.EventDelivery) error {
	now := time.Now()
	d.DeliveredAt = &now
	return s.repo.UpdateEventDelivery(ctx, d)
}
