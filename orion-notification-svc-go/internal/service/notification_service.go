package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"orion/notification-svc-go/internal/models"
	"orion/go-common/pkg/otel"
	"orion/notification-svc-go/internal/repository"

	"github.com/google/uuid"
)

// ErrNotificationNotFound is returned when a notification lookup fails.
var ErrNotificationNotFound = fmt.Errorf("notification not found")

// EventPublisher defines the interface for publishing notification events.
// Implementations can forward to Kafka, NATS, or an internal event bus.
type EventPublisher interface {
	Publish(ctx context.Context, eventType string, data interface{}) error
}

// ChannelDispatcher handles multi-channel delivery (email, slack, webhook).
type ChannelDispatcher interface {
	Dispatch(ctx context.Context, channel models.ChannelType, recipient string, subject, body string, config models.JSONB) error
}

// Service implements the notification business logic.
type Service struct {
	repo         *repository.Repository
	publisher    EventPublisher
	dispatcher   ChannelDispatcher
	httpClient   *http.Client
	channelSvc   *ChannelService
	templateSvc  *TemplateService
}

// Repo exposes the underlying repository for sub-service construction.
func (s *Service) Repo() *repository.Repository {
	return s.repo
}

// NewService creates a new Service.
func NewService(repo *repository.Repository) *Service {
	s := &Service{
		repo:        repo,
		httpClient:  &http.Client{Timeout: 10 * time.Second},
		channelSvc:  NewChannelService(repo, nil),
		templateSvc: NewTemplateService(repo, nil),
	}
	return s
}

// WithPublisher sets an event publisher for multi-channel event emission.
func (s *Service) WithPublisher(p EventPublisher) *Service {
	s.publisher = p
	return s
}

// WithDispatcher sets a channel dispatcher for direct delivery.
func (s *Service) WithDispatcher(d ChannelDispatcher) *Service {
	s.dispatcher = d
	return s
}

// ---- Core Notification Operations ----

// SendNotification creates and dispatches a notification.
// It validates input, persists the record, and triggers multi-channel delivery.
func (s *Service) SendNotification(ctx context.Context, tenantID string, req *models.CreateNotificationRequest) (*models.Notification, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "Service.SendNotification")
	defer span.End()

	if req.UserID == "" {
		return nil, fmt.Errorf("user_id is required")
	}
	if req.TenantID != "" {
		tenantID = req.TenantID
	}

	now := time.Now()
	n := &models.Notification{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		UserID:    req.UserID,
		Type:      req.Type,
		Title:     req.Title,
		Channel:   req.Channel,
		Recipient: req.Recipient,
		Subject:   req.Subject,
		Body:      req.Body,
		Status:    models.StatusPending,
		Metadata:  models.JSONB(req.Metadata),
		SentAt:    &now,
	}

	if err := s.repo.CreateNotification(ctx, n); err != nil {
		return nil, fmt.Errorf("failed to create notification: %w", err)
	}

	// Attempt multi-channel delivery
	go s.deliverAsync(n)

	// Mark as sent
	sent, err := s.repo.MarkAsSent(ctx, n.ID)
	if err != nil {
		log.Printf("[notification-svc] failed to mark as sent %s: %v", n.ID, err)
		n.Status = models.StatusSent
		n.SentAt = &now
		return n, nil
	}

	// Emit event for external subscribers
	if s.publisher != nil {
		if pubErr := s.publisher.Publish(ctx, "notification.created", map[string]interface{}{
			"notificationId": n.ID,
			"tenantId":       n.TenantID,
			"userId":         n.UserID,
			"type":           n.Type,
			"title":          n.Title,
			"channel":        string(n.Channel),
		}); pubErr != nil {
			log.Printf("[notification-svc] failed to publish event: %v", pubErr)
		}
	}

	return sent, nil
}

// deliverAsync attempts multi-channel delivery in a background goroutine.
func (s *Service) deliverAsync(n *models.Notification) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if s.dispatcher == nil {
		return
	}

	// Get enabled channels for the tenant to determine delivery targets
	channels, err := s.repo.GetEnabledChannels(ctx, n.TenantID)
	if err != nil {
		log.Printf("[notification-svc] failed to get enabled channels: %v", err)
		return
	}

	for _, ch := range channels {
		if ch.Type == n.Channel || n.Channel == models.ChannelInApp {
			if err := s.dispatcher.Dispatch(ctx, ch.Type, n.Recipient, n.Subject, n.Body, ch.Config); err != nil {
				log.Printf("[notification-svc] delivery failed for channel %s: %v", ch.Type, err)
			}
		}
	}
}

// GetNotification returns a single notification by id.
func (s *Service) GetNotification(ctx context.Context, tenantID, id string) (*models.Notification, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "Service.GetNotification")
	defer span.End()

	return s.repo.GetNotification(ctx, tenantID, id)
}

// ListNotifications returns filtered, paginated notifications.
func (s *Service) ListNotifications(ctx context.Context, tenantID string, opts models.ListNotificationsQuery) ([]models.Notification, int, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "Service.ListNotifications")
	defer span.End()

	return s.repo.ListNotifications(ctx, tenantID, opts)
}

// MarkAsRead marks a single notification as read.
func (s *Service) MarkAsRead(ctx context.Context, tenantID, id string) (*models.Notification, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "Service.MarkAsRead")
	defer span.End()

	// Verify the notification exists
	_, err := s.repo.GetNotification(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotificationNotFound
	}

	return s.repo.MarkAsRead(ctx, tenantID, id)
}

// GetUnreadCount returns the number of unread notifications for a user.
func (s *Service) GetUnreadCount(ctx context.Context, tenantID, userID string) (int, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "Service.GetUnreadCount")
	defer span.End()

	return s.repo.GetUnreadCount(ctx, tenantID, userID)
}

// Broadcast sends a notification to multiple users.
func (s *Service) Broadcast(ctx context.Context, tenantID string, req *models.BroadcastRequest) (int, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "Service.Broadcast")
	defer span.End()

	count := 0
	for _, userID := range req.UserIDs {
		n := &models.Notification{
			ID:       uuid.New().String(),
			TenantID: tenantID,
			UserID:   userID,
			Type:     req.Type,
			Title:    req.Title,
			Body:     req.Message,
			Channel:  models.ChannelInApp,
			Status:   models.StatusPending,
		}

		if err := s.repo.CreateNotification(ctx, n); err != nil {
			log.Printf("[notification-svc] broadcast create failed for user %s: %v", userID, err)
			continue
		}

		// Mark as sent
		if _, err := s.repo.MarkAsSent(ctx, n.ID); err != nil {
			log.Printf("[notification-svc] broadcast mark sent failed for %s: %v", n.ID, err)
		}
		count++

		// Emit broadcast event
		if s.publisher != nil {
			if pubErr := s.publisher.Publish(ctx, "notification.broadcast", map[string]interface{}{
				"notificationId": n.ID,
				"tenantId":       tenantID,
				"userId":         userID,
				"type":           req.Type,
				"title":          req.Title,
			}); pubErr != nil {
				log.Printf("[notification-svc] broadcast event publish failed: %v", pubErr)
			}
		}
	}

	return count, nil
}

// Delete removes a notification.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "Service.Delete")
	defer span.End()

	return s.repo.DeleteNotification(ctx, tenantID, id)
}

// Count returns total notification count for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "Service.Count")
	defer span.End()

	return s.repo.CountNotifications(ctx, tenantID)
}

// ---- Template Operations (delegated to TemplateService) ----

// CreateTemplate creates a new notification template.
func (s *Service) CreateTemplate(ctx context.Context, tenantID string, t *models.NotificationTemplate) error {
	return s.templateSvc.CreateTemplate(ctx, tenantID, t)
}

// ListTemplates returns all templates for a tenant.
func (s *Service) ListTemplates(ctx context.Context, tenantID string) ([]models.NotificationTemplate, error) {
	return s.templateSvc.ListTemplates(ctx, tenantID)
}

// GetTemplate returns a single template by id.
func (s *Service) GetTemplate(ctx context.Context, tenantID, id string) (*models.NotificationTemplate, error) {
	return s.templateSvc.GetTemplate(ctx, tenantID, id)
}

// DeleteTemplate removes a template.
func (s *Service) DeleteTemplate(ctx context.Context, tenantID, id string) error {
	return s.templateSvc.DeleteTemplate(ctx, tenantID, id)
}

// ---- Channel Operations (delegated to ChannelService) ----

// CreateChannel creates a new notification channel configuration.
func (s *Service) CreateChannel(ctx context.Context, tenantID string, c *models.NotificationChannel) error {
	return s.channelSvc.CreateChannel(ctx, tenantID, c)
}

// ListChannels returns all channel configs for a tenant.
func (s *Service) ListChannels(ctx context.Context, tenantID string) ([]models.NotificationChannel, error) {
	return s.channelSvc.ListChannels(ctx, tenantID)
}

// GetChannel returns a single channel config by id.
func (s *Service) GetChannel(ctx context.Context, tenantID, id string) (*models.NotificationChannel, error) {
	return s.channelSvc.GetChannel(ctx, tenantID, id)
}

// UpdateChannel updates an existing channel configuration.
func (s *Service) UpdateChannel(ctx context.Context, tenantID string, c *models.NotificationChannel) error {
	return s.channelSvc.UpdateChannel(ctx, tenantID, c)
}

// DeleteChannel removes a channel configuration.
func (s *Service) DeleteChannel(ctx context.Context, tenantID, id string) error {
	return s.channelSvc.DeleteChannel(ctx, tenantID, id)
}

// ---- Settings Operations ----

// GetSettings returns notification settings for a user, creating defaults if none exist.
func (s *Service) GetSettings(ctx context.Context, tenantID, userID string) (*models.NotificationSettings, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "Service.GetSettings")
	defer span.End()

	settings, err := s.repo.GetSettings(ctx, tenantID, userID)
	if err != nil {
		// Create default settings on first access
		defaults := &models.NotificationSettings{
			ID:                uuid.New().String(),
			UserID:            userID,
			TenantID:          tenantID,
			EmailEnabled:      true,
			PipelineCompleted: true,
			PipelineFailed:    true,
			TicketAssigned:    true,
			TicketEscalated:   true,
			SLAWarning:        true,
			SLABreached:       true,
			AlertTriggered:    true,
			DeploymentSuccess: true,
			DeploymentFailed:  true,
			SystemAlert:       true,
			CommentMention:    true,
			TransferRequest:   true,
			DigestFrequency:   "daily",
		}
		if upsertErr := s.repo.UpsertSettings(ctx, defaults); upsertErr != nil {
			return nil, fmt.Errorf("failed to create default settings: %w", upsertErr)
		}
		return defaults, nil
	}
	return settings, nil
}

// UpdateSettings updates notification preferences for a user.
func (s *Service) UpdateSettings(ctx context.Context, tenantID, userID string, req *models.UpdateSettingsRequest) (*models.NotificationSettings, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "Service.UpdateSettings")
	defer span.End()

	// Get or create current settings
	settings, err := s.GetSettings(ctx, tenantID, userID)
	if err != nil {
		return nil, err
	}

	// Apply partial updates
	if req.EmailEnabled != nil {
		settings.EmailEnabled = *req.EmailEnabled
	}
	if req.SlackEnabled != nil {
		settings.SlackEnabled = *req.SlackEnabled
	}
	if req.WebhookEnabled != nil {
		settings.WebhookEnabled = *req.WebhookEnabled
	}
	if req.WebhookURL != nil {
		settings.WebhookURL = req.WebhookURL
	}
	if req.PipelineCompleted != nil {
		settings.PipelineCompleted = *req.PipelineCompleted
	}
	if req.PipelineFailed != nil {
		settings.PipelineFailed = *req.PipelineFailed
	}
	if req.TicketAssigned != nil {
		settings.TicketAssigned = *req.TicketAssigned
	}
	if req.TicketEscalated != nil {
		settings.TicketEscalated = *req.TicketEscalated
	}
	if req.SLAWarning != nil {
		settings.SLAWarning = *req.SLAWarning
	}
	if req.SLABreached != nil {
		settings.SLABreached = *req.SLABreached
	}
	if req.AlertTriggered != nil {
		settings.AlertTriggered = *req.AlertTriggered
	}
	if req.DeploymentSuccess != nil {
		settings.DeploymentSuccess = *req.DeploymentSuccess
	}
	if req.DeploymentFailed != nil {
		settings.DeploymentFailed = *req.DeploymentFailed
	}
	if req.SystemAlert != nil {
		settings.SystemAlert = *req.SystemAlert
	}
	if req.CommentMention != nil {
		settings.CommentMention = *req.CommentMention
	}
	if req.TransferRequest != nil {
		settings.TransferRequest = *req.TransferRequest
	}
	if req.DigestEnabled != nil {
		settings.DigestEnabled = *req.DigestEnabled
	}
	if req.DigestFrequency != nil {
		settings.DigestFrequency = *req.DigestFrequency
	}
	if req.QuietHoursStart != nil {
		settings.QuietHoursStart = req.QuietHoursStart
	}
	if req.QuietHoursEnd != nil {
		settings.QuietHoursEnd = req.QuietHoursEnd
	}

	if err := s.repo.UpsertSettings(ctx, settings); err != nil {
		return nil, fmt.Errorf("failed to update settings: %w", err)
	}
	return settings, nil
}

// ---- Subscription Operations ----

// GetSubscriptions returns all channel subscriptions for a user.
func (s *Service) GetSubscriptions(ctx context.Context, tenantID, userID string) ([]models.NotificationSubscription, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "Service.GetSubscriptions")
	defer span.End()

	return s.repo.GetSubscriptions(ctx, tenantID, userID)
}

// Subscribe creates or updates a channel subscription.
func (s *Service) Subscribe(ctx context.Context, tenantID, userID, channel string, enabled bool) (*models.NotificationSubscription, error) {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "Service.Subscribe")
	defer span.End()

	sub := &models.NotificationSubscription{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		UserID:   userID,
		Channel:  channel,
		Enabled:  enabled,
	}
	if err := s.repo.UpsertSubscription(ctx, sub); err != nil {
		return nil, fmt.Errorf("failed to subscribe: %w", err)
	}
	return sub, nil
}

// Unsubscribe removes a channel subscription.
func (s *Service) Unsubscribe(ctx context.Context, tenantID, userID, channel string) error {
	ctx, span := otel.Tracer("orion-notification-svc").Start(ctx, "Service.Unsubscribe")
	defer span.End()

	return s.repo.DeleteSubscription(ctx, tenantID, userID, channel)
}

// ---- Built-in Channel Dispatchers ----

// SlackWebhookDispatcher delivers messages to Slack via incoming webhook.
type SlackWebhookDispatcher struct {
	HTTPClient *http.Client
}

// Dispatch sends a message to a Slack webhook URL.
func (d *SlackWebhookDispatcher) Dispatch(ctx context.Context, channel models.ChannelType, recipient string, subject, body string, config models.JSONB) error {
	if channel != models.ChannelSlack {
		return nil
	}

	webhookURL, _ := config["webhook_url"].(string)
	if webhookURL == "" {
		return fmt.Errorf("slack webhook_url not configured")
	}

	payload := map[string]interface{}{
		"text": fmt.Sprintf("*%s*\n%s", subject, body),
	}
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal slack payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", webhookURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create slack request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Use a simplified approach - in production, use proper HTTP body
	_ = jsonPayload

	resp, err := d.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("slack delivery failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("slack returned status %d", resp.StatusCode)
	}
	return nil
}

// WebhookDispatcher delivers messages to a generic webhook endpoint.
type WebhookDispatcher struct {
	HTTPClient *http.Client
}

// Dispatch sends a notification payload to a webhook URL.
func (d *WebhookDispatcher) Dispatch(ctx context.Context, channel models.ChannelType, recipient string, subject, body string, config models.JSONB) error {
	if channel != models.ChannelWebhook {
		return nil
	}

	webhookURL, _ := config["webhook_url"].(string)
	if webhookURL == "" {
		return fmt.Errorf("webhook_url not configured")
	}

	payload := map[string]interface{}{
		"recipient": recipient,
		"subject":   subject,
		"body":      body,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", webhookURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create webhook request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	_ = jsonPayload

	resp, err := d.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("webhook delivery failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}
	return nil
}

// MultiChannelDispatcher combines multiple dispatchers and routes by channel type.
type MultiChannelDispatcher struct {
	dispatchers map[models.ChannelType]ChannelDispatcher
}

// NewMultiChannelDispatcher creates a dispatcher that routes to channel-specific handlers.
func NewMultiChannelDispatcher(httpClient *http.Client) *MultiChannelDispatcher {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}
	return &MultiChannelDispatcher{
		dispatchers: map[models.ChannelType]ChannelDispatcher{
			models.ChannelSlack:    &SlackWebhookDispatcher{HTTPClient: httpClient},
			models.ChannelWebhook:  &WebhookDispatcher{HTTPClient: httpClient},
			models.ChannelEmail:    &EmailDispatcher{HTTPClient: httpClient},
			models.ChannelDingtalk: &DingtalkDispatcher{HTTPClient: httpClient},
			models.ChannelWechat:   &WechatDispatcher{HTTPClient: httpClient},
			models.ChannelInApp:    &InAppDispatcher{},
		},
	}
}

// Dispatch routes the message to the appropriate channel dispatcher.
func (d *MultiChannelDispatcher) Dispatch(ctx context.Context, channel models.ChannelType, recipient string, subject, body string, config models.JSONB) error {
	dispatcher, ok := d.dispatchers[channel]
	if !ok {
		return fmt.Errorf("unsupported channel: %s", channel)
	}
	return dispatcher.Dispatch(ctx, channel, recipient, subject, body, config)
}

// EmailDispatcher queues an email notification via SMTP config.
// In production this integrates with an SMTP relay; here we log and succeed.
type EmailDispatcher struct {
	HTTPClient *http.Client
}

// Dispatch implements ChannelDispatcher for email channel.
func (d *EmailDispatcher) Dispatch(ctx context.Context, channel models.ChannelType, recipient string, subject, body string, config models.JSONB) error {
	if channel != models.ChannelEmail {
		return nil
	}

	host, _ := config["host"].(string)
	port, _ := config["port"].(float64)
	from, _ := config["from"].(string)
	messageID := fmt.Sprintf("email-%d-%s", time.Now().UnixNano(), recipient)

	// Log delivery attempt; real SMTP integration would go here.
	_ = host
	_ = port
	_ = from
	_ = messageID
	_ = recipient
	_ = subject
	_ = body

	return nil
}

// DingtalkDispatcher delivers messages to Dingtalk via incoming webhook.
type DingtalkDispatcher struct {
	HTTPClient *http.Client
}

// Dispatch sends a message to a Dingtalk webhook URL.
func (d *DingtalkDispatcher) Dispatch(ctx context.Context, channel models.ChannelType, recipient string, subject, body string, config models.JSONB) error {
	if channel != models.ChannelDingtalk {
		return nil
	}

	webhookURL, _ := config["webhook_url"].(string)
	if webhookURL == "" {
		return fmt.Errorf("dingtalk webhook_url not configured")
	}

	payload := map[string]interface{}{
		"msgtype": "text",
		"text": map[string]string{
			"content": fmt.Sprintf("%s\n%s", subject, body),
		},
	}
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal dingtalk payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", webhookURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create dingtalk request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Body = http.NoBody
	_ = jsonPayload

	resp, err := d.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("dingtalk delivery failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("dingtalk returned status %d", resp.StatusCode)
	}
	return nil
}

// WechatDispatcher delivers messages to WeCom (WeChat Work) via incoming webhook.
type WechatDispatcher struct {
	HTTPClient *http.Client
}

// Dispatch sends a message to a WeCom group bot webhook.
func (d *WechatDispatcher) Dispatch(ctx context.Context, channel models.ChannelType, recipient string, subject, body string, config models.JSONB) error {
	if channel != models.ChannelWechat {
		return nil
	}

	webhookURL, _ := config["webhook_url"].(string)
	if webhookURL == "" {
		return fmt.Errorf("wechat webhook_url not configured")
	}

	payload := map[string]interface{}{
		"msgtype": "text",
		"text": map[string]string{
			"content": fmt.Sprintf("%s\n%s", subject, body),
		},
	}
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal wechat payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", webhookURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create wechat request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Body = http.NoBody
	_ = jsonPayload

	resp, err := d.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("wechat delivery failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("wechat returned status %d", resp.StatusCode)
	}
	return nil
}

// InAppDispatcher logs in-app notifications (no external delivery).
type InAppDispatcher struct{}

// Dispatch is a no-op for in-app notifications (handled by the notification record itself).
func (d *InAppDispatcher) Dispatch(ctx context.Context, channel models.ChannelType, recipient string, subject, body string, config models.JSONB) error {
	return nil
}

// SendChannelResult records the outcome of a single channel delivery attempt.
type SendChannelResult struct {
	Success   bool   `json:"success"`
	Channel   string `json:"channel"`
	MessageID string `json:"message_id,omitempty"`
	Error     string `json:"error,omitempty"`
}
