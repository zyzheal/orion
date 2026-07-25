// Package models defines data models for the Alert Adapter SPI service.
//
// The Alert Adapter SPI provides a pluggable adapter system (inspired by
// NeatLogic's IAdapter SPI) for connecting external alerting and notification
// systems to the Orion Platform. Adapters fall into three categories:
//
//   - source: ingest alerts from external monitoring (Prometheus, Zabbix, Grafana, Kafka)
//   - notification: dispatch notifications to channels (Email, SMS, WeChat, Slack, PagerDuty)
//   - export: stream alert data to external destinations (Webhook, Kafka)
//
// The SPI contract is AlertAdapterHandler — implementers are registered with
// AlertAdapterFactory and dispatch alerts via Send/Receive operations.
//
// Data flow:
//   1. Adapter is registered via POST /api/alert-adapters (config stored as JSON)
//   2. Factory creates a typed handler and calls Initialize(config)
//   3. Send: Orion pushes an alert → handler.Send() → external system
//   4. Receive: handler.Receive() pulls → recorded as AlertEvent
//   5. AlertEvent records every receive/send lifecycle with status tracking
//
// Tables: alert_adapters (adapter registry), alert_events (event audit trail)
package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ---------------------------------------------------------------------------
// JSON helpers (self-contained, copied from runner models)
// ---------------------------------------------------------------------------

// JSONB is a PostgreSQL JSONB-compatible map type.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Valid adapter types.
var ValidAdapterTypes = map[string]bool{
	"prometheus": true,
	"zabbix":     true,
	"grafana":    true,
	"kafka":      true,
	"webhook":    true,
	"email":      true,
	"sms":        true,
	"wechat":     true,
	"slack":      true,
	"pagerduty":  true,
}

// Valid adapter categories.
var ValidAdapterCategories = map[string]bool{
	"source":       true,
	"notification": true,
	"export":       true,
}

// Valid adapter statuses.
var ValidAdapterStatuses = map[string]bool{
	"enabled":  true,
	"disabled": true,
	"error":    true,
}

// Valid alert event severities.
var ValidSeverities = map[string]bool{
	"info":      true,
	"warning":   true,
	"critical":  true,
	"emergency": true,
}

// Valid alert event statuses.
var ValidEventStatuses = map[string]bool{
	"received":  true,
	"processed": true,
	"failed":    true,
}

// ---------------------------------------------------------------------------
// AlertAdapter — a registered pluggable adapter instance
// ---------------------------------------------------------------------------

// AlertAdapter represents a registered alert adapter with a typed handler.
type AlertAdapter struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Type        string    `db:"type" json:"type"`       // prometheus, zabbix, grafana, kafka, webhook, email, sms, wechat, slack, pagerduty
	Category    string    `db:"category" json:"category"` // source, notification, export
	Config      string    `db:"config" json:"config"`    // JSON
	Status      string    `db:"status" json:"status"`    // enabled, disabled, error
	Enabled     bool      `db:"enabled" json:"enabled"`
	Error       string    `db:"error" json:"error"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// ---------------------------------------------------------------------------
// AlertEvent — an audit trail entry for adapter interactions
// ---------------------------------------------------------------------------

// AlertEvent records a single alert received from or sent to an adapter.
type AlertEvent struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	AdapterID   string     `db:"adapter_id" json:"adapter_id"`
	Source      string     `db:"source" json:"source"`
	Title       string     `db:"title" json:"title"`
	Message     string     `db:"message" json:"message"`
	Severity    string     `db:"severity" json:"severity"` // info, warning, critical, emergency
	Labels      string     `db:"labels" json:"labels"`      // JSON
	Payload     string     `db:"payload" json:"payload"`    // JSON
	Status      string     `db:"status" json:"status"`      // received, processed, failed
	ProcessedAt *time.Time `db:"processed_at" json:"processed_at,omitempty"`
	Error       string     `db:"error" json:"error"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
}

// ---------------------------------------------------------------------------
// Request / response payloads
// ---------------------------------------------------------------------------

// CreateAdapterRequest is the request payload for registering an adapter.
type CreateAdapterRequest struct {
	Name     string `json:"name" binding:"required"`
	Type     string `json:"type" binding:"required"`
	Category string `json:"category" binding:"required"`
	Config   JSONB  `json:"config" binding:"required"`
}

// UpdateAdapterRequest is the request payload for updating an adapter.
type UpdateAdapterRequest struct {
	Name     *string `json:"name"`
	Type     *string `json:"type"`
	Category *string `json:"category"`
	Config   *JSONB  `json:"config"`
	Enabled  *bool   `json:"enabled"`
	Status   *string `json:"status"`
	Error    *string `json:"error"`
}

// SendAlertRequest is the request payload for sending an alert through an adapter.
type SendAlertRequest struct {
	Title    string `json:"title" binding:"required"`
	Message  string `json:"message"`
	Severity string `json:"severity"`
	Source   string `json:"source"`
	Labels   JSONB  `json:"labels"`
	Payload  JSONB  `json:"payload"`
}

// PaginatedRequest holds pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
