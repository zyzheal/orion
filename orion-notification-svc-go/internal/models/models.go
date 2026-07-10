package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"context"
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
	ChannelDingtalk ChannelType = "dingtalk"
	ChannelWechat   ChannelType = "wechat"
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
	ID              string      `db:"id" json:"id"`
	TenantID        string      `db:"tenant_id" json:"tenant_id"`
	Name            string      `db:"name" json:"name"`
	EventType       string      `db:"event_type" json:"event_type"`
	Channel         ChannelType `db:"channel" json:"channel"`
	ChannelIDs      []string    `db:"channel_ids" json:"channel_ids"`
	Subject         string      `db:"subject" json:"subject"`
	SubjectTemplate string      `db:"subject_template" json:"subject_template"`
	BodyTemplate    string      `db:"body_template" json:"body_template"`
	Body            string      `db:"body" json:"body"`
	CreatedAt       time.Time   `db:"created_at" json:"created_at"`
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

// ============================================================
// Template Input DTOs
// ============================================================

// CreateNotificationTemplateInput is the payload for creating a notification template.
type CreateNotificationTemplateInput struct {
	Name            string   `json:"name" binding:"required"`
	EventType       string   `json:"event_type" binding:"required"`
	Channel         ChannelType `json:"channel"`
	ChannelIDs      []string `json:"channel_ids"`
	Subject         string   `json:"subject"`
	SubjectTemplate string   `json:"subject_template"`
	BodyTemplate    string   `json:"body_template" binding:"required"`
}

// UpdateNotificationTemplateInput is the payload for updating a notification template.
type UpdateNotificationTemplateInput struct {
	Name            *string   `json:"name"`
	EventType       *string   `json:"event_type"`
	Channel         *ChannelType `json:"channel"`
	ChannelIDs      *[]string `json:"channel_ids"`
	Subject         *string   `json:"subject"`
	SubjectTemplate *string   `json:"subject_template"`
	BodyTemplate    *string   `json:"body_template"`
}

// ============================================================
// Policy / Workflow Models
// ============================================================

// PolicyConditionOperator represents a comparison operator for policy conditions.
type PolicyConditionOperator string

const (
	PolicyOpEQ        PolicyConditionOperator = "eq"
	PolicyOpNEQ       PolicyConditionOperator = "neq"
	PolicyOpContains  PolicyConditionOperator = "contains"
	PolicyOpGT        PolicyConditionOperator = "gt"
	PolicyOpLT        PolicyConditionOperator = "lt"
	PolicyOpGTE       PolicyConditionOperator = "gte"
	PolicyOpLTE       PolicyConditionOperator = "lte"
	PolicyOpIn        PolicyConditionOperator = "in"
	PolicyOpRegex     PolicyConditionOperator = "regex"
)

// PolicyCondition represents a single condition in a notification policy.
type PolicyCondition struct {
	Field    string                 `db:"-" json:"field"`
	Operator PolicyConditionOperator `db:"-" json:"operator"`
	Value    interface{}            `db:"-" json:"value"`
}

// WorkflowStepType represents the type of a workflow step.
type WorkflowStepType string

const (
	StepTypeNotify   WorkflowStepType = "notify"
	StepTypeWait     WorkflowStepType = "wait"
	StepTypeEscalate WorkflowStepType = "escalate"
	StepTypeWebhook  WorkflowStepType = "webhook"
)

// WorkflowStep represents a single step in a notification workflow.
type WorkflowStep struct {
	ID    string                 `db:"-" json:"id"`
	Name  string                 `db:"-" json:"name"`
	Type  WorkflowStepType       `db:"-" json:"type"`
	Config map[string]interface{} `db:"-" json:"config"`
	Order int                    `db:"-" json:"order"`
}

// NotificationPolicyEntity represents a notification policy record.
type NotificationPolicyEntity struct {
	ID              string            `db:"id" json:"id"`
	TenantID        string            `db:"tenant_id" json:"tenantId"`
	Name            string            `db:"name" json:"name"`
	Description     *string           `db:"description" json:"description"`
	Conditions      []PolicyCondition `db:"-" json:"conditions"`
	Channels        []string          `db:"-" json:"channels"`
	Recipients      []string          `db:"-" json:"recipients"`
	ThrottleMinutes int               `db:"throttle_minutes" json:"throttleMinutes"`
	Enabled         bool              `db:"enabled" json:"enabled"`
	CreatedBy       *string           `db:"created_by" json:"createdBy"`
	CreatedAt       time.Time         `db:"created_at" json:"createdAt"`
	UpdatedAt       time.Time         `db:"updated_at" json:"updatedAt"`
}

// NotificationWorkflowEntity represents a notification workflow record.
type NotificationWorkflowEntity struct {
	ID          string            `db:"id" json:"id"`
	TenantID    string            `db:"tenant_id" json:"tenantId"`
	Name        string            `db:"name" json:"name"`
	Description *string           `db:"description" json:"description"`
	PolicyID    string            `db:"policy_id" json:"policyId"`
	Steps       []WorkflowStep    `db:"-" json:"steps"`
	Enabled     bool              `db:"enabled" json:"enabled"`
	CreatedBy   *string           `db:"created_by" json:"createdBy"`
	CreatedAt   time.Time         `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time         `db:"updated_at" json:"updatedAt"`
}

// ============================================================
// DTOs
// ============================================================

// CreatePolicyRequest is the payload for creating a notification policy.
type CreatePolicyRequest struct {
	Name           string             `json:"name" binding:"required"`
	Description    *string            `json:"description"`
	Conditions     []PolicyCondition  `json:"conditions"`
	Channels       []string           `json:"channels"`
	Recipients     []string           `json:"recipients"`
	ThrottleMinutes int               `json:"throttleMinutes"`
	Enabled        *bool              `json:"enabled"`
}

// UpdatePolicyRequest is the payload for updating a notification policy.
type UpdatePolicyRequest struct {
	Name           *string            `json:"name"`
	Description    *string            `json:"description"`
	Conditions     []PolicyCondition  `json:"conditions"`
	Channels       []string           `json:"channels"`
	Recipients     []string           `json:"recipients"`
	ThrottleMinutes *int              `json:"throttleMinutes"`
	Enabled        *bool              `json:"enabled"`
}

// CreateWorkflowRequest is the payload for creating a notification workflow.
type CreateWorkflowRequest struct {
	Name        string         `json:"name" binding:"required"`
	Description *string        `json:"description"`
	PolicyID    string         `json:"policyId" binding:"required"`
	Steps       []WorkflowStep `json:"steps" binding:"required,min=1"`
	Enabled     *bool          `json:"enabled"`
}

// UpdateWorkflowRequest is the payload for updating a notification workflow.
type UpdateWorkflowRequest struct {
	Name        *string         `json:"name"`
	Description *string        `json:"description"`
	Steps       []WorkflowStep `json:"steps"`
	Enabled     *bool          `json:"enabled"`
}

// ============================================================
// Delivery Models
// ============================================================

// DeliveryStatus represents the status of a notification delivery.
type DeliveryStatus string

const (
	DeliveryStatusPending   DeliveryStatus = "pending"
	DeliveryStatusSent      DeliveryStatus = "sent"
	DeliveryStatusFailed    DeliveryStatus = "failed"
	DeliveryStatusRetrying  DeliveryStatus = "retrying"
	DeliveryStatusExhausted DeliveryStatus = "exhausted"
)

// DeliveryChannel identifies a delivery channel.
type DeliveryChannel string

const (
	DeliveryChannelEmail   DeliveryChannel = "email"
	DeliveryChannelSMS     DeliveryChannel = "sms"
	DeliveryChannelWebhook DeliveryChannel = "webhook"
	DeliveryChannelPush    DeliveryChannel = "push"
	DeliveryChannelInApp   DeliveryChannel = "in-app"
)

// NotificationDelivery tracks individual channel delivery attempts.
type NotificationDelivery struct {
	ID              string         `db:"id" json:"id"`
	TenantID        string         `db:"tenant_id" json:"tenantId"`
	NotificationID  string         `db:"notification_id" json:"notificationId"`
	Channel         DeliveryChannel `db:"channel" json:"channel"`
	Recipient       string         `db:"recipient" json:"recipient"`
	Subject         *string        `db:"subject" json:"subject"`
	Body            *string        `db:"body" json:"body"`
	Status          DeliveryStatus `db:"status" json:"status"`
	AttemptNumber   int            `db:"attempt_number" json:"attemptNumber"`
	MaxAttempts     int            `db:"max_attempts" json:"maxAttempts"`
	ErrorMessage    *string        `db:"error_message" json:"errorMessage"`
	ResponseBody    *string        `db:"response_body" json:"responseBody"`
	ResponseStatus  *int           `db:"response_status" json:"responseStatus"`
	SentAt          *time.Time     `db:"sent_at" json:"sentAt"`
	NextRetryAt     *time.Time     `db:"next_retry_at" json:"nextRetryAt"`
	FallbackChannel *string        `db:"fallback_channel" json:"fallbackChannel"`
	Metadata        JSONB          `db:"metadata" json:"metadata"`
	CreatedAt       time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt       time.Time      `db:"updated_at" json:"updatedAt"`
}

// CreateDeliveryInput is the payload for creating a delivery record.
type CreateDeliveryInput struct {
	NotificationID  string                 `json:"notificationId"`
	Channel         DeliveryChannel        `json:"channel"`
	Recipient       string                 `json:"recipient"`
	Subject         *string                `json:"subject"`
	Body            *string                `json:"body"`
	MaxAttempts     int                    `json:"maxAttempts"`
	FallbackChannel *string                `json:"fallbackChannel"`
	Metadata        map[string]interface{} `json:"metadata"`
}

// UpdateDeliveryInput is the payload for updating delivery status.
type UpdateDeliveryInput struct {
	Status         *DeliveryStatus `json:"status"`
	AttemptNumber  *int            `json:"attemptNumber"`
	ErrorMessage   *string         `json:"errorMessage"`
	ResponseBody   *string         `json:"responseBody"`
	ResponseStatus *int            `json:"responseStatus"`
	SentAt         *time.Time      `json:"sentAt"`
	NextRetryAt    *time.Time      `json:"nextRetryAt"`
	Metadata       JSONB           `json:"metadata"`
}

// ChannelExecutor executes delivery for a specific channel.
type ChannelExecutor interface {
	Channel() DeliveryChannel
	Execute(ctx context.Context, delivery *NotificationDelivery) (success bool, responseStatus int, responseBody string, err error)
}

// ============================================================
// Scheduled Notification Models
// ============================================================

// ScheduledNotificationStatus represents the status of a scheduled notification.
type ScheduledNotificationStatus string

const (
	ScheduledStatusPending   ScheduledNotificationStatus = "pending"
	ScheduledStatusSent      ScheduledNotificationStatus = "sent"
	ScheduledStatusFailed    ScheduledNotificationStatus = "failed"
	ScheduledStatusCancelled ScheduledNotificationStatus = "cancelled"
	ScheduledStatusPaused    ScheduledNotificationStatus = "paused"
)

// ScheduledNotification represents a delayed or periodic notification.
type ScheduledNotification struct {
	ID             string                     `db:"id" json:"id"`
	TenantID       string                     `db:"tenant_id" json:"tenantId"`
	UserID         *string                    `db:"user_id" json:"userId"`
	TemplateID     *string                    `db:"template_id" json:"templateId"`
	Type           string                     `db:"type" json:"type"`
	Title          string                     `db:"title" json:"title"`
	Message        string                     `db:"message" json:"message"`
	Channel        ChannelType                `db:"channel" json:"channel"`
	ScheduledAt    time.Time                  `db:"scheduled_at" json:"scheduledAt"`
	Status         ScheduledNotificationStatus `db:"status" json:"status"`
	SentAt         *time.Time                 `db:"sent_at" json:"sentAt"`
	ErrorMessage   *string                    `db:"error_message" json:"errorMessage"`
	CreatedAt      time.Time                  `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time                  `db:"updated_at" json:"updatedAt"`
}

// CreateScheduledNotificationInput is the payload for creating a scheduled notification.
type CreateScheduledNotificationInput struct {
	UserID      string                 `json:"userId" binding:"required"`
	Type        string                 `json:"type" binding:"required"`
	Title       string                 `json:"title" binding:"required"`
	Message     string                 `json:"message" binding:"required"`
	Channel     ChannelType            `json:"channel"`
	ScheduledAt time.Time              `json:"scheduledAt" binding:"required"`
	TemplateID  *string                `json:"templateId"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// UpdateScheduledNotificationInput is the payload for updating a scheduled notification.
type UpdateScheduledNotificationInput struct {
	Title       *string    `json:"title"`
	Message     *string    `json:"message"`
	ScheduledAt *time.Time `json:"scheduledAt"`
	Status      *string    `json:"status"`
}

// ============================================================
// Cron Validation Models
// ============================================================

// ParsedCronSchedule represents the result of validating a cron expression.
type ParsedCronSchedule struct {
	Expression   string     `json:"expression"`
	Description  string     `json:"description"`
	Valid        bool       `json:"valid"`
	Error        string     `json:"error"`
	NextFireTime *time.Time `json:"nextFireTime"`
	Timezone     string     `json:"timezone"`
}

// ============================================================
// Do Not Disturb Models
// ============================================================

// DoNotDisturb represents a user's do-not-disturb settings.
type DoNotDisturb struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenantId"`
	UserID    string    `db:"user_id" json:"userId"`
	StartTime time.Time `db:"start_time" json:"startTime"`
	EndTime   time.Time `db:"end_time" json:"endTime"`
	Reason    *string   `db:"reason" json:"reason"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// CreateDoNotDisturbInput is the payload for creating/updating DND settings.
type CreateDoNotDisturbInput struct {
	UserID    string    `json:"userId" binding:"required"`
	StartTime time.Time `json:"startTime" binding:"required"`
	EndTime   time.Time `json:"endTime" binding:"required"`
	Reason    *string   `json:"reason"`
}

// ============================================================
// JSONB Helpers
// ============================================================

// ============================================================
// Stats Models
// ============================================================

// NotificationStats holds aggregate counts for notifications.
type NotificationStats struct {
	Total       int `db:"-" json:"total"`
	Pending     int `db:"-" json:"pending"`
	Sent        int `db:"-" json:"sent"`
	Failed      int `db:"-" json:"failed"`
	Read        int `db:"-" json:"read"`
	UnreadCount int `db:"-" json:"unreadCount"`
}

// ============================================================
// Scheduled Notification Extensions
// ============================================================

// ToggleScheduledNotificationInput is the payload for toggling a scheduled notification.
type ToggleScheduledNotificationInput struct {
	Enabled *bool `json:"enabled" binding:"required"`
}

// ParseJSONB unmarshals a JSONB value into a typed slice.
func ParseJSONB(value interface{}, dest interface{}) error {
	switch v := value.(type) {
	case []byte:
		return json.Unmarshal(v, dest)
	case string:
		if v == "" {
			return nil
		}
		return json.Unmarshal([]byte(v), dest)
	case JSONB:
		b, err := json.Marshal(v)
		if err != nil {
			return err
		}
		return json.Unmarshal(b, dest)
	case nil:
		return nil
	default:
		return fmt.Errorf("cannot unmarshal %T into JSONB", value)
	}
}

// MustMarshalJSONB marshals a value to JSONB, returning nil on failure.
func MustMarshalJSONB(v interface{}) JSONB {
	b, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	var result JSONB
	if err := json.Unmarshal(b, &result); err != nil {
		return nil
	}
	return result
}
