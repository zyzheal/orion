// Package service provides the Alert Adapter SPI factory and business logic.
//
// Inspired by NeatLogic's IAdapter SPI pattern: the factory maintains a registry
// of typed AlertAdapterHandler implementations. Each handler knows how to send to
// or receive from a specific external alert system (Prometheus, Zabbix, Grafana,
// Kafka, webhook, email, SMS, WeChat, Slack, PagerDuty).
//
// SPI contract:
//   AlertAdapterHandler — the pluggable interface each adapter type must implement.
//
// Flow:
//   1. POST /api/alert-adapters → CreateAdapter validates and persists adapter
//      config, instantiates the handler, calls Initialize(config).
//   2. POST /:id/send → SendToAdapter dispatches the alert to the handler.Send().
//   3. POST /:id/receive → ReceiveFromAdapter calls handler.Receive() and records
//      events.
//   4. GET /:id/events → ListEventsByAdapter.
package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/alert-adapter/models"
	"orion/platform-svc-go/internal/alert-adapter/repository"

	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// SPI Interface
// ---------------------------------------------------------------------------

// AlertAdapterHandler is the pluggable SPI contract for alert adapter implementations.
// Each adapter type (prometheus, zabbix, grafana, kafka, webhook, email, sms,
// wechat, slack, pagerduty) must provide an implementation.
//
// Implementations should not store state beyond what Initialize provides; the
// factory calls Initialize once at adapter creation and Shutdown at teardown.
type AlertAdapterHandler interface {
	// Name returns the human-readable adapter name.
	Name() string

	// Type returns the canonical adapter type (e.g. "prometheus", "email").
	Type() string

	// Category returns the adapter category: "source", "notification", or "export".
	Category() string

	// Initialize configures the handler with its runtime config.
	Initialize(ctx context.Context, config map[string]string) error

	// Send dispatches an alert payload to the external system.
	Send(ctx context.Context, alert map[string]interface{}) error

	// Receive pulls any pending alerts from the external system.
	Receive(ctx context.Context) ([]map[string]interface{}, error)

	// ValidateConfig checks that the config is well-formed before Initialize.
	ValidateConfig(ctx context.Context, config map[string]string) error

	// Shutdown releases any held resources (HTTP clients, connections, goroutines).
	Shutdown(ctx context.Context) error
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

var (
	ErrInvalidType     = errors.New("invalid adapter type")
	ErrInvalidCategory = errors.New("invalid adapter category")
	ErrInvalidConfig   = errors.New("invalid adapter config")
	ErrInvalidStatus   = errors.New("invalid adapter status")
	ErrAdapterDisabled = errors.New("adapter is disabled")
	ErrNoHandler       = errors.New("no handler registered for adapter type")
	ErrAdapterNotFound = errors.New("adapter not found")
	ErrInitFailed      = errors.New("adapter initialization failed")
	ErrShutdownFailed  = errors.New("adapter shutdown failed")
)

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// AlertAdapterFactory manages the adapter handler registry and adapter lifecycle.
//
// The factory is thread-safe: Register and GetHandler can be called concurrently.
// Handlers created during CreateAdapter are stored and shut down on FactoryShutdown.
type AlertAdapterFactory struct {
	// handlerConstructors maps type -> constructor function that returns a fresh
	// (uninitialized) handler instance. Storing constructors instead of shared
	// singletons prevents Initialize() from overwriting config across adapters of
	// the same type (see Issue 5 fix).
	handlerConstructors map[string]func() AlertAdapterHandler
	initialized         map[string]AlertAdapterHandler // adapters currently initialized, keyed by adapterID
	repo                *repository.Repository
	logger              *zap.Logger
	mu                  sync.RWMutex
}

// NewFactory creates a new AlertAdapterFactory with the given repository and logger.
func NewFactory(repo *repository.Repository, logger *zap.Logger) *AlertAdapterFactory {
	return &AlertAdapterFactory{
		repo:                repo,
		logger:              logger,
		handlerConstructors: make(map[string]func() AlertAdapterHandler),
		initialized:         make(map[string]AlertAdapterHandler),
	}
}

// Register registers a constructor for a typed handler with the factory.
//
// The constructor must return a fresh, uninitialized AlertAdapterHandler on each
// call. This prevents shared mutable state between adapters of the same type.
// Each call for the same type overwrites the previous constructor.
func (f *AlertAdapterFactory) Register(t string, constructor func() AlertAdapterHandler) {
	t = strings.ToLower(strings.TrimSpace(t))
	if t == "" || constructor == nil {
		return
	}
	// Probe the constructor once to extract metadata for logging.
	probe := constructor()
	if probe == nil {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.handlerConstructors[t] = constructor
	f.logger.Info("registered alert adapter handler",
		zap.String("type", t),
		zap.String("name", probe.Name()),
		zap.String("category", probe.Category()),
	)
}

// GetHandler creates a fresh (uninitialized) handler instance for the given type
// by calling the registered constructor. Each call returns an independent object,
// so Initialize() can be called safely without clobbering another adapter.
func (f *AlertAdapterFactory) GetHandler(t string) (AlertAdapterHandler, error) {
	t = strings.ToLower(strings.TrimSpace(t))
	f.mu.RLock()
	constructor, ok := f.handlerConstructors[t]
	f.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrNoHandler, t)
	}
	return constructor(), nil
}

// CreateAdapter validates the adapter config, persists the adapter record,
// instantiates the handler, and calls Initialize.
func (f *AlertAdapterFactory) CreateAdapter(
	ctx context.Context,
	tenantID, name, atype, category string,
	config map[string]string,
) (*models.AlertAdapter, error) {
	atype = strings.ToLower(strings.TrimSpace(atype))
	category = strings.ToLower(strings.TrimSpace(category))

	// Validate type and category
	if !models.ValidAdapterTypes[atype] {
		return nil, fmt.Errorf("%w: %s (allowed: prometheus, zabbix, grafana, kafka, webhook, email, sms, wechat, slack, pagerduty)", ErrInvalidType, atype)
	}
	if !models.ValidAdapterCategories[category] {
		return nil, fmt.Errorf("%w: %s (allowed: source, notification, export)", ErrInvalidCategory, category)
	}

	// Marshal config to JSON string
	cfgJSON, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidConfig, err)
	}

	// Persist adapter
	a := &models.AlertAdapter{
		TenantID: tenantID,
		Name:     name,
		Type:     atype,
		Category: category,
		Config:   string(cfgJSON),
		Status:   "enabled",
		Enabled:  true,
	}
	if err := f.repo.CreateAdapter(ctx, a); err != nil {
		return nil, fmt.Errorf("create adapter record failed: %w", err)
	}

	// Instantiate and initialize handler
	h, err := f.GetHandler(atype)
	if err != nil {
		// Record failure on the adapter
		_ = f.repo.UpdateAdapter(ctx, a.ID, nil, nil, nil, nil, nil, strPtr("error"), strPtr("no handler available"))
		return nil, fmt.Errorf("%w: %v", ErrInitFailed, err)
	}

	// Validate before initialize
	if err := h.ValidateConfig(ctx, config); err != nil {
		_ = f.repo.UpdateAdapter(ctx, a.ID, nil, nil, nil, nil, nil, strPtr("error"), strPtr(err.Error()))
		return nil, fmt.Errorf("%w: %v", ErrInitFailed, err)
	}

	if err := h.Initialize(ctx, config); err != nil {
		_ = f.repo.UpdateAdapter(ctx, a.ID, nil, nil, nil, nil, nil, strPtr("error"), strPtr(err.Error()))
		return nil, fmt.Errorf("%w: %v", ErrInitFailed, err)
	}

	f.mu.Lock()
	f.initialized[a.ID] = h
	f.mu.Unlock()

	f.logger.Info("created and initialized alert adapter",
		zap.String("id", a.ID),
		zap.String("type", atype),
		zap.String("category", category),
		zap.String("tenant_id", tenantID),
	)

	return a, nil
}

// ListAdapters returns paginated adapters for the given tenant.
func (f *AlertAdapterFactory) ListAdapters(ctx context.Context, tenantID string) ([]models.AlertAdapter, error) {
	return f.repo.ListAdapters(ctx, tenantID, "", "", 0, 100)
}

// GetAdapter returns a single adapter by ID, with multi-tenant guard.
func (f *AlertAdapterFactory) GetAdapter(ctx context.Context, tenantID, id string) (*models.AlertAdapter, error) {
	a, err := f.repo.GetAdapterByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if tenantID != "" && a.TenantID != tenantID {
		return nil, fmt.Errorf("%w: %s", ErrAdapterNotFound, id)
	}
	return a, nil
}

// SendToAdapter retrieves the initialized handler for the adapter, sends the alert,
// and records an AlertEvent in the audit trail.
func (f *AlertAdapterFactory) SendToAdapter(
	ctx context.Context,
	adapterID string,
	alert map[string]interface{},
) (*models.AlertEvent, error) {
	// Get adapter and check enabled
	a, err := f.repo.GetAdapterByID(ctx, adapterID)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrAdapterNotFound, adapterID)
	}
	if !a.Enabled || a.Status != "enabled" {
		return nil, ErrAdapterDisabled
	}

	// Get initialized handler
	handler := f.getInitializedHandler(adapterID)
	if handler == nil {
		return nil, fmt.Errorf("no initialized handler for adapter %s", adapterID)
	}

	// Create event record (status=received)
	event := &models.AlertEvent{
		TenantID: a.TenantID,
		AdapterID: adapterID,
		Source:   fmt.Sprintf("%s-%s", a.Type, a.Name),
		Severity: "info",
		Status:   "received",
	}
	if s, ok := alert["severity"].(string); ok {
		event.Severity = s
	}
	if t, ok := alert["title"].(string); ok {
		event.Title = t
	}
	if m, ok := alert["message"].(string); ok {
		event.Message = m
	}
	if src, ok := alert["source"].(string); ok {
		event.Source = src
	}

	// Marshal payload and labels
	payloadJSON, _ := json.Marshal(alert)
	event.Payload = string(payloadJSON)

	labels := make(map[string]interface{})
	if l, ok := alert["labels"]; ok {
		switch v := l.(type) {
		case map[string]interface{}:
			labels = v
		case map[string]string:
			for k, w := range v {
				labels[k] = w
			}
		}
	}
	labelsJSON, _ := json.Marshal(labels)
	event.Labels = string(labelsJSON)

	if err := f.repo.CreateEvent(ctx, event); err != nil {
		return nil, fmt.Errorf("create event failed: %w", err)
	}

	// Send via handler
	if err := handler.Send(ctx, alert); err != nil {
		_ = f.repo.MarkEventFailed(ctx, event.ID, err.Error())
		_ = f.repo.UpdateAdapter(ctx, adapterID, nil, nil, nil, nil, nil, strPtr("error"), strPtr(err.Error()))
		return event, fmt.Errorf("send failed: %w", err)
	}

	// Mark processed
	now := time.Now().UTC()
	event.ProcessedAt = &now
	event.Status = "processed"
	_ = f.repo.MarkEventProcessed(ctx, event.ID)

	f.logger.Debug("alert sent via adapter",
		zap.String("adapter_id", adapterID),
		zap.String("event_id", event.ID),
	)

	return event, nil
}

// ReceiveFromAdapter pulls alerts from the adapter via its handler and records them.
func (f *AlertAdapterFactory) ReceiveFromAdapter(
	ctx context.Context,
	adapterID string,
) ([]models.AlertEvent, error) {
	// Get adapter and check enabled
	a, err := f.repo.GetAdapterByID(ctx, adapterID)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrAdapterNotFound, adapterID)
	}
	if !a.Enabled || a.Status != "enabled" {
		return nil, ErrAdapterDisabled
	}

	// Handler must be a source-type adapter
	handler := f.getInitializedHandler(adapterID)
	if handler == nil {
		return nil, fmt.Errorf("no initialized handler for adapter %s", adapterID)
	}

	// Receive from handler
	alerts, err := handler.Receive(ctx)
	if err != nil {
		return nil, fmt.Errorf("receive failed: %w", err)
	}
	if alerts == nil {
		return []models.AlertEvent{}, nil
	}

	// Record each received alert as an AlertEvent
	events := make([]models.AlertEvent, 0, len(alerts))
	for _, alert := range alerts {
		event := &models.AlertEvent{
			TenantID:  a.TenantID,
			AdapterID: adapterID,
			Source:    fmt.Sprintf("%s-%s", a.Type, a.Name),
			Severity:  "info",
			Status:    "received",
		}
		if s, ok := alert["severity"].(string); ok {
			event.Severity = s
		}
		if t, ok := alert["title"].(string); ok {
			event.Title = t
		}
		if m, ok := alert["message"].(string); ok {
			event.Message = m
		}
		if src, ok := alert["source"].(string); ok {
			event.Source = src
		}

		payloadJSON, _ := json.Marshal(alert)
		event.Payload = string(payloadJSON)

		labels := make(map[string]interface{})
		if l, ok := alert["labels"]; ok {
			switch v := l.(type) {
			case map[string]interface{}:
				labels = v
			case map[string]string:
				for k, w := range v {
					labels[k] = w
				}
			}
		}
		labelsJSON, _ := json.Marshal(labels)
		event.Labels = string(labelsJSON)

		if err := f.repo.CreateEvent(ctx, event); err != nil {
			f.logger.Error("failed to create event for received alert",
				zap.Error(err),
				zap.String("adapter_id", adapterID),
			)
			continue
		}
		events = append(events, *event)
	}

	f.logger.Info("received alerts from adapter",
		zap.String("adapter_id", adapterID),
		zap.Int("count", len(events)),
	)

	return events, nil
}

// ListEvents returns paginated events for an adapter.
func (f *AlertAdapterFactory) ListEvents(
	ctx context.Context,
	tenantID, adapterID string,
	status string,
	offset, limit int,
) ([]models.AlertEvent, error) {
	return f.repo.ListEventsByAdapter(ctx, adapterID, tenantID, status, offset, limit)
}

// Shutdown cleanly shuts down all initialized handlers and releases resources.
func (f *AlertAdapterFactory) Shutdown(ctx context.Context) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	var lastErr error
	for id, h := range f.initialized {
		if err := h.Shutdown(ctx); err != nil {
			f.logger.Error("failed to shutdown handler",
				zap.String("adapter_id", id),
				zap.Error(err),
			)
			if lastErr == nil {
				lastErr = fmt.Errorf("%w for %s: %v", ErrShutdownFailed, id, err)
			}
		}
	}
	f.initialized = make(map[string]AlertAdapterHandler)
	return lastErr
}

// getInitializedHandler returns the currently initialized handler for an adapter.
// Safe for concurrent use.
func (f *AlertAdapterFactory) getInitializedHandler(adapterID string) AlertAdapterHandler {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.initialized[adapterID]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func strPtr(s string) *string {
	return &s
}
