// webhook_adapter.go implements the generic Webhook export adapter.
//
// It sends alerts to an arbitrary HTTP endpoint. This is the most flexible
// adapter and can be used to integrate with any external system that accepts
// JSON over HTTP.
//
// Configuration (passed via Start):
//   - url            — the webhook endpoint URL (required)
//   - method         — HTTP method (default: "POST")
//   - header_*       — custom headers (prefix "header_", e.g. "header_x_api_key")
//   - timeout_seconds — HTTP request timeout (default: 10)
//   - batch_size     — max alerts per request (default: 50)
//
// Unlike source adapters, this is an export adapter: Receive() is a no-op and
// SendAlert() (via the Receive callback contract) is the primary operation.
package spi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// WebhookAdapter
// ---------------------------------------------------------------------------

// WebhookAdapter is the SPI adapter for generic HTTP webhooks.
//
// Safe for concurrent use.
type WebhookAdapter struct {
	mu          sync.RWMutex
	name        string
	adapterType string
	status      AdapterStatus
	enabled     bool

	// config — set during Start
	url         string
	method      string
	headers     map[string]string
	client      *http.Client
	batchSize   int
}

// NewWebhookAdapter creates a new Webhook adapter instance.
func NewWebhookAdapter() AlertAdapter {
	return &WebhookAdapter{
		name:        "Webhook",
		adapterType: "webhook",
		status:      AdapterStatusNew,
		enabled:     true,
		method:      "POST",
		batchSize:   50,
	}
}

// Name returns the human-readable name.
func (a *WebhookAdapter) Name() string { return a.name }

// Type returns the canonical type key.
func (a *WebhookAdapter) Type() string { return a.adapterType }

// Start configures the adapter from the provided config map.
//
// Note: WebhookAdapter does not start a listener; it sends outbound HTTP
// requests on demand. The Start method validates and caches config only.
func (a *WebhookAdapter) Start(ctx context.Context, config map[string]string) (AdapterStatus, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.status == AdapterStatusRunning {
		return a.status, nil
	}

	url := config["url"]
	if url == "" {
		return AdapterStatusError, errors.New("webhook: url is required")
	}
	a.url = url

	if method := config["method"]; method != "" {
		a.method = method
	}

	timeout := config["timeout_seconds"]
	sec, _ := parseDuration(timeout)
	if sec <= 0 {
		sec = 10
	}
	a.client = &http.Client{Timeout: time.Duration(sec) * time.Second}

	if batchSize := config["batch_size"]; batchSize != "" {
		if n, _ := parseDuration(batchSize); n > 0 {
			a.batchSize = n
		}
	}

	// Extract custom headers (prefixed with "header_")
	a.headers = make(map[string]string)
	for k, v := range config {
		if strings.HasPrefix(strings.ToLower(k), "header_") {
			a.headers[strings.TrimPrefix(k, "header_")] = v
		}
	}

	// Validate URL (lightweight pre-flight)
	req, err := http.NewRequestWithContext(ctx, a.method, url, http.NoBody)
	if err != nil {
		return AdapterStatusError, fmt.Errorf("webhook: invalid url %q: %w", url, err)
	}
	_ = req // validated successfully

	a.status = AdapterStatusRunning
	return a.status, nil
}

// Stop gracefully shuts down the adapter.
func (a *WebhookAdapter) Stop(ctx context.Context) (AdapterStatus, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.client != nil {
		a.client.CloseIdleConnections()
	}
	a.status = AdapterStatusStopped
	return a.status, nil
}

// HealthCheck probes the webhook endpoint with a HEAD request.
func (a *WebhookAdapter) HealthCheck(ctx context.Context) (AdapterInfo, error) {
	info := AdapterInfo{
		Name:    a.name,
		Type:    a.adapterType,
		Status:  a.status,
		Enabled: a.enabled,
	}

	a.mu.RLock()
	url := a.url
	client := a.client
	a.mu.RUnlock()

	if url == "" || client == nil {
		info.Status = AdapterStatusUnavailable
		info.Error = "not configured"
		return info, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodHead, url, http.NoBody)
	if err != nil {
		info.Status = AdapterStatusError
		info.Error = fmt.Sprintf("failed to build request: %v", err)
		return info, nil
	}

	resp, err := client.Do(req)
	if err != nil {
		info.Status = AdapterStatusError
		info.Error = fmt.Sprintf("health check failed: %v", err)
		return info, nil
	}
	defer resp.Body.Close()

	// Webhook endpoints often don't support HEAD; accept 2xx and 405 Method Not Allowed
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		info.Status = AdapterStatusRunning
		info.Error = ""
		return info, nil
	}
	if resp.StatusCode == 405 {
		info.Status = AdapterStatusRunning
		info.Error = "webhook endpoint does not support HEAD (accepted as healthy)"
		return info, nil
	}

	info.Status = AdapterStatusError
	info.Error = fmt.Sprintf("health check returned HTTP %d", resp.StatusCode)
	return info, nil
}

// Receive is a no-op for export adapters — webhooks only send outbound.
//
// The alerts parameter is the batch of alerts to be dispatched. The adapter
// sends the batch via HTTP POST and returns the alerts that were successfully
// delivered.
func (a *WebhookAdapter) Receive(ctx context.Context, alerts []Alert) ([]Alert, error) {
	a.mu.RLock()
	url := a.url
	client := a.client
	method := a.method
	batchSize := a.batchSize
	headers := a.headers
	a.mu.RUnlock()

	if client == nil {
		return nil, errors.New("adapter not started")
	}

	if alerts == nil || len(alerts) == 0 {
		return nil, nil
	}

	// Build batch payload
	batch := make([]Alert, 0, batchSize)
	if len(alerts) > batchSize {
		batch = alerts[:batchSize]
	} else {
		batch = alerts
	}

	payload := map[string]interface{}{
		"source": "orion-platform",
		"time":   time.Now().UTC().Format(time.RFC3339),
		"alerts": batch,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to build webhook request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("webhook POST failed: %w", err)
	}
	defer resp.Body.Close()

	// Drain body
	_, _ = io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("webhook returned HTTP %d", resp.StatusCode)
	}

	return batch, nil
}
