// prometheus_adapter.go implements the Prometheus source adapter.
//
// It receives alerts from a Prometheus Alertmanager API endpoint and converts
// them into the canonical Alert model.
//
// Configuration (passed via Start):
//   - alertmanager_url   — base URL of the Alertmanager (e.g. "http://localhost:9093")
//   - timeout_seconds    — HTTP request timeout (default: 10)
//   - tenant_id          — tenant ID to attach to received alerts
package spi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// PrometheusAdapter
// ---------------------------------------------------------------------------

// PrometheusAdapter is the SPI adapter for Prometheus Alertmanager.
//
// It is safe for concurrent use.
type PrometheusAdapter struct {
	mu          sync.RWMutex
	name        string
	adapterType string
	status      AdapterStatus
	enabled     bool

	// config — set during Start, immutable during operation
	alertmanagerURL string
	client          *http.Client
	tenantID        string
}

// NewPrometheusAdapter creates a new Prometheus adapter instance.
func NewPrometheusAdapter() AlertAdapter {
	return &PrometheusAdapter{
		name:        "Prometheus",
		adapterType: "prometheus",
		status:      AdapterStatusNew,
		enabled:     true,
	}
}

// Name returns the human-readable name.
func (a *PrometheusAdapter) Name() string { return a.name }

// Type returns the canonical type key.
func (a *PrometheusAdapter) Type() string { return a.adapterType }

// Start configures the adapter from the provided config map.
func (a *PrometheusAdapter) Start(ctx context.Context, config map[string]string) (AdapterStatus, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.status == AdapterStatusRunning {
		return a.status, nil
	}

	url := config["alertmanager_url"]
	if url == "" {
		return AdapterStatusError, errors.New("prometheus: alertmanager_url is required")
	}
	a.alertmanagerURL = url

	timeout := config["timeout_seconds"]
	if timeout == "" {
		timeout = "10"
	}
	sec, _ := parseDuration(timeout)
	if sec <= 0 {
		sec = 10
	}
	a.client = &http.Client{Timeout: time.Duration(sec) * time.Second}

	if tid := config["tenant_id"]; tid != "" {
		a.tenantID = tid
	}

	a.status = AdapterStatusRunning
	return a.status, nil
}

// Stop gracefully shuts down the adapter.
func (a *PrometheusAdapter) Stop(ctx context.Context) (AdapterStatus, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.client != nil {
		a.client.CloseIdleConnections()
	}
	a.status = AdapterStatusStopped
	return a.status, nil
}

// HealthCheck probes the Alertmanager endpoint.
func (a *PrometheusAdapter) HealthCheck(ctx context.Context) (AdapterInfo, error) {
	info := AdapterInfo{
		Name:    a.name,
		Type:    a.adapterType,
		Status:  a.status,
		Enabled: a.enabled,
	}

	a.mu.RLock()
	url := a.alertmanagerURL
	client := a.client
	a.mu.RUnlock()

	if url == "" || client == nil {
		info.Status = AdapterStatusUnavailable
		info.Error = "not configured"
		return info, nil
	}

	healthURL := url + "/-/healthy"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, healthURL, http.NoBody)
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

	if resp.StatusCode == 200 {
		info.Status = AdapterStatusRunning
		info.Error = ""
		return info, nil
	}

	info.Status = AdapterStatusError
	info.Error = fmt.Sprintf("health check returned HTTP %d", resp.StatusCode)
	return info, nil
}

// Receive pulls pending alerts from the Alertmanager API and converts them
// into canonical Alert objects.
//
// The alerts parameter is the current batch (ignored by this adapter; kept for
// SPI contract compatibility with the existing AlertAdapterHandler interface).
func (a *PrometheusAdapter) Receive(ctx context.Context, _ []Alert) ([]Alert, error) {
	a.mu.RLock()
	url := a.alertmanagerURL
	client := a.client
	tenantID := a.tenantID
	a.mu.RUnlock()

	if client == nil {
		return nil, errors.New("adapter not started")
	}

	// Fetch active alerts from Alertmanager v2 API
	alertURL := url + "/api/v2/alerts"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, alertURL, http.NoBody)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query alertmanager: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("alertmanager returned HTTP %d", resp.StatusCode)
	}

	// Decode Alertmanager response
	var amAlerts []amAlertResponse
	if err := json.NewDecoder(resp.Body).Decode(&amAlerts); err != nil {
		return nil, fmt.Errorf("failed to decode alertmanager response: %w", err)
	}

	// Convert to canonical Alert model
	alerts := make([]Alert, 0, len(amAlerts))
	for _, aam := range amAlerts {
		status := "firing"
		if aam.Status == "resolved" {
			status = "resolved"
		}
		alert := Alert{
			ID:          aam.Labels["alertname"] + "-" + aam.Labels["instance"] + "-" + aam.Labels["fingerprint"],
			TenantID:    tenantID,
			Title:       aam.Labels["alertname"],
			Message:     aam.Annotations["description"],
			Severity:    aam.Labels["severity"],
			Source:      aam.Labels["source"],
			Labels:      aam.Labels,
			Fingerprint: aam.Fingerprint,
			GeneratedAt: aam.EndsAt.Format(time.RFC3339),
			Status:      status,
		}
		if aam.Status == "resolved" {
			status = "resolved"
		}
		_ = status
		alert.Status = status
		if alert.Severity == "" {
			alert.Severity = SeverityInfo
		}
		alerts = append(alerts, alert)
	}

	return alerts, nil
}

// ---------------------------------------------------------------------------
// Internal Alertmanager response model
// ---------------------------------------------------------------------------

type amAlertResponse struct {
	Status     string            `json:"status"`
	Labels     map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Fingerprint string           `json:"fingerprint"`
	EndsAt     time.Time         `json:"endsAt"`
	StartsAt   time.Time         `json:"startsAt"`
	UpdatedAt  time.Time         `json:"updatedAt"`
}

// parseDuration parses an integer string as seconds.
func parseDuration(s string) (int, error) {
	var sec int
	_, err := fmt.Sscanf(s, "%d", &sec)
	return sec, err
}
