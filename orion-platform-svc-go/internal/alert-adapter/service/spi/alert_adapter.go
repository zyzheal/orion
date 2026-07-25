// Package spi defines the Alert Adapter Service Provider Interface (SPI) for
// the Orion Go microservice alerting system.
//
// The SPI is inspired by NeatLogic's IAdapter pattern and sits on top of the
// existing AlertAdapterHandler contract. It provides:
//
//   - A canonical Alert model with labels, fingerprint, and severity
//   - An AdapterStatus enum covering the full adapter lifecycle
//   - The AlertAdapter interface that every pluggable adapter must implement
//   - A Registry for discovering and registering new adapters by type
//   - Lifecycle management helpers (Start/Stop/HealthCheck)
//
// Usage:
//
//   reg := spi.NewRegistry(logger)
//   reg.Register(spi.NewPrometheusAdapter())
//   reg.Register(spi.NewGrafanaAdapter())
//   reg.Register(spi.NewWebhookAdapter())
//
//   adapters := reg.Discover("source")  // all source-type adapters
//   for _, a := range adapters {
//       status, err := a.Start(ctx, cfg)
//       if err != nil { ... }
//   }
package spi

import "context"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Severity levels for alerts.
const (
	SeverityInfo      = "info"
	SeverityWarning   = "warning"
	SeverityCritical  = "critical"
	SeverityEmergency = "emergency"
)

// ---------------------------------------------------------------------------
// Alert — canonical alert model
// ---------------------------------------------------------------------------

// Alert is the canonical alert payload exchanged between adapters and the
// registry. Every adapter's Receive() returns []Alert and every Send() call
// accepts an Alert.
type Alert struct {
	// ID is a globally unique alert identifier (UUID).
	ID string `json:"id"`

	// TenantID scopes the alert to a specific tenant for multi-tenancy.
	TenantID string `json:"tenant_id"`

	// Title is a short human-readable alert name.
	Title string `json:"title"`

	// Message is the free-text description of the alert.
	Message string `json:"message"`

	// Severity indicates the urgency: info, warning, critical, emergency.
	Severity string `json:"severity"`

	// Source identifies the origin system (e.g. "prometheus-node-exporter").
	Source string `json:"source"`

	// Labels is an arbitrary key-value map for prometheus-style labels.
	// Examples: {service: "orion-platform", region: "us-east-1"}.
	Labels map[string]string `json:"labels"`

	// Fingerprint is a hash derived from labels+source for deduplication.
	Fingerprint string `json:"fingerprint"`

	// GeneratedAt is when the alert was originally fired.
	GeneratedAt string `json:"generated_at"`

	// Status is the current lifecycle state of the alert (firing, resolved, silenced).
	Status string `json:"status"`
}

// ---------------------------------------------------------------------------
// AdapterStatus — lifecycle state of an adapter
// ---------------------------------------------------------------------------

// AdapterStatus represents the runtime state of a registered adapter.
type AdapterStatus string

const (
	AdapterStatusNew         AdapterStatus = "new"          // registered, not started
	AdapterStatusRunning     AdapterStatus = "running"      // actively sending/receiving alerts
	AdapterStatusStopped     AdapterStatus = "stopped"      // explicitly stopped
	AdapterStatusError       AdapterStatus = "error"        // failed during start/operation
	AdapterStatusUnavailable AdapterStatus = "unavailable"  // start failed; retry required
)

// IsHealthy reports whether this status is considered operational.
func (s AdapterStatus) IsHealthy() bool {
	return s == AdapterStatusRunning
}

// AdapterInfo is returned by Status() to give the caller a detailed snapshot.
type AdapterInfo struct {
	// Name is the human-readable adapter name.
	Name string `json:"name"`

	// Type is the canonical adapter type (e.g. "prometheus").
	Type string `json:"type"`

	// Status is the current lifecycle state.
	Status AdapterStatus `json:"status"`

	// Enabled indicates whether the adapter is allowed to operate.
	Enabled bool `json:"enabled"`

	// Error holds the last error message (empty if healthy).
	Error string `json:"error,omitempty"`
}

// ---------------------------------------------------------------------------
// AlertAdapter — SPI contract
// ---------------------------------------------------------------------------

// AlertAdapter is the pluggable interface every adapter implementation must
// satisfy. It abstracts the lifecycle of a single external alerting source or
// sink (Prometheus, Grafana, custom webhooks, etc.).
//
// Implementations must be safe for concurrent use.
type AlertAdapter interface {
	// Name returns the human-readable name (e.g. "Prometheus").
	Name() string

	// Type returns the canonical type key (e.g. "prometheus", "grafana", "webhook").
	Type() string

	// Receive returns a batch of canonical Alert objects from the external system.
	// Implementations may block briefly to collect a batch, but must honour ctx
	// cancellation.
	Receive(ctx context.Context, alerts []Alert) ([]Alert, error)

	// Start begins the adapter's operation using the given configuration.
	// Returns the initial AdapterStatus.
	Start(ctx context.Context, config map[string]string) (AdapterStatus, error)

	// Stop gracefully shuts down the adapter and releases held resources.
	// Returns the final AdapterStatus.
	Stop(ctx context.Context) (AdapterStatus, error)

	// HealthCheck probes the adapter and returns a detailed status snapshot.
	HealthCheck(ctx context.Context) (AdapterInfo, error)
}
