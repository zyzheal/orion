// Package service provides the NotificationFactory and INotificationHandler
// implementations for the Alert Adapter V2 notification service.
//
// The factory maintains a registry of INotificationHandler instances, one per
// channel type. Each handler knows how to initialize, validate, and send a
// notification to its target channel.
//
// SPI contract: INotificationHandler
//   Channel()  — canonical channel name
//   Initialize(config) — configure handler from JSON config
//   Send(template, variables) — render template and dispatch
//   ValidateConfig(config) — pre-flight validation
//
// Flow:
//   1. POST /api/alert-adapters/v2 → CreateAdapter validates channel, persists,
//      looks up handler, calls ValidateConfig + Initialize
//   2. POST /api/alert-adapters/v2/templates → CreateTemplate stores template
//   3. POST /api/alert-adapters/v2/:id/send → SendNotification renders template
//      with variables and dispatches via handler.Send()
//   4. Events are recorded in the delivery audit trail
package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/alert-adapter-v2/models"
	"orion/platform-svc-go/internal/alert-adapter-v2/repository"

	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// SPI Interface
// ---------------------------------------------------------------------------

// INotificationHandler is the pluggable SPI contract for notification channels.
// Each channel type (email, sms, wechat, dingtalk, feishu, slack, telegram,
// pagerduty, opsgenie, webhook, phone, push, in_app, kafka, rabbitmq) must
// provide an implementation.
//
// Implementations should not hold long-lived state beyond what Initialize
// provides; the factory creates a fresh handler per adapter and Initialize
// configures it at adapter creation time.
type INotificationHandler interface {
	// Channel returns the canonical channel name.
	Channel() string

	// Initialize configures the handler with its runtime config map.
	Initialize(ctx context.Context, config map[string]string) error

	// Send renders the template with variables and dispatches the notification.
	Send(ctx context.Context, template string, variables map[string]string) error

	// ValidateConfig checks that the config is well-formed before Initialize.
	ValidateConfig(ctx context.Context, config map[string]string) error
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

var (
	ErrInvalidChannel    = errors.New("invalid notification channel")
	ErrInvalidStatus     = errors.New("invalid adapter status")
	ErrInvalidConfig     = errors.New("invalid adapter config")
	ErrNoHandler         = errors.New("no handler registered for channel")
	ErrAdapterNotFound   = errors.New("adapter not found")
	ErrTemplateNotFound  = errors.New("template not found")
	ErrInitFailed        = errors.New("adapter initialization failed")
	ErrAdapterDisabled   = errors.New("adapter is disabled")
	ErrTenantMismatch    = errors.New("adapter belongs to another tenant")
)

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// NotificationFactory manages the channel handler registry and notification
// adapter lifecycle.
//
// Thread-safe: Register and SendNotification are safe for concurrent use.
type NotificationFactory struct {
	handlers map[string]INotificationHandler
	repo     *repository.Repository
	logger   *zap.Logger
	mu       sync.RWMutex
}

// NewFactory creates a new NotificationFactory with the given repository and
// logger. Call Register on it to add channel handlers.
func NewFactory(repo *repository.Repository, logger *zap.Logger) *NotificationFactory {
	return &NotificationFactory{
		repo:     repo,
		logger:   logger,
		handlers: make(map[string]INotificationHandler),
	}
}

// Register registers a typed notification handler with the factory.
// Subsequent Register calls for the same channel overwrite the previous one.
func (f *NotificationFactory) Register(h INotificationHandler) {
	if h == nil || h.Channel() == "" {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	ch := strings.ToLower(strings.TrimSpace(h.Channel()))
	f.handlers[ch] = h
	f.logger.Info("registered notification handler",
		zap.String("channel", ch),
	)
}

// getHandler returns a fresh handler instance for the given channel.
func (f *NotificationFactory) getHandler(ch string) (INotificationHandler, error) {
	ch = strings.ToLower(strings.TrimSpace(ch))
	f.mu.RLock()
	defer f.mu.RUnlock()
	h, ok := f.handlers[ch]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrNoHandler, ch)
	}
	return h, nil
}

// parseConfig unmarshals a JSON config string into a string map.
func parseConfig(raw string) (map[string]string, error) {
	if raw == "" {
		return map[string]string{}, nil
	}
	var cfg map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return nil, fmt.Errorf("%w: invalid JSON: %v", ErrInvalidConfig, err)
	}
	result := make(map[string]string)
	for k, v := range cfg {
		result[k] = fmt.Sprintf("%v", v)
	}
	return result, nil
}

// ===================================================================
// Adapter operations
// ===================================================================

// CreateAdapter validates the channel, persists the adapter record, and runs
// ValidateConfig + Initialize on the handler.
func (f *NotificationFactory) CreateAdapter(
	ctx context.Context,
	tenantID, name, channel string,
	config string,
) (*models.AlertNotificationAdapter, error) {
	channel = strings.ToLower(strings.TrimSpace(channel))
	if !models.ValidChannels[channel] {
		return nil, fmt.Errorf("%w: %s (allowed: %s)", ErrInvalidChannel, channel, strings.Join(validChannelList(), ", "))
	}

	// Validate non-empty config
	cfgMap, err := parseConfig(config)
	if err != nil {
		return nil, err
	}

	// Persist adapter
	a := &models.AlertNotificationAdapter{
		TenantID: tenantID,
		Name:     name,
		Channel:  channel,
		Config:   config,
		Status:   "enabled",
		Enabled:  true,
	}
	if err := f.repo.CreateAdapter(ctx, a); err != nil {
		return nil, fmt.Errorf("create adapter record failed: %w", err)
	}

	// Instantiate and validate handler
	h, err := f.getHandler(channel)
	if err != nil {
_, _ = f.repo.UpdateAdapter(ctx, tenantID, a.ID, &models.UpdateAdapterRequest{
			Status: strPtr("error"),
		})
		return nil, fmt.Errorf("%w: %v", ErrInitFailed, err)
	}

	if err := h.ValidateConfig(ctx, cfgMap); err != nil {
_, _ = f.repo.UpdateAdapter(ctx, tenantID, a.ID, &models.UpdateAdapterRequest{
			Status: strPtr("error"),
		})
		return nil, fmt.Errorf("%w: %v", ErrInitFailed, err)
	}

	if err := h.Initialize(ctx, cfgMap); err != nil {
_, _ = f.repo.UpdateAdapter(ctx, tenantID, a.ID, &models.UpdateAdapterRequest{
			Status: strPtr("error"),
		})
		return nil, fmt.Errorf("%w: %v", ErrInitFailed, err)
	}

	f.logger.Info("created notification adapter",
		zap.String("id", a.ID),
		zap.String("channel", channel),
		zap.String("tenant_id", tenantID),
	)

	return a, nil
}

// GetAdapter retrieves an adapter by ID with tenant isolation.
func (f *NotificationFactory) GetAdapter(ctx context.Context, tenantID, id string) (*models.AlertNotificationAdapter, error) {
	a, err := f.repo.GetAdapterByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if a.TenantID != tenantID {
		return nil, ErrTenantMismatch
	}
	return a, nil
}

// ListAdapters returns adapters for a tenant, optionally filtered by channel.
func (f *NotificationFactory) ListAdapters(ctx context.Context, tenantID, channel string, offset, limit int) ([]models.AlertNotificationAdapter, error) {
	items, err := f.repo.ListAdapters(ctx, tenantID, channel, offset, limit)
	if err != nil {
		return nil, err
	}
	if items == nil {
		return []models.AlertNotificationAdapter{}, nil
	}
	return items, nil
}

// UpdateAdapter updates an adapter.
func (f *NotificationFactory) UpdateAdapter(ctx context.Context, tenantID, id string, req *models.UpdateAdapterRequest) (*models.AlertNotificationAdapter, error) {
	if req.Status != nil && !models.ValidAdapterStatuses[*req.Status] {
		return nil, fmt.Errorf("%w: %s", ErrInvalidStatus, *req.Status)
	}
	if req.Channel != nil && !models.ValidChannels[*req.Channel] {
		return nil, fmt.Errorf("%w: %s", ErrInvalidChannel, *req.Channel)
	}
	return f.repo.UpdateAdapter(ctx, tenantID, id, req)
}

// DeleteAdapter soft-deletes an adapter (disables it).
func (f *NotificationFactory) DeleteAdapter(ctx context.Context, tenantID, id string) error {
	return f.repo.DeleteAdapter(ctx, tenantID, id)
}

// ===================================================================
// Template operations
// ===================================================================

// CreateTemplate creates a new notification template.
func (f *NotificationFactory) CreateTemplate(
	ctx context.Context,
	tenantID, name, channel string,
	template string,
	variables string,
) (*models.AlertNotificationTemplate, error) {
	channel = strings.ToLower(strings.TrimSpace(channel))
	if !models.ValidChannels[channel] {
		return nil, fmt.Errorf("%w: %s", ErrInvalidChannel, channel)
	}
	t := &models.AlertNotificationTemplate{
		TenantID:  tenantID,
		Name:      name,
		Channel:   channel,
		Template:  template,
		Variables: variables,
	}
	if err := f.repo.CreateTemplate(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

// ListTemplates returns templates for a tenant, optionally filtered by channel.
func (f *NotificationFactory) ListTemplates(ctx context.Context, tenantID, channel string, offset, limit int) ([]models.AlertNotificationTemplate, error) {
	items, err := f.repo.ListTemplates(ctx, tenantID, channel, offset, limit)
	if err != nil {
		return nil, err
	}
	if items == nil {
		return []models.AlertNotificationTemplate{}, nil
	}
	return items, nil
}

// GetTemplate retrieves a template by ID with tenant isolation.
func (f *NotificationFactory) GetTemplate(ctx context.Context, tenantID, id string) (*models.AlertNotificationTemplate, error) {
	return f.repo.GetTemplateByID(ctx, tenantID, id)
}

// ===================================================================
// SendNotification — core dispatch path
// ===================================================================

// SendNotification renders a template with variables, dispatches via the
// adapter's handler, and records the delivery event.
func (f *NotificationFactory) SendNotification(
	ctx context.Context,
	tenantID, adapterID, templateID, alertID string,
	variables map[string]string,
) (*models.AlertNotificationEvent, error) {
	// 1. Load adapter + check enabled
	a, err := f.GetAdapter(ctx, tenantID, adapterID)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrAdapterNotFound, err)
	}
	if !a.Enabled || a.Status != "enabled" {
		return nil, ErrAdapterDisabled
	}

	// 2. Load template
	tpl, err := f.GetTemplate(ctx, tenantID, templateID)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrTemplateNotFound, err)
	}

	// 3. Render template with variables
	rendered, err := renderTemplate(tpl.Template, variables)
	if err != nil {
		return nil, fmt.Errorf("template render failed: %w", err)
	}

	// 4. Build event record
	event := &models.AlertNotificationEvent{
		TenantID:  tenantID,
		AdapterID: adapterID,
		AlertID:   alertID,
		Payload:   rendered,
		Status:    "queued",
	}
	if err := f.repo.CreateEvent(ctx, event); err != nil {
		return nil, fmt.Errorf("create event failed: %w", err)
	}

	// 5. Dispatch via handler
	h, err := f.getHandler(a.Channel)
	if err != nil {
		_ = f.repo.MarkEventFailed(ctx, event.ID, err.Error())
		return nil, fmt.Errorf("%w: %v", ErrInitFailed, err)
	}

	if err := h.Send(ctx, rendered, variables); err != nil {
		now := time.Now().UTC()
		event.SentAt = &now
		event.Status = "sent"
		_ = f.repo.MarkEventSent(ctx, event.ID)
		_ = f.repo.MarkEventFailed(ctx, event.ID, err.Error())
_, _ = f.repo.UpdateAdapter(ctx, tenantID, a.ID, &models.UpdateAdapterRequest{
			Status: strPtr("error"),
		})
		f.logger.Error("notification send failed",
			zap.String("adapter_id", adapterID),
			zap.String("event_id", event.ID),
			zap.Error(err),
		)
		return event, fmt.Errorf("send failed: %w", err)
	}

	// 6. Mark delivered
	now := time.Now().UTC()
	event.SentAt = &now
	event.DeliveredAt = &now
	event.Status = "delivered"
	_ = f.repo.MarkEventDelivered(ctx, event.ID)

	f.logger.Debug("notification delivered",
		zap.String("adapter_id", adapterID),
		zap.String("event_id", event.ID),
		zap.String("channel", a.Channel),
	)

	return event, nil
}

// ===================================================================
// ListEvents
// ===================================================================

// ListEvents returns delivery events for an adapter.
func (f *NotificationFactory) ListEvents(
	ctx context.Context,
	tenantID, adapterID, status string,
	offset, limit int,
) ([]models.AlertNotificationEvent, error) {
	return f.repo.ListEventsByAdapter(ctx, tenantID, adapterID, status, offset, limit)
}

// ===================================================================
// Template helpers
// ===================================================================

// renderTemplate substitutes {{key}} placeholders in the template with values
// from the variables map.
func renderTemplate(tpl string, variables map[string]string) (string, error) {
	if variables == nil {
		return tpl, nil
	}
	result := tpl
	for k, v := range variables {
		result = strings.ReplaceAll(result, "{{"+k+"}}", v)
	}
	return result, nil
}

// ===================================================================
// Helpers
// ===================================================================

func strPtr(s string) *string {
	return &s
}

// validChannelList returns a sorted list of valid channel names.
func validChannelList() []string {
	list := make([]string, 0, len(models.ValidChannels))
	for ch := range models.ValidChannels {
		list = append(list, ch)
	}
	return list
}

// renderTemplateJSON unmarshals JSON variables, renders the template, and
// returns the result. Used when variables arrive as a JSON string.
func renderTemplateJSON(tpl, variablesJSON string) (string, error) {
	var vars map[string]string
	if variablesJSON != "" {
		if err := json.Unmarshal([]byte(variablesJSON), &vars); err != nil {
			return "", fmt.Errorf("variables JSON invalid: %w", err)
		}
	}
	return renderTemplate(tpl, vars)
}

// payloadToJSON marshals a notification payload into JSON bytes for logging.
func payloadToJSON(payload string) ([]byte, error) {
	b, err := json.MarshalIndent(map[string]string{"payload": payload}, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal payload failed: %w", err)
	}
	return b, nil
}

// buildEventPayload constructs the JSON payload string for an event.
func buildEventPayload(adapterID, templateID, rendered string, variables map[string]string) string {
	p := map[string]interface{}{
		"adapterId":  adapterID,
		"templateId": templateID,
		"rendered":   rendered,
	}
	if variables != nil {
		p["variables"] = variables
	}
	b, _ := json.Marshal(p)
	return string(b)
}

