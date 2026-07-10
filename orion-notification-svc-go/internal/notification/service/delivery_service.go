package service

import (
	"context"
	"fmt"
	"time"

	"orion/notification-svc-go/internal/notification/models"
	"orion/notification-svc-go/internal/notification/repository"
	"orion/go-common/pkg/otel"

	"go.uber.org/zap"
)

// ErrDeliveryNotFound is returned when a delivery lookup fails.
var ErrDeliveryNotFound = fmt.Errorf("delivery not found")

// DeliveryService implements notification delivery business logic.
type DeliveryService struct {
	repo      *repository.DeliveryRepository
	logger    *zap.Logger
}

// NewDeliveryService creates a new DeliveryService.
func NewDeliveryService(repo *repository.DeliveryRepository, logger *zap.Logger) *DeliveryService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &DeliveryService{repo: repo, logger: logger}
}

// DeliverNotification orchestrates delivery across configured channels.
func (s *DeliveryService) DeliverNotification(ctx context.Context, tenantID, notificationID string) ([]models.NotificationDelivery, error) {
	ctx, span := otel.Tracer("orion-notification-delivery-svc").Start(ctx, "DeliveryService.DeliverNotification")
	defer span.End()

	// Look up the notification to resolve channel and recipient.
	// In this simplified version, we expect the notification data to be passed through context
	// or fetched from the notification repository. For now, we return an empty list
	// and rely on the caller to create delivery records directly.
	s.logger.Info("delivery requested", zap.String("notification_id", notificationID))
	return nil, nil
}

// RetryDelivery retries a failed or exhausted delivery.
func (s *DeliveryService) RetryDelivery(ctx context.Context, tenantID, deliveryID string) (*models.NotificationDelivery, error) {
	ctx, span := otel.Tracer("orion-notification-delivery-svc").Start(ctx, "DeliveryService.RetryDelivery")
	defer span.End()

	delivery, err := s.repo.FindByID(ctx, tenantID, deliveryID)
	if err != nil {
		s.logger.Warn("delivery not found for retry", zap.String("id", deliveryID), zap.Error(err))
		return nil, ErrDeliveryNotFound
	}

	if delivery.AttemptNumber >= delivery.MaxAttempts {
		if _, markErr := s.repo.MarkExhausted(ctx, tenantID, deliveryID, "Max retries exceeded"); markErr != nil {
			s.logger.Error("failed to mark exhausted", zap.Error(markErr))
		}
		return nil, fmt.Errorf("delivery %s has exhausted all retry attempts", deliveryID)
	}

	updated, err := s.repo.IncrementAttempt(ctx, tenantID, deliveryID)
	if err != nil {
		s.logger.Error("failed to increment attempt", zap.Error(err))
		return nil, fmt.Errorf("failed to increment attempt for %s: %w", deliveryID, err)
	}

	s.logger.Info("delivery retry queued",
		zap.String("delivery_id", deliveryID),
		zap.Int("attempt", updated.AttemptNumber),
	)
	return updated, nil
}

// GetDeliveryHistory returns all delivery attempts for a notification.
func (s *DeliveryService) GetDeliveryHistory(ctx context.Context, tenantID, notificationID string) ([]models.NotificationDelivery, error) {
	ctx, span := otel.Tracer("orion-notification-delivery-svc").Start(ctx, "DeliveryService.GetDeliveryHistory")
	defer span.End()

	history, err := s.repo.FindByNotificationID(ctx, tenantID, notificationID)
	if err != nil {
		s.logger.Error("failed to get delivery history", zap.Error(err))
		return nil, fmt.Errorf("failed to get delivery history: %w", err)
	}
	return history, nil
}

// GetPendingDeliveries returns deliveries due for retry.
func (s *DeliveryService) GetPendingDeliveries(ctx context.Context, tenantID string, limit int) ([]models.NotificationDelivery, error) {
	ctx, span := otel.Tracer("orion-notification-delivery-svc").Start(ctx, "DeliveryService.GetPendingDeliveries")
	defer span.End()

	pending, err := s.repo.FindPendingForRetry(ctx, tenantID, limit)
	if err != nil {
		s.logger.Error("failed to get pending deliveries", zap.Error(err))
		return nil, fmt.Errorf("failed to get pending deliveries: %w", err)
	}
	s.logger.Info("pending deliveries found", zap.Int("count", len(pending)))
	return pending, nil
}

// GetDeliveryByID returns a single delivery record by id.
func (s *DeliveryService) GetDeliveryByID(ctx context.Context, tenantID, id string) (*models.NotificationDelivery, error) {
	ctx, span := otel.Tracer("orion-notification-delivery-svc").Start(ctx, "DeliveryService.GetDeliveryByID")
	defer span.End()

	delivery, err := s.repo.FindByID(ctx, tenantID, id)
	if err != nil {
		s.logger.Warn("delivery not found", zap.String("id", id), zap.Error(err))
		return nil, ErrDeliveryNotFound
	}
	return delivery, nil
}

// CalculateNextRetry computes exponential backoff: 30s, 5min, 30min.
func CalculateNextRetry(attemptNumber int) time.Time {
	backoffMs := []int64{30_000, 300_000, 1_800_000}
	idx := attemptNumber - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(backoffMs) {
		idx = len(backoffMs) - 1
	}
	return time.Now().Add(time.Duration(backoffMs[idx]) * time.Millisecond)
}

// ResolveFallbackChannel returns the fallback channel for a given channel.
func ResolveFallbackChannel(channel models.DeliveryChannel) *models.DeliveryChannel {
	fallbacks := map[models.DeliveryChannel]models.DeliveryChannel{
		models.DeliveryChannelEmail:   models.DeliveryChannelPush,
		models.DeliveryChannelSMS:     models.DeliveryChannelWebhook,
		models.DeliveryChannelWebhook: models.DeliveryChannelInApp,
		models.DeliveryChannelPush:    models.DeliveryChannelInApp,
	}
	if fallback, ok := fallbacks[channel]; ok {
		return &fallback
	}
	return nil
}
