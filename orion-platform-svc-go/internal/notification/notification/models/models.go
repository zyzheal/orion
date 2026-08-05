package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

type ChannelType string

const (
	ChannelEmail   ChannelType = "email"
	ChannelSlack   ChannelType = "slack"
	ChannelWebhook ChannelType = "webhook"
	ChannelWechat  ChannelType = "wechat"
	ChannelDingtalk ChannelType = "dingtalk"
	ChannelInApp   ChannelType = "in_app"
)

type Status string

const (
	StatusPending Status = "pending"
	StatusSent    Status = "sent"
	StatusFailed  Status = "failed"
	StatusRead    Status = "read"
)

type DeliveryStatus string

const (
	DeliveryStatusPending     DeliveryStatus = "pending"
	DeliveryStatusSent        DeliveryStatus = "sent"
	DeliveryStatusSuccess     DeliveryStatus = "success"
	DeliveryStatusFailed      DeliveryStatus = "failed"
	DeliveryStatusRetrying    DeliveryStatus = "retrying"
	DeliveryStatusExhausted   DeliveryStatus = "exhausted"
)

type DeliveryChannel string

const (
	DeliveryChannelInApp   DeliveryChannel = "in_app"
	DeliveryChannelPush    DeliveryChannel = "push"
	DeliveryChannelWebhook DeliveryChannel = "webhook"
	DeliveryChannelEmail   DeliveryChannel = "email"
	DeliveryChannelSMS     DeliveryChannel = "sms"
)

type ScheduledNotificationStatus string

const (
	ScheduledStatusPending ScheduledNotificationStatus = "pending"
	ScheduledStatusPaused  ScheduledNotificationStatus = "paused"
	ScheduledStatusActive  ScheduledNotificationStatus = "active"
	ScheduledStatusSent    ScheduledNotificationStatus = "sent"
)

type PolicyOp string

const (
	PolicyOpEQ       PolicyOp = "eq"
	PolicyOpNEQ      PolicyOp = "neq"
	PolicyOpGT       PolicyOp = "gt"
	PolicyOpGTE      PolicyOp = "gte"
	PolicyOpLT       PolicyOp = "lt"
	PolicyOpLTE      PolicyOp = "lte"
	PolicyOpIn       PolicyOp = "in"
	PolicyOpContains PolicyOp = "contains"
	PolicyOpRegex    PolicyOp = "regex"
)

type PolicyConditionOperator string

const (
	PolicyConditionOperatorAnd PolicyConditionOperator = "and"
	PolicyConditionOperatorOr  PolicyConditionOperator = "or"
)

type PolicyCondition struct {
	Field    string                `json:"field"`
	Operator PolicyOp              `json:"operator"`
	Value    interface{}           `json:"value"`
}

type WidgetType string

const (
	WidgetTypeTotalNotifications WidgetType = "total_notifications"
	WidgetTypeDeliveryStatus     WidgetType = "delivery_status"
	WidgetTypeFailureRate        WidgetType = "failure_rate"
	WidgetTypeRecentActivity     WidgetType = "recent_activity"
)

type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	return json.Marshal(j)
}

func (j *JSONB) Scan(v interface{}) error {
	b, ok := v.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(b, j)
}

type Notification struct {
	ID        string      `json:"id" db:"id"`
	TenantID  string      `json:"tenant_id" db:"tenant_id"`
	UserID    string      `json:"user_id" db:"user_id"`
	Type      string      `json:"type" db:"type"`
	Title     string      `json:"title" db:"title"`
	Channel   ChannelType `json:"channel" db:"channel"`
	Recipient string      `json:"recipient" db:"recipient"`
	Subject   string      `json:"subject" db:"subject"`
	Body      string      `json:"body" db:"body"`
	Status    Status      `json:"status" db:"status"`
	Metadata  JSONB       `json:"metadata" db:"metadata"`
	ReadAt    *time.Time  `json:"read_at" db:"read_at"`
	SentAt    *time.Time  `json:"sent_at" db:"sent_at"`
	CreatedAt time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt time.Time   `json:"updated_at" db:"updated_at"`
}

type NotificationDelivery struct {
	ID             string          `json:"id" db:"id"`
	TenantID       string          `json:"tenant_id" db:"tenant_id"`
	NotificationID string          `json:"notification_id" db:"notification_id"`
	Recipient      string          `json:"recipient" db:"recipient"`
	Subject        string          `json:"subject" db:"subject"`
	Body           string          `json:"body" db:"body"`
	Channel        DeliveryChannel `json:"channel" db:"channel"`
	Status         DeliveryStatus  `json:"status" db:"status"`
	ErrorMessage   *string         `json:"error_message" db:"error_message"`
	ResponseStatus *int            `json:"response_status" db:"response_status"`
	ResponseBody   *string         `json:"response_body" db:"response_body"`
	AttemptNumber  int             `json:"attempt_number" db:"attempt_number"`
	MaxAttempts    int             `json:"max_attempts" db:"max_attempts"`
	NextRetryAt    *time.Time      `json:"next_retry_at" db:"next_retry_at"`
	SentAt         *time.Time      `json:"sent_at" db:"sent_at"`
	FallbackChannel *ChannelType  `json:"fallback_channel" db:"fallback_channel"`
	Metadata       JSONB           `json:"metadata" db:"metadata"`
	CreatedAt      time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at" db:"updated_at"`
}

type NotificationTemplate struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Channel   string    `json:"channel" db:"channel"`
	Subject   string    `json:"subject" db:"subject"`
	Body      string    `json:"body" db:"body"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type NotificationStats struct {
	Total       int `json:"total"`
	Pending     int `json:"pending"`
	Sent        int `json:"sent"`
	Failed      int `json:"failed"`
	Read        int `json:"read"`
	ReadCount   int `json:"read_count"`
	UnreadCount int `json:"unread_count"`
}

type NotificationChannel struct {
	ID        string      `json:"id" db:"id"`
	TenantID  string      `json:"tenant_id" db:"tenant_id"`
	Name      string      `json:"name" db:"name"`
	Type      ChannelType `json:"type" db:"type"`
	Config    JSONB       `json:"config" db:"config"`
	Enabled   bool        `json:"enabled" db:"enabled"`
	CreatedAt time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt time.Time   `json:"updated_at" db:"updated_at"`
}

type NotificationSettings struct {
	ID              string    `json:"id" db:"id"`
	UserID          string    `json:"user_id" db:"user_id"`
	TenantID        string    `json:"tenant_id" db:"tenant_id"`
	EmailEnabled    bool      `json:"email_enabled" db:"email_enabled"`
	SlackEnabled    bool      `json:"slack_enabled" db:"slack_enabled"`
	WebhookEnabled  bool      `json:"webhook_enabled" db:"webhook_enabled"`
	WebhookURL      string    `json:"webhook_url" db:"webhook_url"`
	PipelineCompleted  bool   `json:"pipeline_completed" db:"pipeline_completed"`
	PipelineFailed     bool   `json:"pipeline_failed" db:"pipeline_failed"`
	TicketAssigned     bool   `json:"ticket_assigned" db:"ticket_assigned"`
	TicketEscalated    bool   `json:"ticket_escalated" db:"ticket_escalated"`
	SLAWarning         bool   `json:"sla_warning" db:"sla_warning"`
	SLABreached        bool   `json:"sla_breached" db:"sla_breached"`
	AlertTriggered     bool   `json:"alert_triggered" db:"alert_triggered"`
	DeploymentSuccess  bool   `json:"deployment_success" db:"deployment_success"`
	DeploymentFailed   bool   `json:"deployment_failed" db:"deployment_failed"`
	SystemAlert        bool   `json:"system_alert" db:"system_alert"`
	CommentMention     bool   `json:"comment_mention" db:"comment_mention"`
	TransferRequest    bool   `json:"transfer_request" db:"transfer_request"`
	DigestEnabled      bool   `json:"digest_enabled" db:"digest_enabled"`
	DigestFrequency    string `json:"digest_frequency" db:"digest_frequency"`
	QuietHoursStart    string `json:"quiet_hours_start" db:"quiet_hours_start"`
	QuietHoursEnd      string `json:"quiet_hours_end" db:"quiet_hours_end"`
	DailyLimit  *int    `json:"daily_limit" db:"daily_limit"`
	RateLimit   *int    `json:"rate_limit" db:"rate_limit"`
	Enabled     bool     `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type NotificationPolicyEntity struct {
	ID            string             `json:"id" db:"id"`
	TenantID      string             `json:"tenant_id" db:"tenant_id"`
	Name          string             `json:"name" db:"name"`
	Rules         JSONB              `json:"rules" db:"rules"`
	Conditions    []PolicyCondition  `json:"conditions" db:"conditions"`
	Channels      []string           `json:"channels" db:"channels"`
	Recipients    []string           `json:"recipients" db:"recipients"`
	Description   *string            `json:"description" db:"description"`
	CreatedBy     *string            `json:"created_by" db:"created_by"`
	ThrottleMinutes int              `json:"throttle_minutes" db:"throttle_minutes"`
	Enabled       bool               `json:"enabled" db:"enabled"`
	CreatedAt     time.Time          `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time          `json:"updated_at" db:"updated_at"`
}

type NotificationWorkflowEntity struct {
	ID            string             `json:"id" db:"id"`
	TenantID      string             `json:"tenant_id" db:"tenant_id"`
	Name          string             `json:"name" db:"name"`
	PolicyID      string             `json:"policy_id" db:"policy_id"`
	Steps         []WorkflowStep     `json:"steps" db:"steps"`
	Conditions    []PolicyCondition  `json:"conditions" db:"conditions"`
	Channels      []string           `json:"channels" db:"channels"`
	Recipients    []string           `json:"recipients" db:"recipients"`
	Description   *string            `json:"description" db:"description"`
	CreatedBy     *string            `json:"created_by" db:"created_by"`
	ThrottleMinutes int              `json:"throttle_minutes" db:"throttle_minutes"`
	Enabled       bool               `json:"enabled" db:"enabled"`
	CreatedAt     time.Time          `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time          `json:"updated_at" db:"updated_at"`
}

type WorkflowStep struct {
	ID       string `json:"id" db:"id"`
	Name     string `json:"name" db:"name"`
	StepType string `json:"step_type" db:"step_type"`
	Config   JSONB  `json:"config" db:"config"`
	Order    int    `json:"order" db:"order"`
}

type NotificationSubscription struct {
	ID       string    `json:"id" db:"id"`
	TenantID string    `json:"tenant_id" db:"tenant_id"`
	UserID   string    `json:"user_id" db:"user_id"`
	Channel  string    `json:"channel" db:"channel"`
	Enabled  bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type ScheduledNotification struct {
	ID             string                      `json:"id" db:"id"`
	TenantID       string                      `json:"tenant_id" db:"tenant_id"`
	UserID         string                      `json:"user_id" db:"user_id"`
	Name           string                      `json:"name" db:"name"`
	Type           string                      `json:"type" db:"type"`
	Title          string                      `json:"title" db:"title"`
	Message        string                      `json:"message" db:"message"`
	TemplateID     string                      `json:"template_id" db:"template_id"`
	Status         ScheduledNotificationStatus `json:"status" db:"status"`
	CronSchedule   string                      `json:"cron_schedule" db:"cron_schedule"`
	Channel        string                      `json:"channel" db:"channel"`
	ScheduledAt    *time.Time                  `json:"scheduled_at" db:"scheduled_at"`
	NextRun        *time.Time                  `json:"next_run" db:"next_run"`
	NotificationID string                      `json:"notification_id" db:"notification_id"`
	SentAt         *time.Time                  `json:"sent_at" db:"sent_at"`
	ErrorMessage   *string                     `json:"error_message" db:"error_message"`
	CreatedAt      time.Time                   `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time                   `json:"updated_at" db:"updated_at"`
}

type DoNotDisturb struct {
	ID        string     `json:"id" db:"id"`
	TenantID  string     `json:"tenant_id" db:"tenant_id"`
	UserID    string     `json:"user_id" db:"user_id"`
	StartTime time.Time  `json:"start_time" db:"start_time"`
	EndTime   time.Time  `json:"end_time" db:"end_time"`
	Reason    *string    `json:"reason" db:"reason"`
	Active    bool       `json:"active" db:"active"`
}

type Dashboard struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	IsDefault   bool      `json:"is_default" db:"is_default"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type DashboardWidget struct {
	ID          string     `json:"id" db:"id"`
	DashboardID string     `json:"dashboard_id" db:"dashboard_id"`
	TenantID    string     `json:"tenant_id" db:"tenant_id"`
	Name        string     `json:"name" db:"name"`
	Type        WidgetType `json:"type" db:"type"`
	Position    int        `json:"position" db:"position"`
	Size        string     `json:"size" db:"size"`
	Enabled     bool       `json:"enabled" db:"enabled"`
	Config      JSONB      `json:"config" db:"config"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

type DashboardOverview struct {
	TotalNotifications int64           `json:"total_notifications"`
	TotalChannels      int64           `json:"total_channels"`
	TotalTemplates     int64           `json:"total_templates"`
	SuccessRate        float64         `json:"success_rate"`
	PendingCount       int64           `json:"pending_count"`
	SentCount          int64           `json:"sent_count"`
	FailedCount        int64           `json:"failed_count"`
	DeliveredCount     int64           `json:"delivered_count"`
	ChannelsEnabled    int64           `json:"channels_enabled"`
	ActiveTemplates    int64           `json:"active_templates"`
	RecentDeliveries   []NotificationDelivery `json:"recent_deliveries"`
	RecentActivity     []DashboardWidget     `json:"recent_activity"`
}

type Anomaly struct {
	ID           string      `json:"id" db:"id"`
	TenantID     string      `json:"tenant_id" db:"tenant_id"`
	Type         string      `json:"type" db:"type"`
	Severity     string      `json:"severity" db:"severity"`
	Message      string      `json:"message" db:"message"`
	Details      JSONB       `json:"details" db:"details"`
	SourceID     string      `json:"source_id" db:"source_id"`
	SourceIDType string      `json:"source_id_type" db:"source_id_type"`
	Status       string      `json:"status" db:"status"`
	ResolvedAt   *time.Time  `json:"resolved_at" db:"resolved_at"`
	Metadata     JSONB       `json:"metadata" db:"metadata"`
	CreatedAt    time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at" db:"updated_at"`
}

type CreateNotificationRequest struct {
	TenantID  string      `json:"tenant_id"`
	UserID    string      `json:"user_id"`
	Type      string      `json:"type"`
	Title     string      `json:"title"`
	Channel   ChannelType `json:"channel" binding:"required"`
	Recipient string      `json:"recipient" binding:"required"`
	Subject   string      `json:"subject" binding:"required"`
	Body      string      `json:"body" binding:"required"`
	Metadata  JSONB       `json:"metadata"`
}

type ListNotificationsQuery struct {
	Page   int     `json:"page"`
	Limit  int     `json:"limit"`
	Offset int     `json:"offset"`
	Status Status  `json:"status"`
	UserID string  `json:"user_id"`
	After  string  `json:"after"`
}

type ListAnomaliesQuery struct {
	Page     int     `json:"page"`
	Size     int     `json:"size"`
	Severity *string `json:"severity"`
	Type     *string `json:"type"`
	Status   *string `json:"status"`
	After    string  `json:"after"`
}

type CreatePolicyRequest struct {
	Name            string            `json:"name" binding:"required"`
	Description     *string           `json:"description"`
	Conditions      []PolicyCondition `json:"conditions"`
	Channels        []string          `json:"channels"`
	Recipients      []string          `json:"recipients"`
	ThrottleMinutes int               `json:"throttle_minutes"`
	Enabled         *bool             `json:"enabled"`
	Rules           []PolicyCondition `json:"rules"`
}

type UpdatePolicyRequest struct {
	Name            *string         `json:"name"`
	Description     *string         `json:"description"`
	Conditions      []PolicyCondition `json:"conditions"`
	Channels        []string        `json:"channels"`
	Recipients      []string        `json:"recipients"`
	ThrottleMinutes *int            `json:"throttle_minutes"`
	Enabled         *bool           `json:"enabled"`
	Rules           []PolicyCondition `json:"rules"`
}

type CreateWorkflowRequest struct {
	Name        string         `json:"name" binding:"required"`
	Description *string        `json:"description"`
	Steps       []WorkflowStep `json:"steps"`
	Enabled     *bool          `json:"enabled"`
	PolicyID    string         `json:"policy_id"`
}

type UpdateWorkflowRequest struct {
	Name        *string        `json:"name"`
	Description *string        `json:"description"`
	Steps       []WorkflowStep `json:"steps"`
	Enabled     *bool          `json:"enabled"`
}

type CreateScheduledNotificationInput struct {
	UserID      string    `json:"user_id" binding:"required"`
	Type        string    `json:"type" binding:"required"`
	Title       string    `json:"title" binding:"required"`
	Message     string    `json:"message" binding:"required"`
	ScheduledAt time.Time `json:"scheduled_at" binding:"required"`
	Channel     ChannelType `json:"channel"`
	TemplateID  string    `json:"template_id"`
	Name        string    `json:"name"`
	CronSchedule string   `json:"cron_schedule"`
	NotificationID string `json:"notification_id"`
}

type UpdateScheduledNotificationInput struct {
	Name         *string     `json:"name"`
	Title        *string     `json:"title"`
	Message      *string     `json:"message"`
	ScheduledAt  *time.Time  `json:"scheduled_at"`
	Status       *string     `json:"status"`
	CronSchedule *string     `json:"cron_schedule"`
	Enabled      *bool       `json:"enabled"`
}

type ToggleScheduledNotificationInput struct {
	Enabled *bool `json:"enabled"`
}

type SubscribeRequest struct {
	Channel   string `json:"channel" binding:"required"`
	Recipient string `json:"recipient" binding:"required"`
	Enabled   bool   `json:"enabled"`
}

type CreateDoNotDisturbInput struct {
	UserID    string    `json:"user_id" binding:"required"`
	StartTime time.Time `json:"start_time" binding:"required"`
	EndTime   time.Time `json:"end_time" binding:"required"`
	Reason    *string   `json:"reason"`
}

type UpdateSettingsRequest struct {
	EmailEnabled       *bool   `json:"email_enabled"`
	SlackEnabled       *bool   `json:"slack_enabled"`
	WebhookEnabled     *bool   `json:"webhook_enabled"`
	WebhookURL         *string `json:"webhook_url"`
	DailyLimit         *int    `json:"daily_limit"`
	RateLimit          *int    `json:"rate_limit"`
	Enabled            *bool   `json:"enabled"`
	PipelineCompleted  *bool   `json:"pipeline_completed"`
	PipelineFailed     *bool   `json:"pipeline_failed"`
	TicketAssigned     *bool   `json:"ticket_assigned"`
	TicketEscalated    *bool   `json:"ticket_escalated"`
	SLAWarning         *bool   `json:"sla_warning"`
	SLABreached        *bool   `json:"sla_breached"`
	AlertTriggered     *bool   `json:"alert_triggered"`
	DeploymentSuccess  *bool   `json:"deployment_success"`
	DeploymentFailed   *bool   `json:"deployment_failed"`
	SystemAlert        *bool   `json:"system_alert"`
	CommentMention     *bool   `json:"comment_mention"`
	TransferRequest    *bool   `json:"transfer_request"`
	DigestEnabled      *bool   `json:"digest_enabled"`
	DigestFrequency    *string `json:"digest_frequency"`
	QuietHoursStart    *string `json:"quiet_hours_start"`
	QuietHoursEnd      *string `json:"quiet_hours_end"`
}

type TemplatePreviewInput struct {
	TemplateID string         `json:"template_id" binding:"required"`
	Context    map[string]any `json:"context"`
	Variables  map[string]any `json:"variables"`
}

type TemplateRenderResult struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

type BroadcastRequest struct {
	UserIDs    []string      `json:"user_ids" binding:"required"`
	Type       string        `json:"type" binding:"required"`
	Title      string        `json:"title" binding:"required"`
	Message    string        `json:"message" binding:"required"`
	Recipient  string        `json:"recipient"`
	Channels   []ChannelType `json:"channels"`
}

type RenderTemplateFull struct {
	TemplateID string         `json:"template_id" binding:"required"`
	Context    map[string]any `json:"context"`
}

type ExtractTemplateVariables struct {
	TemplateID string `json:"template_id" binding:"required"`
}

type ParsedCronSchedule struct {
	Expression  string      `json:"expression"`
	Description string      `json:"description"`
	Error       string      `json:"error"`
	NextRuns    []time.Time `json:"next_runs"`
}

// Offset returns the page offset for pagination.
