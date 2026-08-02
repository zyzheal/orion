package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
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
	ChannelPush    ChannelType = "push"
)

type Status string

const (
	StatusPending Status = "pending"
	StatusSent    Status = "sent"
	StatusFailed  Status = "failed"
	StatusRead    Status = "read"
)

type NotificationStats struct{}

type ScheduledNotificationStatus string

const (
	ScheduledStatusPending ScheduledNotificationStatus = "pending"
	ScheduledStatusPaused  ScheduledNotificationStatus = "paused"
	ScheduledStatusActive  ScheduledNotificationStatus = "active"
)

type JSONB json.RawMessage

func (j JSONB) Value() (driver.Value, error) {
	return json.RawMessage(j).MarshalJSON()
}

func (j *JSONB) Scan(v interface{}) error {
	b, ok := v.([]byte)
	if !ok {
		return fmt.Errorf("cannot scan %T into JSONB", v)
	}
	*j = JSONB(b)
	return nil
}

type Notification struct {
	ID        string      `json:"id" db:"id"`
	TenantID  string      `json:"tenant_id" db:"tenant_id"`
	Channel   ChannelType `json:"channel" db:"channel"`
	Recipient string      `json:"recipient" db:"recipient"`
	Subject   string      `json:"subject" db:"subject"`
	Body      string      `json:"body" db:"body"`
	Status    Status      `json:"status" db:"status"`
	Metadata  JSONB       `json:"metadata" db:"metadata"`
	CreatedAt time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt time.Time   `json:"updated_at" db:"updated_at"`
}

type CreateNotificationRequest struct {
	Channel  ChannelType `json:"channel" binding:"required"`
	Recipient string     `json:"recipient" binding:"required"`
	Subject  string      `json:"subject" binding:"required"`
	Body     string      `json:"body" binding:"required"`
	Metadata JSONB       `json:"metadata"`
}

type ListNotificationsQuery struct {
	Page  int `json:"page"`
	Limit int `json:"limit"`
}

type NotificationDelivery struct {
	ID        string    `json:"id" db:"id"`
	NotificationID string `json:"notification_id" db:"notification_id"`
	Channel   string    `json:"channel" db:"channel"`
	Status    string    `json:"status" db:"status"`
	Error     string    `json:"error" db:"error"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type NotificationTemplate struct {
	ID          string `json:"id" db:"id"`
	TenantID    string `json:"tenant_id" db:"tenant_id"`
	Name        string `json:"name" db:"name"`
	Channel     string `json:"channel" db:"channel"`
	Subject     string `json:"subject" db:"subject"`
	Body        string `json:"body" db:"body"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type TemplatePreviewInput struct{}

type TemplateRenderResult struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

type BroadcastRequest struct{}

type Dashboard struct{}

type DashboardWidget struct{}

type DashboardOverview struct{}

type NotificationPolicyEntity struct {
	ID       string `json:"id" db:"id"`
	TenantID string `json:"tenant_id" db:"tenant_id"`
	Name     string `json:"name" db:"name"`
	Rules    JSONB  `json:"rules" db:"rules"`
}

type PolicyCondition struct {
	Field   string          `json:"field"`
	Operator PolicyOp        `json:"operator"`
	Value   interface{}     `json:"value"`
}

type PolicyOp string

const (
	PolicyOpEQ      PolicyOp = "eq"
	PolicyOpNEQ     PolicyOp = "neq"
	PolicyOpGT      PolicyOp = "gt"
	PolicyOpGTE     PolicyOp = "gte"
	PolicyOpLT      PolicyOp = "lt"
	PolicyOpLTE     PolicyOp = "lte"
	PolicyOpIn      PolicyOp = "in"
	PolicyOpContains PolicyOp = "contains"
	PolicyOpRegex   PolicyOp = "regex"
)

type CreatePolicyRequest struct{}

type UpdatePolicyRequest struct{}

type NotificationWorkflowEntity struct{}

type CreateWorkflowRequest struct{}

type UpdateWorkflowRequest struct{}

type NotificationSubscription struct{}

type SubscribeRequest struct{}

type ScheduledNotification struct {
	ID           string                    `json:"id" db:"id"`
	TenantID     string                    `json:"tenant_id" db:"tenant_id"`
	Name         string                    `json:"name" db:"name"`
	Status       ScheduledNotificationStatus `json:"status" db:"status"`
	CronSchedule string                    `json:"cron_schedule" db:"cron_schedule"`
	NextRun      time.Time                 `json:"next_run" db:"next_run"`
}

type CreateScheduledNotificationInput struct{}

type UpdateScheduledNotificationInput struct{}

type ToggleScheduledNotificationInput struct{}

type ParsedCronSchedule struct{}

type DoNotDisturb struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	StartTime time.Time `json:"start_time" db:"start_time"`
	EndTime   time.Time `json:"end_time" db:"end_time"`
}

type CreateDoNotDisturbInput struct{}

type NotificationChannel struct{}

type NotificationSettings struct{}

type UpdateSettingsRequest struct{}

type RenderTemplateFull struct{}

type ExtractTemplateVariables struct{}

