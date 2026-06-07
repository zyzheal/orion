package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a map type that implements sql.Scanner and driver.Valuer for PostgreSQL JSONB columns.
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
// NotifyTemplate — notification delivery template
// ---------------------------------------------------------------------------

type NotifyTemplate struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Channel   string    `db:"channel" json:"channel"`
	Recipient string    `db:"recipient" json:"recipient"`
	Subject   string    `db:"subject" json:"subject,omitempty"`
	Body      string    `db:"body" json:"body"`
	Status    string    `db:"status" json:"status"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type CreateNotifyTemplateRequest struct {
	Name      string `json:"name" binding:"required"`
	Channel   string `json:"channel" binding:"required"`
	Recipient string `json:"recipient" binding:"required"`
	Subject   string `json:"subject"`
	Body      string `json:"body" binding:"required"`
}

// ---------------------------------------------------------------------------
// Notification — in-app notification record
// Ported from orion-platform-service NotificationRepository.ts
// ---------------------------------------------------------------------------

type Notification struct {
	ID        string     `db:"id" json:"id"`
	TenantID  string     `db:"tenant_id" json:"tenant_id"`
	UserID    string     `db:"user_id" json:"user_id"`
	Type      string     `db:"type" json:"type"`
	Title     string     `db:"title" json:"title"`
	Message   string     `db:"message" json:"message"`
	Channel   string     `db:"channel" json:"channel"`
	Status    string     `db:"status" json:"status"`
	SentAt    *time.Time `db:"sent_at" json:"sent_at"`
	ReadAt    *time.Time `db:"read_at" json:"read_at"`
	CreatedAt time.Time  `db:"created_at" json:"created_at"`
}

type CreateNotificationRequest struct {
	UserID  string `json:"user_id" binding:"required"`
	Type    string `json:"type" binding:"required"`
	Title   string `json:"title" binding:"required"`
	Message string `json:"message" binding:"required"`
	Channel string `json:"channel"`
}

type BroadcastNotificationRequest struct {
	UserIDs []string `json:"user_ids" binding:"required,min=1"`
	Type    string   `json:"type" binding:"required"`
	Title   string   `json:"title" binding:"required"`
	Message string   `json:"message" binding:"required"`
}

type PaginatedResponse struct {
	Data  interface{} `json:"data"`
	Total int         `json:"total"`
}

// ---------------------------------------------------------------------------
// NotificationSettings — per-user notification preferences
// Ported from orion-platform-service NotificationSettingsRepository.ts
// ---------------------------------------------------------------------------

type NotificationSettings struct {
	ID               string     `db:"id" json:"id"`
	UserID           string     `db:"user_id" json:"user_id"`
	TenantID         string     `db:"tenant_id" json:"tenant_id"`
	EmailEnabled     bool       `db:"email_enabled" json:"email_enabled"`
	SmsEnabled       bool       `db:"sms_enabled" json:"sms_enabled"`
	WebhookEnabled   bool       `db:"webhook_enabled" json:"webhook_enabled"`
	WebhookURL       *string    `db:"webhook_url" json:"webhook_url"`
	PipelineCompleted bool      `db:"pipeline_completed" json:"pipeline_completed"`
	PipelineFailed   bool       `db:"pipeline_failed" json:"pipeline_failed"`
	TicketAssigned   bool       `db:"ticket_assigned" json:"ticket_assigned"`
	TicketEscalated  bool       `db:"ticket_escalated" json:"ticket_escalated"`
	SlaWarning       bool       `db:"sla_warning" json:"sla_warning"`
	SlaBreached      bool       `db:"sla_breached" json:"sla_breached"`
	AlertTriggered   bool       `db:"alert_triggered" json:"alert_triggered"`
	DeploymentSucceed bool      `db:"deployment_succeed" json:"deployment_succeed"`
	DeploymentFailed  bool      `db:"deployment_failed" json:"deployment_failed"`
	SystemAlert      bool       `db:"system_alert" json:"system_alert"`
	CommentMention   bool       `db:"comment_mention" json:"comment_mention"`
	TransferRequest  bool       `db:"transfer_request" json:"transfer_request"`
	DigestEnabled    bool       `db:"digest_enabled" json:"digest_enabled"`
	DigestFrequency  string     `db:"digest_frequency" json:"digest_frequency"`
	QuietHoursStart  *string    `db:"quiet_hours_start" json:"quiet_hours_start"`
	QuietHoursEnd    *string    `db:"quiet_hours_end" json:"quiet_hours_end"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time  `db:"updated_at" json:"updated_at"`
}

type UpdateNotificationSettingsRequest struct {
	EmailEnabled      *bool   `json:"email_enabled"`
	SmsEnabled        *bool   `json:"sms_enabled"`
	WebhookEnabled    *bool   `json:"webhook_enabled"`
	WebhookURL        *string `json:"webhook_url"`
	PipelineCompleted *bool   `json:"pipeline_completed"`
	PipelineFailed    *bool   `json:"pipeline_failed"`
	TicketAssigned    *bool   `json:"ticket_assigned"`
	TicketEscalated   *bool   `json:"ticket_escalated"`
	SlaWarning        *bool   `json:"sla_warning"`
	SlaBreached       *bool   `json:"sla_breached"`
	AlertTriggered    *bool   `json:"alert_triggered"`
	DeploymentSucceed *bool   `json:"deployment_succeed"`
	DeploymentFailed  *bool   `json:"deployment_failed"`
	SystemAlert       *bool   `json:"system_alert"`
	CommentMention    *bool   `json:"comment_mention"`
	TransferRequest   *bool   `json:"transfer_request"`
	DigestEnabled     *bool   `json:"digest_enabled"`
	DigestFrequency   *string `json:"digest_frequency"`
	QuietHoursStart   *string `json:"quiet_hours_start"`
	QuietHoursEnd     *string `json:"quiet_hours_end"`
}

// ---------------------------------------------------------------------------
// Shared pagination helper
// ---------------------------------------------------------------------------

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
