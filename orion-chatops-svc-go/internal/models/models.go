package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ==================== Common Types ====================

// JSONB is a map type that marshals to/from PostgreSQL JSONB columns.
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

// StringArray is a []string that marshals to/from PostgreSQL JSONB columns.
type StringArray []string

func (a StringArray) Value() (driver.Value, error) {
	if a == nil {
		return []byte("[]"), nil
	}
	return json.Marshal(a)
}

func (a *StringArray) Scan(src interface{}) error {
	if src == nil {
		*a = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("cannot scan %T into StringArray", src)
	}
}

// PaginatedRequest holds common pagination query params.
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

// ==================== ChatChannel (legacy) ====================

type ChatChannel struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	Channel   string    `db:"channel" json:"channel"`
	Command   string    `db:"command" json:"command"`
	Response  string    `db:"response" json:"response,omitempty"`
	Platform  string    `db:"platform" json:"platform"`
	Metadata  JSONB     `db:"metadata" json:"metadata,omitempty"`
}

type CreateChatChannelRequest struct {
	Name     string `json:"name" binding:"required"`
	Channel  string `json:"channel" binding:"required"`
	Command  string `json:"command" binding:"required"`
	Platform string `json:"platform" binding:"required"`
}

// ==================== Command ====================

// ChatOpsCommand represents a registered bot command.
type ChatOpsCommand struct {
	ID              string      `db:"id" json:"id"`
	TenantID        string      `db:"tenant_id" json:"tenant_id"`
	Name            string      `db:"name" json:"name"`
	Subcommand      string      `db:"subcommand" json:"subcommand"`
	SchemaDef       JSONB       `db:"schema_def" json:"schema_def"`
	Aliases         StringArray `db:"aliases" json:"aliases"`
	PermissionLevel string      `db:"permission_level" json:"permission_level"`
	Examples        StringArray `db:"examples" json:"examples"`
	Enabled         bool        `db:"enabled" json:"enabled"`
	CreatedAt       time.Time   `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time   `db:"updated_at" json:"updated_at"`
}

type CreateCommandRequest struct {
	Name            string      `json:"name" binding:"required"`
	Subcommand      string      `json:"subcommand"`
	SchemaDef       JSONB       `json:"schema_def"`
	Aliases         StringArray `json:"aliases"`
	PermissionLevel string      `json:"permission_level"`
	Examples        StringArray `json:"examples"`
}

type UpdateCommandRequest struct {
	Subcommand      *string      `json:"subcommand"`
	SchemaDef       *JSONB       `json:"schema_def"`
	Aliases         *StringArray `json:"aliases"`
	PermissionLevel *string      `json:"permission_level"`
	Examples        *StringArray `json:"examples"`
	Enabled         *bool        `json:"enabled"`
}

// ==================== Execution ====================

// ChatOpsExecution represents a single command execution.
type ChatOpsExecution struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	CommandID  string    `db:"command_id" json:"command_id"`
	UserID     string    `db:"user_id" json:"user_id"`
	Platform   string    `db:"platform" json:"platform"`
	Channel    string    `db:"channel" json:"channel"`
	Params     JSONB     `db:"params" json:"params"`
	Status     string    `db:"status" json:"status"`
	StartTime  time.Time `db:"start_time" json:"start_time"`
	EndTime    *time.Time `db:"end_time" json:"end_time,omitempty"`
	Result     JSONB     `db:"result" json:"result"`
	Milestones JSONB     `db:"milestones" json:"milestones"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

type CreateExecutionRequest struct {
	CommandID string `json:"command_id" binding:"required"`
	UserID    string `json:"user_id" binding:"required"`
	Platform  string `json:"platform"`
	Channel   string `json:"channel"`
	Params    JSONB  `json:"params"`
}

// ==================== Session ====================

// ChatOpsSession stores conversation state for a user-channel pair.
type ChatOpsSession struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	SessionKey string   `db:"session_key" json:"session_key"`
	UserID    string    `db:"user_id" json:"user_id"`
	ChannelID string    `db:"channel_id" json:"channel_id"`
	History   JSONB     `db:"history" json:"history"`
	State     JSONB     `db:"state" json:"state"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type CreateSessionRequest struct {
	SessionKey string `json:"session_key" binding:"required"`
	UserID     string `json:"user_id" binding:"required"`
	ChannelID  string `json:"channel_id"`
}

// ==================== Audit Log ====================

// ChatOpsAuditLog records every command execution for audit trail.
type ChatOpsAuditLog struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	TraceID   string    `db:"trace_id" json:"trace_id"`
	Actor     JSONB     `db:"actor" json:"actor"`
	Action    JSONB     `db:"action" json:"action"`
	Result    string    `db:"result" json:"result"`
	Context   JSONB     `db:"context" json:"context"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type CreateAuditLogRequest struct {
	TraceID string `json:"trace_id" binding:"required"`
	Actor   JSONB  `json:"actor"`
	Action  JSONB  `json:"action"`
	Result  string `json:"result"`
	Context JSONB  `json:"context"`
}

// ==================== Webhook ====================

// ChatOpsWebhook represents an outbound webhook configuration.
type ChatOpsWebhook struct {
	ID                   string     `db:"id" json:"id"`
	TenantID             string     `db:"tenant_id" json:"tenant_id"`
	Name                 string     `db:"name" json:"name"`
	URL                  string     `db:"url" json:"url"`
	Events               StringArray `db:"events" json:"events"`
	SecretKey            *string    `db:"secret_key" json:"secret_key,omitempty"`
	Enabled              bool       `db:"enabled" json:"enabled"`
	RetryCount           int        `db:"retry_count" json:"retry_count"`
	RetryIntervalSeconds int        `db:"retry_interval_seconds" json:"retry_interval_seconds"`
	TimeoutSeconds       int        `db:"timeout_seconds" json:"timeout_seconds"`
	Headers              JSONB      `db:"headers" json:"headers"`
	Description          string     `db:"description" json:"description"`
	CreatedBy            string     `db:"created_by" json:"created_by"`
	LastTriggeredAt      *time.Time `db:"last_triggered_at" json:"last_triggered_at,omitempty"`
	LastStatus           *string    `db:"last_status" json:"last_status,omitempty"`
	CreatedAt            time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt            time.Time  `db:"updated_at" json:"updated_at"`
}

type CreateWebhookRequest struct {
	Name                 string            `json:"name" binding:"required"`
	URL                  string            `json:"url" binding:"required"`
	Events               StringArray       `json:"events" binding:"required"`
	SecretKey            string            `json:"secret_key"`
	Enabled              *bool             `json:"enabled"`
	RetryCount           int               `json:"retry_count"`
	RetryIntervalSeconds int               `json:"retry_interval_seconds"`
	TimeoutSeconds       int               `json:"timeout_seconds"`
	Headers              map[string]string `json:"headers"`
	Description          string            `json:"description"`
	CreatedBy            string            `json:"created_by"`
}

type UpdateWebhookRequest struct {
	Name                 *string           `json:"name"`
	URL                  *string           `json:"url"`
	Events               *StringArray      `json:"events"`
	SecretKey            *string           `json:"secret_key"`
	Enabled              *bool             `json:"enabled"`
	RetryCount           *int              `json:"retry_count"`
	RetryIntervalSeconds *int              `json:"retry_interval_seconds"`
	TimeoutSeconds       *int              `json:"timeout_seconds"`
	Headers              map[string]string `json:"headers"`
	Description          *string           `json:"description"`
}

// ==================== Webhook Log ====================

// ChatOpsWebhookLog records a single webhook delivery attempt.
type ChatOpsWebhookLog struct {
	ID             string    `db:"id" json:"id"`
	TenantID       string    `db:"tenant_id" json:"tenant_id"`
	WebhookID      string    `db:"webhook_id" json:"webhook_id"`
	EventType      string    `db:"event_type" json:"event_type"`
	Payload        JSONB     `db:"payload" json:"payload"`
	ResponseStatus *int      `db:"response_status" json:"response_status,omitempty"`
	ResponseBody   *string   `db:"response_body" json:"response_body,omitempty"`
	ErrorMessage   *string   `db:"error_message" json:"error_message,omitempty"`
	RetryCount     int       `db:"retry_count" json:"retry_count"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

// ==================== Rate Limit ====================

// ChatOpsRateLimit defines rate limit rules for commands/users.
type ChatOpsRateLimit struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	TargetType  string    `db:"target_type" json:"target_type"`
	TargetID    *string   `db:"target_id" json:"target_id,omitempty"`
	CommandName *string   `db:"command_name" json:"command_name,omitempty"`
	LimitType   string    `db:"limit_type" json:"limit_type"`
	LimitCount  int       `db:"limit_count" json:"limit_count"`
	WindowSeconds int     `db:"window_seconds" json:"window_seconds"`
	Description string    `db:"description" json:"description"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateRateLimitRequest struct {
	TargetType    string  `json:"target_type" binding:"required"`
	TargetID      string  `json:"target_id"`
	CommandName   string  `json:"command_name"`
	LimitType     string  `json:"limit_type" binding:"required"`
	LimitCount    int     `json:"limit_count" binding:"required"`
	WindowSeconds int     `json:"window_seconds" binding:"required"`
	Description   string  `json:"description"`
	Enabled       *bool   `json:"enabled"`
}

type UpdateRateLimitRequest struct {
	TargetType    *string `json:"target_type"`
	TargetID      *string `json:"target_id"`
	CommandName   *string `json:"command_name"`
	LimitType     *string `json:"limit_type"`
	LimitCount    *int    `json:"limit_count"`
	WindowSeconds *int    `json:"window_seconds"`
	Description   *string `json:"description"`
	Enabled       *bool   `json:"enabled"`
}

// ==================== Question Config ====================

// ChatOpsQuestionConfig stores user's quick-question card configuration.
type ChatOpsQuestionConfig struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	UserID      string    `db:"user_id" json:"user_id"`
	Key         string    `db:"key" json:"key"`
	Icon        string    `db:"icon" json:"icon"`
	Title       string    `db:"title" json:"title"`
	Description string    `db:"description" json:"description"`
	Question    string    `db:"question" json:"question"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	SortOrder   int       `db:"sort_order" json:"sort_order"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type QuestionConfigInput struct {
	Key         string `json:"key" binding:"required"`
	Icon        string `json:"icon"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Question    string `json:"question"`
	Enabled     *bool  `json:"enabled"`
}

// ==================== Command Config ====================

// ChatOpsCommandConfig stores user's quick-command shortcut configuration.
type ChatOpsCommandConfig struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenant_id"`
	UserID    string    `db:"user_id" json:"user_id"`
	Key       string    `db:"key" json:"key"`
	Label     string    `db:"label" json:"label"`
	Command   string    `db:"command" json:"command"`
	Enabled   bool      `db:"enabled" json:"enabled"`
	SortOrder int       `db:"sort_order" json:"sort_order"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type CommandConfigInput struct {
	Key     string `json:"key" binding:"required"`
	Label   string `json:"label"`
	Command string `json:"command"`
	Enabled *bool  `json:"enabled"`
}

// ==================== Recommendation ====================

// RecommendationAction is an actionable step attached to a recommendation.
type RecommendationAction struct {
	Label   string `json:"label"`
	Command string `json:"command"`
	Params  JSONB  `json:"params,omitempty"`
}

// ChatOpsRecommendation is a single smart-recommendation item.
type ChatOpsRecommendation struct {
	ID          string                `json:"id"`
	Type        string                `json:"type"`
	Severity    string                `json:"severity"`
	Title       string                `json:"title"`
	Description string                `json:"description"`
	Actions     []RecommendationAction `json:"actions"`
	Source      string                `json:"source"`
	CreatedAt   time.Time             `json:"created_at"`
}

// ==================== Message ====================

// SendMessageRequest is the payload for the /messages endpoint.
type SendMessageRequest struct {
	Content   string `json:"content" binding:"required"`
	Channel   string `json:"channel"`
	Platform  string `json:"platform"`
	UserID    string `json:"user_id"`
}

// MessageResponse is returned after sending a message.
type MessageResponse struct {
	ID        string    `json:"id"`
	Content   string    `json:"content"`
	Channel   string    `json:"channel"`
	Platform  string    `json:"platform"`
	UserID    string    `json:"user_id"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

// ==================== Command Parse Result ====================

// ParsedCommand holds the result of parsing a raw chat input string.
type ParsedCommand struct {
	Command *ChatOpsCommand    `json:"command,omitempty"`
	Params  map[string]string  `json:"params"`
	Raw     string             `json:"raw"`
}

// ==================== Command Execution Result ====================

// CommandResult is the output of executing a command through the router.
type CommandResult struct {
	Mock     bool                   `json:"mock,omitempty"`
	Command  string                 `json:"command"`
	Params   map[string]interface{} `json:"params"`
	Output   string                 `json:"output"`
	Status   string                 `json:"status"`
	Message  string                 `json:"message,omitempty"`
	ExitCode int                    `json:"exit_code,omitempty"`
}

// ==================== Webhook Verify Result ====================

// WebhookVerifyResult is returned by the webhook signature verifier.
type WebhookVerifyResult struct {
	Valid    bool   `json:"valid"`
	Platform string `json:"platform"`
	UserID   string `json:"user_id,omitempty"`
	Error    string `json:"error,omitempty"`
}
