package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"
	"orion/event-bus-svc-go/internal/models"
	"orion/event-bus-svc-go/internal/nats"
	"orion/event-bus-svc-go/internal/repository"
)

var (
	ErrSubscriptionNotFound = errors.New("subscription not found")
	ErrEventLogNotFound     = errors.New("event log not found")
	ErrInvalidInput         = errors.New("invalid input")
)

// Service provides business logic for the Event Bus domain.
type Service struct {
	repo *repository.Repository
	nats *nats.Client
}

// NewService creates a new Service instance.
func NewService(repo *repository.Repository, natsClient *nats.Client) *Service {
	return &Service{repo: repo, nats: natsClient}
}

// ---------- Subscription operations ----------

// Subscribe creates a new event subscription after validating inputs.
func (s *Service) Subscribe(ctx context.Context, tenantID string, req *models.CreateSubscriptionRequest) (*models.EventSubscription, error) {
	if tenantID == "" || req.EventType == "" {
		return nil, fmt.Errorf("%w: tenant_id and event_type are required", ErrInvalidInput)
	}
	if req.Handler == "" {
		return nil, fmt.Errorf("%w: handler is required", ErrInvalidInput)
	}
	return s.repo.Subscribe(ctx, tenantID, req.EventType, req.Handler)
}

// Unsubscribe removes an event subscription by ID.
func (s *Service) Unsubscribe(ctx context.Context, tenantID, id string) error {
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
func (s *Service) UpdateSubscriptionEnabled(ctx context.Context, tenantID, id string, enabled bool) (*models.EventSubscription, error) {
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
func (s *Service) GetSubscriptions(ctx context.Context, tenantID string, eventType *string) ([]models.EventSubscription, error) {
	return s.repo.GetSubscriptions(ctx, tenantID, eventType)
}

// GetSubscriptionByID returns a single subscription.
func (s *Service) GetSubscriptionByID(ctx context.Context, tenantID, id string) (*models.EventSubscription, error) {
	sub, err := s.repo.GetSubscriptionByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrSubscriptionNotFound
	}
	return sub, nil
}

// CountSubscriptions returns the total count for a tenant.
func (s *Service) CountSubscriptions(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountSubscriptions(ctx, tenantID)
}

// ---------- Event publishing operations ----------

// Publish logs a new event and publishes to NATS with CloudEvents 1.0 envelope.
// Dual-write: DB first (pending_published), then NATS (fire-and-forget).
// Sequence number is auto-generated via event_bus_seq (aligned with TS).
func (s *Service) Publish(ctx context.Context, tenantID string, req *models.PublishEventRequest) (*models.EventLog, error) {
	if tenantID == "" || req.EventType == "" {
		return nil, fmt.Errorf("%w: tenant_id and event_type are required", ErrInvalidInput)
	}
	payload := req.Payload
	if payload == nil {
		payload = models.JSONB{}
	}

	subject := req.EventType
	source := "orion-event-bus-svc"

	// Step 1: Persist to DB with pending_published status (sequence_num auto-generated)
	logEntry, err := s.repo.LogEvent(ctx, tenantID, req.EventType, subject, source, "", payload)
	if err != nil {
		return nil, err
	}

	// Step 2: Build CloudEvents 1.0 envelope (aligned with TS EventBusService)
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
func (s *Service) GetEventHistory(ctx context.Context, tenantID string, limit int) ([]models.EventLog, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}
	return s.repo.GetEventLogs(ctx, tenantID, limit)
}

// GetEventByID returns a single event log.
func (s *Service) GetEventByID(ctx context.Context, tenantID, id string) (*models.EventLog, error) {
	logEntry, err := s.repo.GetEventLogByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrEventLogNotFound
	}
	return logEntry, nil
}

// MarkEventProcessed marks an event as processed.
func (s *Service) MarkEventProcessed(ctx context.Context, tenantID, id string) error {
	if tenantID == "" || id == "" {
		return fmt.Errorf("%w: tenant_id and id are required", ErrInvalidInput)
	}
	return s.repo.MarkEventProcessed(ctx, tenantID, id)
}

// RetryPendingEvents retries publishing pending events to NATS.
// Fetches events with status pending_fallback or pending_published,
// re-publishes to NATS, and updates status accordingly.
// Aligned with TS EventBusService retryPendingEvents.
func (s *Service) RetryPendingEvents(ctx context.Context, limit int, maxRetryCount int) (int, error) {
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
		// Re-publish to NATS
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
			_ = s.nats.Publish(context.Background(), event.Subject, body, map[string]string{
				"tenant_id": event.TenantID,
			})
			// Update status to published on successful NATS publish attempt
			_, _ = s.repo.UpdateEventStatus(ctx, event.ID, models.EventStatusPublished)
			// Increment retry count
			_, _ = s.repo.IncrementRetryCount(ctx, event.ID)
			retried++
		} else {
			// NATS still unavailable, mark as failed if max retries exceeded
			if event.RetryCount+1 >= maxRetryCount {
				_, _ = s.repo.UpdateEventStatus(ctx, event.ID, models.EventStatusDeadLetter)
			}
		}
	}

	return retried, nil
}

// GetPendingEventsCount returns the count of pending events for monitoring.
func (s *Service) GetPendingEventsCount(ctx context.Context) (int, error) {
	return s.repo.CountByStatus(ctx, models.EventStatusPendingPublished)
}

// GetEventStats returns event statistics by status.
func (s *Service) GetEventStats(ctx context.Context) (map[models.EventStatus]int, error) {
	stats := make(map[models.EventStatus]int)
	statuses := []models.EventStatus{
		models.EventStatusPendingPublished,
		models.EventStatusPublished,
		models.EventStatusDelivered,
		models.EventStatusPendingFallback,
		models.EventStatusFailed,
		models.EventStatusDeadLetter,
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

// IsNATSConnected returns whether NATS is available
func (s *Service) IsNATSConnected() bool {
	if s.nats == nil {
		return false
	}
	return s.nats.IsConnected()
}

// ---------- Config operations (aligned with TS EventBusConfigRepository) ----------

// GetConfigs returns all event bus config entries.
func (s *Service) GetConfigs(ctx context.Context) ([]models.EventBusConfig, error) {
	return s.repo.GetAllConfigs(ctx)
}

// GetConfigByKey returns a config entry by key.
func (s *Service) GetConfigByKey(ctx context.Context, key string) (*models.EventBusConfig, error) {
	return s.repo.FindConfigByKey(ctx, key)
}

// UpsertConfig creates or updates a config entry.
func (s *Service) UpsertConfig(ctx context.Context, key string, value models.JSONB, description *string) (*models.EventBusConfig, error) {
	return s.repo.UpsertConfig(ctx, key, value, description)
}

// Repo returns the underlying repository (for handler access to new methods).
func (s *Service) Repo() *repository.Repository {
	return s.repo
}
