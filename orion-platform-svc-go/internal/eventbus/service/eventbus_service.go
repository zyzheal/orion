package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/eventbus/models"
	"orion/platform-svc-go/internal/eventbus/repository"

	"go.uber.org/zap"
)

var (
	ErrSubscriptionNotFound = errors.New("subscription not found")
	ErrEventLogNotFound     = errors.New("event log not found")
	ErrInvalidInput         = errors.New("invalid input")
)

// EventBusService provides business logic for the Event Bus domain.
// It wraps the EventBusRepository and handles subscription CRUD, event publishing,
// retry logic, stats, and config management.
type EventBusService struct {
	repo   *repository.EventBusRepository
	nats   NATSPublisher
	logger *zap.Logger
}

// NATSPublisher is the interface for publishing events to NATS.
type NATSPublisher interface {
	IsConnected() bool
	Publish(ctx context.Context, subject string, data []byte, headers map[string]string) error
}

// NewEventBusService creates a new EventBusService instance.
func NewEventBusService(repo *repository.EventBusRepository, natsClient NATSPublisher, logger *zap.Logger) *EventBusService {
	return &EventBusService{repo: repo, nats: natsClient, logger: logger}
}

// ---------- Subscription operations ----------

// Subscribe creates a new event subscription after validating inputs.
func (s *EventBusService) Subscribe(ctx context.Context, tenantID string, req *models.CreateSubscriptionRequest) (*models.EventSubscription, error) {
	if tenantID == "" || req.EventType == "" {
		return nil, fmt.Errorf("%w: tenant_id and event_type are required", ErrInvalidInput)
	}
	if req.Handler == "" {
		return nil, fmt.Errorf("%w: handler is required", ErrInvalidInput)
	}
	return s.repo.Subscribe(ctx, tenantID, req.EventType, req.Handler)
}

// Unsubscribe removes an event subscription by ID.
func (s *EventBusService) Unsubscribe(ctx context.Context, tenantID, id string) error {
	if tenantID == "" || id == "" {
		return fmt.Errorf("%w: tenant_id and id are required", ErrInvalidInput)
	}
	deleted, err := s.repo.Unsubscribe(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrSubscriptionNotFound
	}
	return nil
}

// UpdateSubscriptionEnabled toggles the enabled state of a subscription.
func (s *EventBusService) UpdateSubscriptionEnabled(ctx context.Context, tenantID, id string, enabled bool) (*models.EventSubscription, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("%w: tenant_id and id are required", ErrInvalidInput)
	}
	_, err := s.repo.GetSubscriptionByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrSubscriptionNotFound
	}
	return s.repo.UpdateSubscriptionEnabled(ctx, tenantID, id, enabled)
}

// GetSubscriptions returns subscriptions for a tenant, optionally filtered by event type.
func (s *EventBusService) GetSubscriptions(ctx context.Context, tenantID string, eventType *string) ([]models.EventSubscription, error) {
	return s.repo.GetSubscriptions(ctx, tenantID, eventType)
}

// GetSubscriptionByID returns a single subscription.
func (s *EventBusService) GetSubscriptionByID(ctx context.Context, tenantID, id string) (*models.EventSubscription, error) {
	sub, err := s.repo.GetSubscriptionByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrSubscriptionNotFound
	}
	return sub, nil
}

// CountSubscriptions returns the total count for a tenant.
func (s *EventBusService) CountSubscriptions(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountSubscriptions(ctx, tenantID)
}

// ---------- Event publishing operations ----------

// PublishEvent logs a new event and publishes to NATS with CloudEvents 1.0 envelope.
// Dual-write: DB first (pending_published), then NATS (fire-and-forget).
func (s *EventBusService) PublishEvent(ctx context.Context, tenantID string, req *models.PublishEventRequest) (*models.EventLog, error) {
	if tenantID == "" || req.EventType == "" {
		return nil, fmt.Errorf("%w: tenant_id and event_type are required", ErrInvalidInput)
	}
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidInput, err)
	}
	payload := req.Payload
	if payload == nil {
		payload = models.JSONB{}
	}

	subject := req.EventType
	source := "orion-platform-svc-go"

	// Step 1: Persist to DB with pending_published status (sequence_num auto-generated)
	logEntry, err := s.repo.LogEvent(ctx, tenantID, req.EventType, subject, source, "", payload)
	if err != nil {
		return nil, err
	}

	// Step 2: Build CloudEvents 1.0 envelope
	envelope := map[string]interface{}{
		"id":              logEntry.ID,
		"source":          source,
		"specversion":     "1.0",
		"type":            req.EventType,
		"datacontenttype": "application/json",
		"data":            payload,
		"time":            logEntry.CreatedAt.Format(time.RFC3339),
		"tenantid":        tenantID,
	}

	// Step 3: Dual-write to NATS (fire-and-forget)
	if s.nats != nil && s.nats.IsConnected() {
		go func() {
			body, _ := json.Marshal(envelope)
			_ = s.nats.Publish(context.Background(), subject, body, map[string]string{
				"tenant_id": tenantID,
			})
		}()
	}

	return logEntry, nil
}

// GetEventHistory returns recent event logs for a tenant.
func (s *EventBusService) GetEventHistory(ctx context.Context, tenantID string, limit int) ([]models.EventLog, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}
	return s.repo.GetEventLogs(ctx, tenantID, limit)
}

// GetEventByID returns a single event log.
func (s *EventBusService) GetEventByID(ctx context.Context, tenantID, id string) (*models.EventLog, error) {
	logEntry, err := s.repo.GetEventLogByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrEventLogNotFound
	}
	return logEntry, nil
}

// MarkEventProcessed marks an event as processed.
func (s *EventBusService) MarkEventProcessed(ctx context.Context, tenantID, id string) error {
	if tenantID == "" || id == "" {
		return fmt.Errorf("%w: tenant_id and id are required", ErrInvalidInput)
	}
	return s.repo.MarkEventProcessed(ctx, tenantID, id)
}

// RetryPendingEvents retries publishing pending events to NATS.
// Fetches events with status pending_fallback or pending_published,
// re-publishes to NATS, and updates status accordingly.
// Aligned with TS EventBusService retryPendingEvents.
func (s *EventBusService) RetryPendingEvents(ctx context.Context, limit int, maxRetryCount int) (int, error) {
	if limit <= 0 {
		limit = 100
	}
	if maxRetryCount <= 0 {
		maxRetryCount = 3
	}

	events, err := s.repo.FindPendingFallbackEvents(ctx, limit, maxRetryCount)
	if err != nil {
		return 0, err
	}

	retried := 0
	for _, event := range events {
		if s.nats != nil && s.nats.IsConnected() {
			envelope := map[string]interface{}{
				"id":              event.ID,
				"source":          event.Source,
				"specversion":     "1.0",
				"type":            event.EventType,
				"datacontenttype": "application/json",
				"data":            event.Payload,
				"time":            event.PublishedAt.Format(time.RFC3339),
				"tenantid":        event.TenantID,
			}
			body, _ := json.Marshal(envelope)
			err := s.nats.Publish(context.Background(), event.Subject, body, map[string]string{
				"tenant_id": event.TenantID,
			})
			if err != nil {
				s.logger.Error("retry publish failed", zap.Error(err))
			}
			retried++
		} else {
			if event.RetryCount+1 >= maxRetryCount {
				_, _ = s.repo.UpdateEventStatus(ctx, event.ID, models.EventStatusDeadLetter)
			}
		}
	}

	return retried, nil
}

// GetPendingEventsCount returns the count of pending events for monitoring.
func (s *EventBusService) GetPendingEventsCount(ctx context.Context) (int, error) {
	return s.repo.CountByStatus(ctx, models.EventStatusPendingPublished)
}

// GetEventStats returns event statistics by status.
func (s *EventBusService) GetEventStats(ctx context.Context) (map[models.EventStatus]int, error) {
	stats := make(map[models.EventStatus]int)
	statuses := []models.EventStatus{
		models.EventStatusPendingPublished,
		models.EventStatusPublished,
		models.EventStatusDelivered,
		models.EventStatusPendingFallback,
		models.EventStatusFailed,
	}
	for _, status := range statuses {
		count, err := s.repo.CountByStatus(ctx, status)
		if err != nil {
			return nil, err
		}
		stats[status] = count
	}
	return stats, nil
}

// ---------- NATS operations ----------

// IsNATSConnected returns whether NATS is available.
func (s *EventBusService) IsNATSConnected() bool {
	if s.nats == nil {
		return false
	}
	return s.nats.IsConnected()
}

// ---------- Config operations ----------

// GetConfigs returns all event bus config entries.
func (s *EventBusService) GetConfigs(ctx context.Context) ([]models.EventBusConfig, error) {
	return s.repo.GetAllConfigs(ctx)
}

// GetConfigByKey returns a config entry by key.
func (s *EventBusService) GetConfigByKey(ctx context.Context, key string) (*models.EventBusConfig, error) {
	return s.repo.FindConfigByKey(ctx, key)
}

// UpsertConfig creates or updates a config entry.
func (s *EventBusService) UpsertConfig(ctx context.Context, key string, value models.JSONB, description *string) (*models.EventBusConfig, error) {
	return s.repo.UpsertConfig(ctx, key, value, description)
}

// ---------- Repo getter ----------

// Repo returns the underlying repository (for handler access to new methods).
func (s *EventBusService) Repo() *repository.EventBusRepository {
	return s.repo
}
