// Package models defines data models for the Alert Adapter V2 notification service.
//
// Alert Adapter V2 is an extensible notification delivery system that supports 15+
// notification channels through a pluggable INotificationHandler SPI. It manages
// notification adapters (one per channel), message templates with variable
// substitution, and a delivery event audit trail.
//
// Supported channels:
//   email, sms, wechat, dingtalk, feishu, slack, telegram, pagerduty,
//   opsgenie, webhook, phone, push, in_app, kafka, rabbitmq
//
// Data flow:
//   1. Adapter is registered with channel + config JSON
//   2. Templates are created with channel-scoped variable substitution
//   3. SendNotification renders a template and dispatches via the handler
//   4. AlertNotificationEvent records the full delivery lifecycle
//
// Tables:
//   alert_notification_adapters  — registered notification adapters (tenant-scoped)
//   alert_notification_events    — delivery event audit trail
//   alert_notification_templates — notification templates with variables
package models

import (
	"time"
)

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Valid notification channels.
var ValidChannels = map[string]bool{
	"email":     true,
	"sms":       true,
	"wechat":    true,
	"dingtalk":  true,
	"feishu":    true,
	"slack":     true,
	"telegram":  true,
	"pagerduty": true,
	"opsgenie":  true,
	"webhook":   true,
	"phone":     true,
	"push":      true,
	"in_app":    true,
	"kafka":     true,
	"rabbitmq":  true,
}

// Valid adapter statuses.
var ValidAdapterStatuses = map[string]bool{
	"enabled":  true,
	"disabled": true,
	"error":    true,
}

// Valid event delivery statuses.
var ValidEventStatuses = map[string]bool{
	"queued":    true,
	"sent":      true,
	"failed":    true,
	"delivered": true,
}

// ---------------------------------------------------------------------------
// AlertNotificationAdapter — a registered notification adapter
// ---------------------------------------------------------------------------

// AlertNotificationAdapter represents a registered notification adapter with a
// specific channel and runtime configuration.
type AlertNotificationAdapter struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Channel   string    `db:"channel" json:"channel"`
	Config    string    `db:"config" json:"config"` // JSON
	Status    string    `db:"status" json:"status"` // enabled, disabled, error
	Error     string    `db:"error" json:"error"`
	Enabled   bool      `db:"enabled" json:"enabled"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// ---------------------------------------------------------------------------
// AlertNotificationEvent — delivery event audit trail
// ---------------------------------------------------------------------------

// AlertNotificationEvent records a single notification delivery attempt.
type AlertNotificationEvent struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	AdapterID   string     `db:"adapter_id" json:"adapter_id"`
	AlertID     string     `db:"alert_id" json:"alert_id"`
	Payload     string     `db:"payload" json:"payload"` // JSON
	Status      string     `db:"status" json:"status"`   // queued, sent, failed, delivered
	Error       string     `db:"error" json:"error"`
	SentAt      *time.Time `db:"sent_at" json:"sent_at,omitempty"`
	DeliveredAt *time.Time `db:"delivered_at" json:"delivered_at,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
}

// ---------------------------------------------------------------------------
// AlertNotificationTemplate — channel-scoped message template
// ---------------------------------------------------------------------------

// AlertNotificationTemplate is a reusable notification message template with
// variable substitution support.
type AlertNotificationTemplate struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Channel   string    `db:"channel" json:"channel"`
	Template  string    `db:"template" json:"template"`  // Template with {{variable}} placeholders
	Variables string    `db:"variables" json:"variables"` // JSON: available variable list
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// ---------------------------------------------------------------------------
// Request / response payloads
// ---------------------------------------------------------------------------

// CreateAdapterRequest is the request payload for registering a notification adapter.
type CreateAdapterRequest struct {
	Name    string `json:"name" binding:"required"`
	Channel string `json:"channel" binding:"required"`
	Config  string `json:"config"` // JSON string
}

// UpdateAdapterRequest is the request payload for updating an adapter.
type UpdateAdapterRequest struct {
	Name    *string `json:"name"`
	Channel *string `json:"channel"`
	Config  *string `json:"config"`
	Enabled *bool   `json:"enabled"`
	Status  *string `json:"status"`
}

// SendNotificationRequest is the request payload for sending a notification.
type SendNotificationRequest struct {
	TemplateID string `json:"templateId"`
	AdapterID  string `json:"adapterId"`
	AlertID    string `json:"alertId"`
	Variables  string `json:"variables"` // JSON: variable key-value pairs
}

// CreateTemplateRequest is the request payload for creating a notification template.
type CreateTemplateRequest struct {
	Name      string `json:"name" binding:"required"`
	Channel   string `json:"channel" binding:"required"`
	Template  string `json:"template" binding:"required"`
	Variables string `json:"variables"` // JSON
}

// ValidateConfigRequest is the request payload for validating adapter config.
type ValidateConfigRequest struct {
	Config string `json:"config"` // JSON string
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
