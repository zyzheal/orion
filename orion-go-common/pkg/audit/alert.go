package audit

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// SecurityAlertType categorizes security alerts.
type SecurityAlertType string

const (
	AlertTypePermissionDenial  SecurityAlertType = "permission_denial"
	AlertTypePrivilegeEscalation SecurityAlertType = "privilege_escalation"
	AlertTypeAnomalousBehavior SecurityAlertType = "anomalous_behavior"
	AlertTypeChainIntegrity    SecurityAlertType = "chain_integrity"
	AlertTypeCrossTenant       SecurityAlertType = "cross_tenant"
)

// SecurityAlert represents a security alert to be sent to the notification service.
type SecurityAlert struct {
	ID          string            `json:"id"`
	Type        SecurityAlertType `json:"type"`
	Severity    AlertSeverity     `json:"severity"`
	TenantID    string            `json:"tenant_id"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	UserID      string            `json:"user_id,omitempty"`
	Timestamp   time.Time         `json:"timestamp"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// AlertNotifier sends security alerts to external systems.
type AlertNotifier interface {
	// Notify sends a security alert.
	Notify(ctx context.Context, alert SecurityAlert) error
}

// NotificationServiceNotifier sends alerts via the notification service.
type NotificationServiceNotifier struct {
	endpoint string
	apiKey   string
}

// NewNotificationServiceNotifier creates a notifier that sends to the notification-svc.
func NewNotificationServiceNotifier(endpoint, apiKey string) *NotificationServiceNotifier {
	return &NotificationServiceNotifier{
		endpoint: endpoint,
		apiKey:   apiKey,
	}
}

// Notify sends an alert to the notification service.
func (n *NotificationServiceNotifier) Notify(ctx context.Context, alert SecurityAlert) error {
	// In production, this would make an HTTP POST to the notification service.
	// For now, we serialize and log the alert.
	_, err := json.Marshal(alert)
	if err != nil {
		return fmt.Errorf("marshal alert: %w", err)
	}
	// TODO: HTTP POST to n.endpoint with alert body
	return nil
}

// LogNotifier writes alerts to a logger (for development/testing).
type LogNotifier struct {
	alerts []SecurityAlert
}

// NewLogNotifier creates a notifier that stores alerts in memory.
func NewLogNotifier() *LogNotifier {
	return &LogNotifier{}
}

// Notify stores the alert in memory.
func (l *LogNotifier) Notify(ctx context.Context, alert SecurityAlert) error {
	l.alerts = append(l.alerts, alert)
	return nil
}

// GetAlerts returns all stored alerts.
func (l *LogNotifier) GetAlerts() []SecurityAlert {
	return l.alerts
}

// AlertRouter routes UEBA alerts to the notification system.
type AlertRouter struct {
	notifiers []AlertNotifier
}

// NewAlertRouter creates a new alert router.
func NewAlertRouter(notifiers ...AlertNotifier) *AlertRouter {
	return &AlertRouter{notifiers: notifiers}
}

// Route converts a UEBA alert to a security alert and sends it.
func (r *AlertRouter) Route(ctx context.Context, uebaAlert UEBAAlert) {
	secAlert := SecurityAlert{
		ID:          fmt.Sprintf("sec_%s_%d", uebaAlert.TenantID, time.Now().UnixNano()),
		Type:        mapUEBAToAlertType(uebaAlert.RuleID),
		Severity:    uebaAlert.Severity,
		TenantID:    uebaAlert.TenantID,
		Title:       uebaAlert.RuleName,
		Description: uebaAlert.Detail,
		UserID:      uebaAlert.UserID,
		Timestamp:   uebaAlert.Timestamp,
		Metadata:    uebaAlert.Metadata,
	}

	for _, n := range r.notifiers {
		_ = n.Notify(ctx, secAlert)
	}
}

// mapUEBAToAlertType maps UEBA rule IDs to alert types.
func mapUEBAToAlertType(ruleID string) SecurityAlertType {
	switch ruleID {
	case "excessive-denials", "unauthorized-attempt":
		return AlertTypePermissionDenial
	case "privilege-escalation-attempt":
		return AlertTypePrivilegeEscalation
	case "unusual-resource-access", "off-hours-access", "off-hours-sensitive-access",
		"brute-force-permission", "api-pattern-anomaly", "multi-location-login":
		return AlertTypeAnomalousBehavior
	case "cross-tenant-attempt":
		return AlertTypeCrossTenant
	case "mass-data-export", "service-account-abuse":
		return AlertTypeAnomalousBehavior
	default:
		return AlertTypeAnomalousBehavior
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// Alert Service — Multi-channel alert dispatch
// ──────────────────────────────────────────────────────────────────────────────

// AlertChannel is the interface for alert notification channels.
type AlertChannel interface {
	// Send dispatches a single alert through this channel.
	Send(ctx context.Context, alert UEBAAlert) error
	// Name returns the channel name for logging.
	Name() string
}

// WebhookChannel sends alerts via HTTP POST webhook.
type WebhookChannel struct {
	endpoint string
	client   *http.Client
	headers  map[string]string
}

// NewWebhookChannel creates a new webhook notification channel.
func NewWebhookChannel(endpoint string, headers map[string]string) *WebhookChannel {
	return &WebhookChannel{
		endpoint: endpoint,
		client:   &http.Client{Timeout: 10 * time.Second},
		headers:  headers,
	}
}

// Send dispatches an alert via HTTP POST to the webhook endpoint.
func (c *WebhookChannel) Send(ctx context.Context, alert UEBAAlert) error {
	body, err := json.Marshal(alert)
	if err != nil {
		return fmt.Errorf("marshal alert: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("send webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("webhook returned %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// Name returns the channel name.
func (c *WebhookChannel) Name() string { return "webhook" }

// EmailChannel sends alerts via email through the notification service.
type EmailChannel struct {
	endpoint string
	apiKey   string
	client   *http.Client
}

// NewEmailChannel creates a new email notification channel.
// endpoint is the notification service URL (e.g., "http://notify-svc:8080").
func NewEmailChannel(endpoint, apiKey string) *EmailChannel {
	return &EmailChannel{
		endpoint: endpoint,
		apiKey:   apiKey,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

// Send dispatches an alert via email through the notification service.
func (c *EmailChannel) Send(ctx context.Context, alert UEBAAlert) error {
	payload := map[string]interface{}{
		"type":      "email",
		"alert":     alert,
		"subject":   fmt.Sprintf("[Security Alert][%s] %s", alert.Severity, alert.RuleName),
		"body":      alert.Detail,
		"tenant_id": alert.TenantID,
		"user_id":   alert.UserID,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.endpoint+"/api/notifications/email", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("send email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("email service returned %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// Name returns the channel name.
func (c *EmailChannel) Name() string { return "email" }

// InAppChannel sends alerts as in-app notifications.
type InAppChannel struct {
	endpoint string
	apiKey   string
	client   *http.Client
}

// NewInAppChannel creates a new in-app notification channel.
// endpoint is the notification service URL (e.g., "http://notify-svc:8080").
func NewInAppChannel(endpoint, apiKey string) *InAppChannel {
	return &InAppChannel{
		endpoint: endpoint,
		apiKey:   apiKey,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

// Send dispatches an alert as an in-app notification.
func (c *InAppChannel) Send(ctx context.Context, alert UEBAAlert) error {
	payload := map[string]interface{}{
		"type":      "in_app",
		"alert":     alert,
		"title":     alert.RuleName,
		"message":   alert.Detail,
		"severity":  alert.Severity,
		"tenant_id": alert.TenantID,
		"user_id":   alert.UserID,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.endpoint+"/api/notifications/in-app", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("send in-app: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("in-app service returned %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// Name returns the channel name.
func (c *InAppChannel) Name() string { return "in-app" }

// AlertService dispatches UEBA alerts to the notification service through multiple channels.
type AlertService struct {
	channels []AlertChannel
	mu       sync.RWMutex
}

// NewAlertService creates a new alert service with the given notification channels.
func NewAlertService(channels ...AlertChannel) *AlertService {
	return &AlertService{channels: channels}
}

// Dispatch sends an alert to all configured notification channels.
func (s *AlertService) Dispatch(ctx context.Context, alert UEBAAlert) error {
	s.mu.RLock()
	channels := make([]AlertChannel, len(s.channels))
	copy(channels, s.channels)
	s.mu.RUnlock()

	var errs []error
	for _, ch := range channels {
		if err := ch.Send(ctx, alert); err != nil {
			errs = append(errs, fmt.Errorf("channel %s: %w", ch.Name(), err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("dispatch errors: %w", errors.Join(errs...))
	}
	return nil
}

// DispatchBatch sends multiple alerts to all configured notification channels.
func (s *AlertService) DispatchBatch(ctx context.Context, alerts []UEBAAlert) error {
	var errs []error
	for _, alert := range alerts {
		if err := s.Dispatch(ctx, alert); err != nil {
			errs = append(errs, err)
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("batch dispatch errors: %w", errors.Join(errs...))
	}
	return nil
}

// AddChannel adds a notification channel to the alert service.
func (s *AlertService) AddChannel(ch AlertChannel) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.channels = append(s.channels, ch)
}

// ChannelCount returns the number of configured channels.
func (s *AlertService) ChannelCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.channels)
}
