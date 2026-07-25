// grafana_adapter.go implements the Grafana source adapter.
//
// It receives alerts from a Grafana Alerting API and converts them into the
// canonical Alert model.
//
// Configuration (passed via Start):
//   - api_url      — base URL of the Grafana API (e.g. "http://localhost:3000")
//   - api_key      — Grafana API key for authentication (optional)
//   - timeout_seconds — HTTP request timeout (default: 10)
//   - tenant_id    — tenant ID to attach to received alerts
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
// GrafanaAdapter
// ---------------------------------------------------------------------------

// GrafanaAdapter is the SPI adapter for Grafana Alerting.
//
// Safe for concurrent use.
type GrafanaAdapter struct {
	mu          sync.RWMutex
	name        string
	adapterType string
	status      AdapterStatus
	enabled     bool

	// config — set during Start
	apiURL  string
	apiKey  string
	client  *http.Client
	tenantID string
}

// NewGrafanaAdapter creates a new Grafana adapter instance.
func NewGrafanaAdapter() AlertAdapter {
	return &GrafanaAdapter{
		name:        "Grafana",
		adapterType: "grafana",
		status:      AdapterStatusNew,
		enabled:     true,
	}
}

// Name returns the human-readable name.
func (a *GrafanaAdapter) Name() string { return a.name }

// Type returns the canonical type key.
func (a *GrafanaAdapter) Type() string { return a.adapterType }

// Start configures the adapter from the provided config map.
func (a *GrafanaAdapter) Start(ctx context.Context, config map[string]string) (AdapterStatus, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.status == AdapterStatusRunning {
		return a.status, nil
	}

	url := config["api_url"]
	if url == "" {
		return AdapterStatusError, errors.New("grafana: api_url is required")
	}
	a.apiURL = url

	a.apiKey = config["api_key"]

	timeout := config["timeout_seconds"]
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
func (a *GrafanaAdapter) Stop(ctx context.Context) (AdapterStatus, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.client != nil {
		a.client.CloseIdleConnections()
	}
	a.status = AdapterStatusStopped
	return a.status, nil
}

// HealthCheck probes the Grafana API health endpoint.
func (a *GrafanaAdapter) HealthCheck(ctx context.Context) (AdapterInfo, error) {
	info := AdapterInfo{
		Name:    a.name,
		Type:    a.adapterType,
		Status:  a.status,
		Enabled: a.enabled,
	}

	a.mu.RLock()
	url := a.apiURL
	client := a.client
	a.mu.RUnlock()

	if url == "" || client == nil {
		info.Status = AdapterStatusUnavailable
		info.Error = "not configured"
		return info, nil
	}

	healthURL := url + "/api/health"
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

// Receive pulls active alert instances from the Grafana Alerting API and
// converts them to canonical Alert objects.
//
// The alerts parameter is ignored (kept for SPI contract compatibility).
func (a *GrafanaAdapter) Receive(ctx context.Context, _ []Alert) ([]Alert, error) {
	a.mu.RLock()
	url := a.apiURL
	client := a.client
	tenantID := a.tenantID
	aKey := a.apiKey
	a.mu.RUnlock()

	if client == nil {
		return nil, errors.New("adapter not started")
	}

	// Grafana alerting API v2 — list active alert instances
	alertURL := url + "/api/v1/alerts/state/firing"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, alertURL, http.NoBody)
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if aKey != "" {
		req.Header.Set("Authorization", "Bearer "+aKey)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query grafana: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("grafana returned HTTP %d", resp.StatusCode)
	}

	// Decode Grafana response
	var gfAlerts []gfAlertResponse
	if err := json.NewDecoder(resp.Body).Decode(&gfAlerts); err != nil {
		return nil, fmt.Errorf("failed to decode grafana response: %w", err)
	}

	// Convert to canonical Alert model
	alerts := make([]Alert, 0, len(gfAlerts))
	for _, gfa := range gfAlerts {
		labels := make(map[string]string, len(gfa.Labels))
		for k, v := range gfa.Labels {
			labels[k] = v
		}
		alert := Alert{
			ID:          fmt.Sprintf("%s-%s", gfa.AlertName, gfa.Labels["uid"]),
			TenantID:    tenantID,
			Title:       gfa.AlertName,
			Message:     gfa.Annotations,
			Severity:    labels["severity"],
			Source:      "grafana",
			Labels:      labels,
			Fingerprint: gfa.UID,
			GeneratedAt: gfa.Updated.Format(time.RFC3339),
			Status:      "firing",
		}
		if alert.Severity == "" {
			alert.Severity = SeverityInfo
		}
		alerts = append(alerts, alert)
	}

	return alerts, nil
}

// ---------------------------------------------------------------------------
// Internal Grafana response model
// ---------------------------------------------------------------------------

type gfAlertResponse struct {
	State       string            `json:"state"`
	Title       string            `json:"title"`
	AlertName   string            `json:"alertName"`
	UID         string            `json:"uid"`
	Labels      map[string]string `json:"labels"`
	Annotations string            `json:"annotations"`
	Updated     time.Time         `json:"updated"`
	EvaluatedAt time.Time         `json:"evaluatedAt"`
}
