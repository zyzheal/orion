package service

import (
	"context"
	"errors"
	"fmt"
	"orion/event-bus-svc-go/internal/models"
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
}

// NewService creates a new Service instance.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
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

// Publish logs a new event. If payload is nil, an empty object is stored.
func (s *Service) Publish(ctx context.Context, tenantID string, req *models.PublishEventRequest) (*models.EventLog, error) {
	if tenantID == "" || req.EventType == "" {
		return nil, fmt.Errorf("%w: tenant_id and event_type are required", ErrInvalidInput)
	}
	payload := req.Payload
	if payload == nil {
		payload = models.JSONB{}
	}
	return s.repo.LogEvent(ctx, tenantID, req.EventType, payload)
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
