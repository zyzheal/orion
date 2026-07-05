package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// NotificationStatus represents the lifecycle state of a notification.
type NotificationStatus string

const (
	StatusPending NotificationStatus = "pending"
	StatusSent    NotificationStatus = "sent"
	StatusFailed  NotificationStatus = "failed"
	StatusRead    NotificationStatus = "read"
)

// ChannelType identifies a delivery channel.
type ChannelType string

const (
	ChannelEmail   ChannelType = "email"
	ChannelSlack   ChannelType = "slack"
	ChannelWebhook ChannelType = "webhook"
	ChannelInApp   ChannelType = "in-app"
)

// JSONB is a convenience type for PostgreSQL JSONB columns.
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

// Notification is the core notification record.
type Notification struct {
	ID        string             `db:"id" json:"id"`
	TenantID  string             `db:"tenant_id" json:"tenant_id"`
	UserID    string             `db:"user_id" json:"user_id"`
	Type      string             `db:"type" json:"type"`
	Title     string             `db:"title" json:"title"`
	Channel   ChannelType        `db:"channel" json:"channel"`
	Recipient string             `db:"recipient" json:"recipient"`
	Subject   string             `db:"subject" json:"subject"`
	Body      string             `db:"body" json:"body"`
	Status    NotificationStatus `db:"status" json:"status"`
	Metadata  JSONB              `db:"metadata" json:"metadata"`
	SentAt    *time.Time         `db:"sent_at" json:"sent_at"`
	ReadAt    *time.Time         `db:"read_at" json:"read_at"`
	CreatedAt time.Time          `db:"created_at" json:"created_at"`
}

// NotificationTemplate stores reusable message templates.
type NotificationTemplate struct {
	ID        string      `db:"id" json:"id"`
	TenantID  string      `db:"tenant_id" json:"tenant_id"`
	Name      string      `db:"name" json:"name"`
	Channel   ChannelType `db:"channel" json:"channel"`
	Subject   string      `db:"subject" json:"subject"`
	Body      string      `db:"body" json:"body"`
	CreatedAt time.Time   `db:"created_at" json:"created_at"`
}

// NotificationChannel stores channel configuration (email server, slack webhook, etc.).
type NotificationChannel struct {
	ID        string      `db:"id" json:"id"`
	TenantID  string      `db:"tenant_id" json:"tenant_id"`
	Name      string      `db:"name" json:"name"`
	Type      ChannelType `db:"type" json:"type"`
	Config    JSONB       `db:"config" json:"config"`
	Enabled   bool        `db:"enabled" json:"enabled"`
	CreatedAt time.Time   `db:"created_at" json:"created_at"`
}

// NotificationSettings stores per-user notification preferences.
type NotificationSettings struct {
	ID                string     `db:"id" json:"id"`
	UserID            string     `db:"user_id" json:"user_id"`
	TenantID          string     `db:"tenant_id" json:"tenant_id"`
	EmailEnabled      bool       `db:"email_enabled" json:"email_enabled"`
	SlackEnabled      bool       `db:"slack_enabled" json:"slack_enabled"`
	WebhookEnabled    bool       `db:"webhook_enabled" json:"webhook_enabled"`
	WebhookURL        *string    `db:"webhook_url" json:"webhook_url"`
	PipelineCompleted bool       `db:"pipeline_completed" json:"pipeline_completed"`
	PipelineFailed    bool       `db:"pipeline_failed" json:"pipeline_failed"`
	TicketAssigned    bool       `db:"ticket_assigned" json:"ticket_assigned"`
	TicketEscalated   bool       `db:"ticket_escalated" json:"ticket_escalated"`
	SLAWarning        bool       `db:"sla_warning" json:"sla_warning"`
	SLABreached       bool       `db:"sla_breached" json:"sla_breached"`
	AlertTriggered    bool       `db:"alert_triggered" json:"alert_triggered"`
	DeploymentSuccess bool       `db:"deployment_success" json:"deployment_success"`
	DeploymentFailed  bool       `db:"deployment_failed" json:"deployment_failed"`
	SystemAlert       bool       `db:"system_alert" json:"system_alert"`
	CommentMention    bool       `db:"comment_mention" json:"comment_mention"`
	TransferRequest   bool       `db:"transfer_request" json:"transfer_request"`
	DigestEnabled     bool       `db:"digest_enabled" json:"digest_enabled"`
	DigestFrequency   string     `db:"digest_frequency" json:"digest_frequency"`
	QuietHoursStart   *string    `db:"quiet_hours_start" json:"quiet_hours_start"`
	QuietHoursEnd     *string    `db:"quiet_hours_end" json:"quiet_hours_end"`
	CreatedAt         time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time  `db:"updated_at" json:"updated_at"`
}

// NotificationSubscription tracks channel subscriptions per user.
type NotificationSubscription struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	UserID    string    `db:"user_id" json:"user_id"`
	Channel   string    `db:"channel" json:"channel"`
	Enabled   bool      `db:"enabled" json:"enabled"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// ---- Request/Response DTOs ----

// CreateNotificationRequest is the payload for sending a notification.
type CreateNotificationRequest struct {
	TenantID  string                 `json:"tenant_id"`
	UserID    string                 `json:"user_id" binding:"required"`
	Type      string                 `json:"type"`
	Title     string                 `json:"title"`
	Channel   ChannelType            `json:"channel" binding:"required"`
	Recipient string                 `json:"recipient" binding:"required"`
	Subject   string                 `json:"subject"`
	Body      string                 `json:"body" binding:"required"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// BroadcastRequest is the payload for broadcasting to multiple users.
type BroadcastRequest struct {
	UserIDs []string `json:"user_ids" binding:"required,min=1"`
	Type    string   `json:"type"`
	Title   string   `json:"title" binding:"required"`
	Message string   `json:"message" binding:"required"`
}

// PaginatedRequest holds common pagination parameters.
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

// ListNotificationsQuery holds query filters for listing notifications.
type ListNotificationsQuery struct {
	UserID string `form:"user_id"`
	Status string `form:"status"`
	PaginatedRequest
}

// UpdateSettingsRequest is the payload for updating notification preferences.
type UpdateSettingsRequest struct {
	EmailEnabled      *bool   `json:"email_enabled"`
	SlackEnabled      *bool   `json:"slack_enabled"`
	WebhookEnabled    *bool   `json:"webhook_enabled"`
	WebhookURL        *string `json:"webhook_url"`
	PipelineCompleted *bool   `json:"pipeline_completed"`
	PipelineFailed    *bool   `json:"pipeline_failed"`
	TicketAssigned    *bool   `json:"ticket_assigned"`
	TicketEscalated   *bool   `json:"ticket_escalated"`
	SLAWarning        *bool   `json:"sla_warning"`
	SLABreached       *bool   `json:"sla_breached"`
	AlertTriggered    *bool   `json:"alert_triggered"`
	DeploymentSuccess *bool   `json:"deployment_success"`
	DeploymentFailed  *bool   `json:"deployment_failed"`
	SystemAlert       *bool   `json:"system_alert"`
	CommentMention    *bool   `json:"comment_mention"`
	TransferRequest   *bool   `json:"transfer_request"`
	DigestEnabled     *bool   `json:"digest_enabled"`
	DigestFrequency   *string `json:"digest_frequency"`
	QuietHoursStart   *string `json:"quiet_hours_start"`
	QuietHoursEnd     *string `json:"quiet_hours_end"`
}

// SubscribeRequest is the payload for channel subscription.
type SubscribeRequest struct {
	Channel string `json:"channel" binding:"required"`
	Enabled bool   `json:"enabled"`
}
