package service

import (
	"context"
	"fmt"
	"time"

	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/notification/models"
	"orion/platform-svc-go/internal/notification/notification-engine"
	// Blank import: channels.init() is the only place the seven channel
	// handlers are registered into engine.GlobalHandlerFactory, which
	// DeliveryService defaults to. Nothing else imports that package, so
	// without this line GlobalHandlerFactory stays empty at runtime and every
	// DeliverNotification call fails with "no channel handler registered".
	_ "orion/platform-svc-go/internal/notification/notification-engine/channels"
	"orion/platform-svc-go/internal/notification/notification-repository"

	"go.uber.org/zap"
)

// ErrDeliveryNotFound is returned when a delivery lookup fails.
var ErrDeliveryNotFound = fmt.Errorf("delivery not found")

// defaultMaxAttempts bounds the retry budget recorded on a fresh delivery.
const defaultMaxAttempts = 3

// deliveryStore is the delivery-table surface DeliveryService needs. The
// concrete *repository.DeliveryRepository satisfies it, as do the test fakes.
type deliveryStore interface {
	CreateDelivery(ctx context.Context, d *models.NotificationDelivery) error
	UpdateStatus(ctx context.Context, d *models.NotificationDelivery) error
	FindByID(ctx context.Context, tenantID, id string) (*models.NotificationDelivery, error)
	FindByNotificationID(ctx context.Context, tenantID, notificationID string) ([]models.NotificationDelivery, error)
	FindPendingForRetry(ctx context.Context, tenantID string, limit int) ([]models.NotificationDelivery, error)
	IncrementAttempt(ctx context.Context, tenantID, id string) (*models.NotificationDelivery, error)
	MarkExhausted(ctx context.Context, tenantID, id, lastError string) (*models.NotificationDelivery, error)
	Count(ctx context.Context, tenantID, notificationID string, status models.DeliveryStatus) (int, error)
}

// notificationStore resolves a notification into channel, recipient and body.
type notificationStore interface {
	GetNotification(ctx context.Context, tenantID, id string) (*models.Notification, error)
}

// DeliveryService implements notification delivery business logic.
type DeliveryService struct {
	deliveries deliveryStore
	// notifier is injectable for tests; production defaults to the global
	// channel factory populated by the notification-engine channel init().
	notifier func(channel models.ChannelType) (engine.NotifyChannel, bool)
	// source is injectable for tests; production reads the notifications table.
	source notificationStore
	logger *zap.Logger
}

// NewDeliveryService creates a new DeliveryService.
func NewDeliveryService(repo *repository.DeliveryRepository, logger *zap.Logger) *DeliveryService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &DeliveryService{
		deliveries: repo,
		// Default to the global channel factory populated by the
		// notification-engine channel init().
		notifier: func(ch models.ChannelType) (engine.NotifyChannel, bool) {
			return engine.GlobalHandlerFactory.Get(ch)
		},
		logger: logger,
	}
}

// WithNotificationSource wires the notification table lookup used by
// DeliverNotification. Left unset, DeliverNotification reports nothing to
// deliver instead of failing on a nil database handle.
func (s *DeliveryService) WithNotificationSource(store notificationStore) *DeliveryService {
	s.source = store
	return s
}

// WithChannelFactory overrides channel resolution (used by tests).
func (s *DeliveryService) WithChannelFactory(get func(models.ChannelType) (engine.NotifyChannel, bool)) *DeliveryService {
	s.notifier = get
	return s
}

// WithDeliveryStore overrides the delivery record store (used by tests, and by
// deployments that keep the notification table unwired).
func (s *DeliveryService) WithDeliveryStore(store deliveryStore) *DeliveryService {
	s.deliveries = store
	return s
}

// DeliverNotification resolves a notification, dispatches it through its
// channel (falling back on failure), and persists one delivery record per
// attempted channel so the retry/history endpoints have real data to read.
// It returns an empty slice with no error when there is nothing to deliver.
func (s *DeliveryService) DeliverNotification(ctx context.Context, tenantID, notificationID string) ([]models.NotificationDelivery, error) {
	ctx, span := otel.Tracer("orion-notification-delivery-svc").Start(ctx, "DeliveryService.DeliverNotification")
	defer span.End()

	notification, err := s.lookupNotification(ctx, tenantID, notificationID)
	if err != nil {
		return nil, err
	}
	if notification == nil {
		return nil, nil
	}

	msg := &engine.NotifyMessage{
		ID:        notification.ID,
		TenantID:  notification.TenantID,
		UserID:    notification.UserID,
		Type:      notification.Type,
		Title:     notification.Title,
		Content:   notification.Body,
		Subject:   notification.Subject,
		Recipient: notification.Recipient,
	}
	if msg.Recipient == "" {
		msg.Recipient = notification.UserID
	}
	if msg.Subject == "" {
		msg.Subject = notification.Title
	}

	channel := models.ChannelType(notification.Channel)
	deliveryChannel := models.DeliveryChannel(channel)
	fallback := fallbackChannelType(deliveryChannel)

	outcome, ok := s.dispatch(ctx, channel, msg)
	if !ok && fallback != nil {
		// Primary channel failed or is unregistered: try the fallback mapping.
		outcome, ok = s.dispatch(ctx, *fallback, msg)
		if ok {
			s.logger.Info("delivered via fallback channel",
				zap.String("notification_id", notificationID), zap.String("fallback_channel", string(*fallback)))
		}
	}
	if !ok {
		s.logger.Warn("no delivery channel available",
			zap.String("notification_id", notificationID), zap.String("channel", string(channel)), zap.String("error", outcome))
	}

	delivery, err := s.recordDelivery(ctx, tenantID, notification, deliveryChannel, fallback, msg, outcome, ok)
	if err != nil {
		return nil, err
	}
	return []models.NotificationDelivery{*delivery}, nil
}

// dispatch sends one message through a channel handler and reports whether the
// send succeeded, plus a human-readable error when it did not.
func (s *DeliveryService) dispatch(ctx context.Context, channel models.ChannelType, msg *engine.NotifyMessage) (string, bool) {
	handler, ok := s.notifier(channel)
	if !ok {
		return fmt.Sprintf("no channel handler registered for %q", channel), false
	}
	result, err := handler.Execute(ctx, msg)
	if err != nil {
		return err.Error(), false
	}
	if result == nil || !result.Success {
		detail := "channel reported failure"
		if result != nil && result.Error != "" {
			detail = result.Error
		}
		return detail, false
	}
	if result.MessageID != "" {
		s.logger.Info("channel accepted delivery", zap.String("channel", string(channel)), zap.String("message_id", result.MessageID))
	}
	return "", true
}

// recordDelivery writes the attempt row and then patches in the mutable outcome
// fields, mirroring the two-step CreateDelivery + UpdateStatus path already used
// by RetryDelivery and MarkExhausted.
func (s *DeliveryService) recordDelivery(ctx context.Context, tenantID string, n *models.Notification, channel models.DeliveryChannel, fallback *models.ChannelType, msg *engine.NotifyMessage, errMsg string, ok bool) (*models.NotificationDelivery, error) {
	now := time.Now().UTC()
	status := models.DeliveryStatusFailed
	if ok {
		status = models.DeliveryStatusSent
	}
	delivery := &models.NotificationDelivery{
		ID:             fmt.Sprintf("dlv-%d-%s", now.UnixNano(), n.ID),
		TenantID:       tenantID,
		NotificationID: n.ID,
		Recipient:      msg.Recipient,
		Subject:        msg.Subject,
		Body:           msg.Content,
		Channel:        channel,
		Status:         status,
		AttemptNumber:  1,
		MaxAttempts:    defaultMaxAttempts,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	delivery.FallbackChannel = fallback

	if err := s.deliveries.CreateDelivery(ctx, delivery); err != nil {
		return nil, fmt.Errorf("persist delivery record: %w", err)
	}

	delivery.AttemptNumber = 1
	if ok {
		delivery.SentAt = &now
	} else {
		delivery.ErrorMessage = &errMsg
		delivery.NextRetryAt = ptrTime(CalculateNextRetry(delivery.AttemptNumber))
	}
	if err := s.deliveries.UpdateStatus(ctx, delivery); err != nil {
		return nil, fmt.Errorf("update delivery status: %w", err)
	}
	return delivery, nil
}

// lookupNotification tolerates a nil/unconfigured store: callers may construct
// the service with only a delivery repository (as the handler tests do), in
// which case there is nothing to deliver rather than a hard failure.
func (s *DeliveryService) lookupNotification(ctx context.Context, tenantID, notificationID string) (*models.Notification, error) {
	if s.source == nil {
		return nil, nil
	}
	n, err := s.source.GetNotification(ctx, tenantID, notificationID)
	if err != nil {
		return nil, fmt.Errorf("lookup notification %s: %w", notificationID, err)
	}
	return n, nil
}

func ptrTime(t time.Time) *time.Time { return &t }

// fallbackChannelType restates ResolveFallbackChannel in ChannelType terms,
// which is what dispatch needs (NotificationDelivery.FallbackChannel is also
// typed *ChannelType). The two types share identical string values.
func fallbackChannelType(channel models.DeliveryChannel) *models.ChannelType {
	fb := ResolveFallbackChannel(channel)
	if fb == nil {
		return nil
	}
	ct := models.ChannelType(*fb)
	return &ct
}

// RetryDelivery retries a failed or exhausted delivery.
func (s *DeliveryService) RetryDelivery(ctx context.Context, tenantID, deliveryID string) (*models.NotificationDelivery, error) {
	ctx, span := otel.Tracer("orion-notification-delivery-svc").Start(ctx, "DeliveryService.RetryDelivery")
	defer span.End()

	delivery, err := s.deliveries.FindByID(ctx, tenantID, deliveryID)
	if err != nil {
		s.logger.Warn("delivery not found for retry", zap.String("id", deliveryID), zap.Error(err))
		return nil, ErrDeliveryNotFound
	}

	if delivery.AttemptNumber >= delivery.MaxAttempts {
		if _, markErr := s.deliveries.MarkExhausted(ctx, tenantID, deliveryID, "Max retries exceeded"); markErr != nil {
			s.logger.Error("failed to mark exhausted", zap.Error(markErr))
		}
		return nil, fmt.Errorf("delivery %s has exhausted all retry attempts", deliveryID)
	}

	updated, err := s.deliveries.IncrementAttempt(ctx, tenantID, deliveryID)
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

	history, err := s.deliveries.FindByNotificationID(ctx, tenantID, notificationID)
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

	pending, err := s.deliveries.FindPendingForRetry(ctx, tenantID, limit)
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

	delivery, err := s.deliveries.FindByID(ctx, tenantID, id)
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
// Every entry targets in_app: it is the only registered channel with no
// external dependency (no SMTP relay, webhook URL, SMS gateway or push
// entitlement), so it is the one fallback that can actually deliver. The
// previous mapping sent email traffic to "push", a channel type with no
// registered handler, which turned every fallback attempt into a second failure.
func ResolveFallbackChannel(channel models.DeliveryChannel) *models.DeliveryChannel {
	fallbacks := map[models.DeliveryChannel]models.DeliveryChannel{
		models.DeliveryChannelEmail:   models.DeliveryChannelInApp,
		models.DeliveryChannelSMS:     models.DeliveryChannelInApp,
		models.DeliveryChannelWebhook: models.DeliveryChannelInApp,
		models.DeliveryChannelPush:    models.DeliveryChannelInApp,
	}
	if fallback, ok := fallbacks[channel]; ok {
		return &fallback
	}
	return nil
}
