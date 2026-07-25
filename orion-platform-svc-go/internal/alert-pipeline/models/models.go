package models

import (
	"time"
)

// AlertStage represents the current processing stage of an alert within the
// pipeline.  It tracks progression so downstream stages know where an alert
// came from and what transformations have been applied.
type AlertStage struct {
	Stage   string `json:"stage"`
	Entered time.Time
	ExitCode string // "ok", "skipped", "dropped", "error"
	ExitMsg  string
}

// AlertContext is the runtime context that travels through the pipeline.  Each
// stage receives the same context, enriches it, and passes it along.
type AlertContext struct {
	TenantID    string                 `json:"tenant_id"`
	AlertID     string                 `json:"alert_id"`
	Source      string                 `json:"source"` // adapter type (prometheus, grafana, webhook)
	Alert       map[string]interface{} `json:"alert"`
	Stage       AlertStage             `json:"stage"`
	History     []AlertStage           `json:"history"`
	Enrichments   map[string]interface{} `json:"enrichments,omitempty"`
	GroupID       string                 `json:"group_id,omitempty"`
	Routes        []string               `json:"routes,omitempty"`
	IsDuplicate   bool                   `json:"is_duplicate"`
	Error         string                 `json:"error,omitempty"`
}

// NewAlertContext creates a fresh pipeline context for an incoming alert.
func NewAlertContext(tenantID, alertID, source string, alert map[string]interface{}) *AlertContext {
	now := time.Now().UTC()
	return &AlertContext{
		TenantID:    tenantID,
		AlertID:     alertID,
		Source:      source,
		Alert:       alert,
		Stage:       AlertStage{Stage: "receive", Entered: now},
		History:     []AlertStage{},
		Enrichments: make(map[string]interface{}),
	}
}

// Snapshot records the current stage so downstream stages have a history.
func (c *AlertContext) Snapshot(exitCode, exitMsg string) {
	exit := c.Stage.ExitCode
	if exit == "" {
		exit = "ok"
	}
	c.Stage.ExitCode = exit
	c.Stage.ExitMsg = exitMsg
	c.History = append(c.History, c.Stage)
	c.Stage = AlertStage{
		Stage:   "unknown",
		Entered: time.Now().UTC(),
	}
}

// PipelineConfig holds the global configuration for an alert pipeline instance.
type PipelineConfig struct {
	Name              string `json:"name"`
	TenantID          string `json:"tenant_id"`
	Enabled           bool   `json:"enabled"`
	Stages            []string
	MaxRetries        int           `json:"maxRetries"`
	RetryDelay        time.Duration `json:"retryDelay"`
	StageTimeout      time.Duration `json:"stageTimeout"`
	DeadLetterEnabled bool          `json:"deadLetterEnabled"`
}

// DefaultPipelineConfig returns a reasonable default pipeline configuration.
func DefaultPipelineConfig(name string) *PipelineConfig {
	return &PipelineConfig{
		Name:              name,
		Enabled:           true,
		Stages:            []string{"receive", "dedup", "enrich", "route", "notify"},
		MaxRetries:        3,
		RetryDelay:        time.Second,
		StageTimeout:      5 * time.Second,
		DeadLetterEnabled: true,
	}
}

// PipelineResult is returned after the pipeline finishes processing an alert.
type PipelineResult struct {
	AlertID   string `json:"alertId"`
	Status    string `json:"status"` // "success", "dropped", "error"
	Stages    []string
	StageCount int
	Errors    []string
}

// AlertEvent is the typed event emitted when an alert is ingested.  It mirrors
// the alert-adapter models but is independent so the pipeline does not import
// sibling internal packages (keeping the build lightweight and avoid ordering).
type AlertEvent struct {
	ID          string                 `json:"id"`
	TenantID    string                 `json:"tenant_id"`
	Name        string                 `json:"name"`
	Severity    string                 `json:"severity"`
	Status      string                 `json:"status"`
	Fingerprint string                 `json:"fingerprint"`
	SourceType  string                 `json:"sourceType"`
	SourceID    string                 `json:"sourceId"`
	SourceName  string                 `json:"sourceName"`
	Labels      map[string]string      `json:"labels"`
	Annotations map[string]string      `json:"annotations"`
	Value       float64                `json:"value"`
	Threshold   float64                `json:"threshold"`
	Metric      string                 `json:"metric"`
	GroupID     string                 `json:"groupId,omitempty"`
	ReceivedAt  time.Time              `json:"receivedAt"`
}

// AlertSource defines the contract any alert ingestion adapter must implement.
// Implementations (Prometheus, Grafana, Webhook, custom) register themselves
// with the engine and provide a handler that returns an AlertEvent from raw
// payload bytes.
type AlertSource interface {
	// Name returns a unique name for the source (e.g. "prometheus", "grafana").
	Name() string

	// Supports returns true if this source can handle the given content type.
	Supports(contentType string) bool

	// Parse parses raw payload bytes into an AlertEvent.  It must return an
	// error if the payload is not valid for this source.
	Parse(payload []byte) (*AlertEvent, error)
}

// EnrichmentSource provides extra context (e.g. CMDB data, recent events) that
// the enrich stage can pull to annotate alerts before routing.
type EnrichmentSource interface {
	Name() string
	Enrich(ctx *AlertContext) error
}

// NotificationChannel defines the contract a notifier plugin must implement.
// Supported channel types: email, slack, webhook, pagerduty, custom.
type NotificationChannel interface {
	Name() string
	ChannelType() string
	Send(ctx *AlertContext) error
}

// CorrelationEngine correlates a batch of alerts and returns groups.
// The related alerts are passed as []any so callers can supply either
// *models.AlertEvent or *event.AlertEvent without a type conversion.
type CorrelationEngine interface {
	Correlate(ctx *AlertContext, related []any) (groupID string, isDuplicate bool, err error)
}

// DeadLetterQueue stores alerts that could not be processed after all retries.
type DeadLetterQueue interface {
	Enqueue(ctx *AlertContext, reason string) error
	Dequeue() (*AlertContext, error)
	Size() int
}
