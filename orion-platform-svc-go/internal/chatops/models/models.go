package models

import "time"

// --- Command ---

type ChatOpsCommand struct {
	ID              string    `json:"id" db:"id"`
	TenantID        string    `json:"tenant_id" db:"tenant_id"`
	Name            string    `json:"name" db:"name"`
	Subcommand      string    `json:"subcommand" db:"subcommand"`
	Aliases         string    `json:"aliases" db:"aliases"`
	Description     string    `json:"description" db:"description"`
	PermissionLevel string    `json:"permission_level" db:"permission_level"`
	Schema          string    `json:"schema" db:"schema"`
	Examples        string    `json:"examples" db:"examples"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

type CreateCommandRequest struct {
	Name            string `json:"name" binding:"required"`
	Subcommand      string `json:"subcommand"`
	Aliases         string `json:"aliases"`
	Description     string `json:"description"`
	PermissionLevel string `json:"permission_level"`
	Schema          string `json:"schema"`
	Examples        string `json:"examples"`
}

type UpdateCommandRequest struct {
	Name            *string `json:"name"`
	Subcommand      *string `json:"subcommand"`
	Description     *string `json:"description"`
	PermissionLevel *string `json:"permission_level"`
	Schema          *string `json:"schema"`
	Examples        *string `json:"examples"`
}

// --- Execution ---

type Execution struct {
	ID         string     `json:"id" db:"id"`
	TenantID   string     `json:"tenant_id" db:"tenant_id"`
	CommandID  string     `json:"command_id" db:"command_id"`
	UserID     string     `json:"user_id" db:"user_id"`
	Status     string     `json:"status" db:"status"` // running, completed, failed
	Params     string     `json:"params" db:"params"`
	Result     string     `json:"result" db:"result"`
	Milestones string     `json:"milestones" db:"milestones"`
	StartTime  time.Time  `json:"start_time" db:"start_time"`
	EndTime    *time.Time `json:"end_time" db:"end_time"`
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
}

type ExecuteCommandRequest struct {
	Command  string                 `json:"command" binding:"required"`
	Params   map[string]interface{} `json:"params"`
	Channel  string                 `json:"channel"`
	Platform string                 `json:"platform"`
}

// --- Session / Message ---

type ChatOpsSession struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type ChatOpsMessage struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	SessionID string    `json:"session_id" db:"session_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Text      string    `json:"text" db:"text"`
	Platform  string    `json:"platform" db:"platform"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// --- Audit Log ---

type AuditLog struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	Action    string    `json:"action" db:"action"`
	Command   string    `json:"command" db:"command"`
	Details   string    `json:"details" db:"details"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type AuditLogQuery struct {
	UserID    *string `json:"user_id"`
	Action    *string `json:"action"`
	Command   *string `json:"command"`
	Limit     *int    `json:"limit"`
	Offset    *int    `json:"offset"`
	StartTime *string `json:"start_time"`
	EndTime   *string `json:"end_time"`
}

// --- Notification Preference ---

type NotificationPreference struct {
	ID              string `json:"id" db:"id"`
	TenantID        string `json:"tenant_id" db:"tenant_id"`
	UserID          string `json:"user_id" db:"user_id"`
	AlertLevel      string `json:"alert_level" db:"alert_level"`
	ChannelChatops  bool   `json:"channel_chatops" db:"channel_chatops"`
	ChannelEmail    bool   `json:"channel_email" db:"channel_email"`
	ChannelSlack    bool   `json:"channel_slack" db:"channel_slack"`
	ChannelFeishu   bool   `json:"channel_feishu" db:"channel_feishu"`
	ChannelDingtalk bool   `json:"channel_dingtalk" db:"channel_dingtalk"`
}

type UpdateNotificationPreferenceRequest struct {
	AlertLevel      string `json:"alert_level"`
	ChannelChatops  *bool  `json:"channel_chatops"`
	ChannelEmail    *bool  `json:"channel_email"`
	ChannelSlack    *bool  `json:"channel_slack"`
	ChannelFeishu   *bool  `json:"channel_feishu"`
	ChannelDingtalk *bool  `json:"channel_dingtalk"`
}

// --- DND Settings ---

type DNDSettings struct {
	ID            string `json:"id" db:"id"`
	TenantID      string `json:"tenant_id" db:"tenant_id"`
	UserID        string `json:"user_id" db:"user_id"`
	Enabled       bool   `json:"enabled" db:"enabled"`
	StartTime     string `json:"start_time" db:"start_time"`
	EndTime       string `json:"end_time" db:"end_time"`
	RepeatDays    string `json:"repeat_days" db:"repeat_days"`
	AllowCritical bool   `json:"allow_critical" db:"allow_critical"`
}

type UpdateDNDRequest struct {
	Enabled       *bool  `json:"enabled"`
	StartTime     string `json:"start_time"`
	EndTime       string `json:"end_time"`
	RepeatDays    string `json:"repeat_days"`
	AllowCritical *bool  `json:"allow_critical"`
}

type ToggleDNDRequest struct {
	Enabled bool `json:"enabled" binding:"required"`
}

// --- Platform Config ---

type PlatformConfig struct {
	ID       string `json:"id" db:"id"`
	TenantID string `json:"tenant_id" db:"tenant_id"`
	UserID   string `json:"user_id" db:"user_id"`
	Platform string `json:"platform" db:"platform"`
	Enabled  bool   `json:"enabled" db:"enabled"`
	Webhook  string `json:"webhook" db:"webhook"`
	Token    string `json:"token" db:"token"`
}

type UpdatePlatformConfigRequest struct {
	Platforms []PlatformConfigInput `json:"platforms" binding:"required"`
}

type PlatformConfigInput struct {
	Platform string `json:"platform" binding:"required"`
	Enabled  bool   `json:"enabled"`
	Webhook  string `json:"webhook"`
	Token    string `json:"token"`
}

// --- Alert State ---

type AlertState struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	UserID    string    `json:"user_id" db:"user_id"`
	AlertID   string    `json:"alert_id" db:"alert_id"`
	Status    string    `json:"status" db:"status"` // unread, read, acknowledged, dismissed
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// --- Question / Command Config ---

type QuestionConfig struct {
	ID       string `json:"id" db:"id"`
	TenantID string `json:"tenant_id" db:"tenant_id"`
	UserID   string `json:"user_id" db:"user_id"`
	Title    string `json:"title" db:"title"`
	Command  string `json:"command" db:"command"`
	Enabled  bool   `json:"enabled" db:"enabled"`
}

type CommandConfig struct {
	ID       string `json:"id" db:"id"`
	TenantID string `json:"tenant_id" db:"tenant_id"`
	UserID   string `json:"user_id" db:"user_id"`
	Command  string `json:"command" db:"command"`
	Params   string `json:"params" db:"params"`
	Enabled  bool   `json:"enabled" db:"enabled"`
}

type UpdateQuestionConfigsRequest struct {
	QuestionConfigs []QuestionConfigInput `json:"question_configs"`
}

type QuestionConfigInput struct {
	ID      string `json:"id"`
	Title   string `json:"title" binding:"required"`
	Command string `json:"command" binding:"required"`
	Enabled bool   `json:"enabled"`
}

type UpdateCommandConfigsRequest struct {
	CommandConfigs []CommandConfigInput `json:"command_configs"`
}

type CommandConfigInput struct {
	ID      string `json:"id"`
	Command string `json:"command" binding:"required"`
	Params  string `json:"params"`
	Enabled bool   `json:"enabled"`
}

// --- Capability Mapping ---

type CapabilityMapping struct {
	ID               string `json:"id" db:"id"`
	TenantID         string `json:"tenant_id" db:"tenant_id"`
	CommandID        string `json:"command_id" db:"command_id"`
	CapabilityID     string `json:"capability_id" db:"capability_id"`
	Environment      string `json:"environment" db:"environment"`
	RiskLevel        int    `json:"risk_level" db:"risk_level"`
	RequiresApproval bool   `json:"requires_approval" db:"requires_approval"`
}

type CreateCapabilityMappingRequest struct {
	CommandID        string `json:"command_id" binding:"required"`
	CapabilityID     string `json:"capability_id" binding:"required"`
	Environment      string `json:"environment"`
	RiskLevel        int    `json:"risk_level" binding:"required,min=1,max=4"`
	RequiresApproval bool   `json:"requires_approval"`
}

type UpdateCapabilityMappingRequest struct {
	CommandID        *string `json:"command_id"`
	CapabilityID     *string `json:"capability_id"`
	Environment      *string `json:"environment"`
	RiskLevel        *int    `json:"risk_level"`
	RequiresApproval *bool   `json:"requires_approval"`
}

// --- Approval Config ---

type ApprovalConfig struct {
	ID         string `json:"id" db:"id"`
	TenantID   string `json:"tenant_id" db:"tenant_id"`
	Capability string `json:"capability" db:"capability"`
	Enabled    bool   `json:"enabled" db:"enabled"`
	Approvers  string `json:"approvers" db:"approvers"`
	Threshold  int    `json:"threshold" db:"threshold"`
}

type UpdateApprovalConfigRequest struct {
	Enabled   *bool   `json:"enabled"`
	Approvers *string `json:"approvers"`
	Threshold *int    `json:"threshold"`
}

type UpdateApprovalConfigsRequest struct {
	Configs []ApprovalConfigInput `json:"body"`
}

type ApprovalConfigInput struct {
	Capability string   `json:"capability" binding:"required"`
	Enabled    bool     `json:"enabled"`
	Approvers  []string `json:"approvers"`
	Threshold  int      `json:"threshold"`
}

type Approver struct {
	UserID  string `json:"user_id" db:"user_id"`
	Enabled bool   `json:"enabled" db:"enabled"`
}

type ApproverSchedule struct {
	UserID    string `json:"user_id" db:"user_id"`
	StartTime string `json:"start_time" db:"start_time"`
	EndTime   string `json:"end_time" db:"end_time"`
}

type UpdateApproverScheduleRequest struct {
	Schedule []ApproverScheduleInput `json:"body"`
}

type ApproverScheduleInput struct {
	UserID    string `json:"user_id" binding:"required"`
	StartTime string `json:"start_time" binding:"required"`
	EndTime   string `json:"end_time" binding:"required"`
}

type GlobalApprovalConfig struct {
	Enabled bool   `json:"enabled"`
	Mode    string `json:"mode"`
}

type UpdateGlobalApprovalConfigRequest struct {
	Enabled bool   `json:"enabled" binding:"required"`
	Mode    string `json:"mode" binding:"required"`
}

// --- Role (Permission Admin) ---

type PermissionRole struct {
	ID          string `json:"id" db:"id"`
	TenantID    string `json:"tenant_id" db:"tenant_id"`
	Name        string `json:"name" db:"name"`
	Description string `json:"description" db:"description"`
	Permissions string `json:"permissions" db:"permissions"`
}

type CreateRoleRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

type UpdateRoleRequest struct {
	Name        *string   `json:"name"`
	Description *string   `json:"description"`
	Permissions *[]string `json:"permissions"`
}

// --- Command Permission ---

type CommandPermission struct {
	ID               string `json:"id" db:"id"`
	TenantID         string `json:"tenant_id" db:"tenant_id"`
	Command          string `json:"command" db:"command"`
	Description      string `json:"description" db:"description"`
	Capability       string `json:"capability" db:"capability"`
	RiskLevel        int    `json:"risk_level" db:"risk_level"`
	RequiresApproval bool   `json:"requires_approval" db:"requires_approval"`
	RoleIDs          string `json:"role_ids" db:"role_ids"`
}

type CreateCommandPermissionRequest struct {
	Command          string   `json:"command" binding:"required"`
	Description      string   `json:"description"`
	Capability       string   `json:"capability" binding:"required"`
	RiskLevel        int      `json:"risk_level"`
	RequiresApproval bool     `json:"requires_approval"`
	RoleIDs          []string `json:"role_ids"`
}

type UpdateCommandPermissionRequest struct {
	Description      *string   `json:"description"`
	Capability       *string   `json:"capability"`
	RiskLevel        *int      `json:"risk_level"`
	RequiresApproval *bool     `json:"requires_approval"`
	RoleIDs          *[]string `json:"role_ids"`
}

// --- Environment Permission ---

type EnvironmentPermission struct {
	ID              string `json:"id" db:"id"`
	TenantID        string `json:"tenant_id" db:"tenant_id"`
	Environment     string `json:"environment" db:"environment"`
	Description     string `json:"description" db:"description"`
	RateLimit       int    `json:"rate_limit" db:"rate_limit"`
	RequireApproval bool   `json:"require_approval" db:"require_approval"`
	AllowedCommands string `json:"allowed_commands" db:"allowed_commands"`
	DeniedCommands  string `json:"denied_commands" db:"denied_commands"`
	RoleIDs         string `json:"role_ids" db:"role_ids"`
}

type CreateEnvironmentPermissionRequest struct {
	Environment     string   `json:"environment" binding:"required"`
	Description     string   `json:"description"`
	RateLimit       int      `json:"rate_limit"`
	RequireApproval bool     `json:"require_approval"`
	AllowedCommands []string `json:"allowed_commands"`
	DeniedCommands  []string `json:"denied_commands"`
	RoleIDs         []string `json:"role_ids"`
}

type UpdateEnvironmentPermissionRequest struct {
	Description     *string   `json:"description"`
	RateLimit       *int      `json:"rate_limit"`
	RequireApproval *bool     `json:"require_approval"`
	AllowedCommands *[]string `json:"allowed_commands"`
	DeniedCommands  *[]string `json:"denied_commands"`
	RoleIDs         *[]string `json:"role_ids"`
}

// --- Command Version ---

type CommandVersion struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	CommandID   string    `json:"command_id" db:"command_id"`
	CommandText string    `json:"command_text" db:"command_text"`
	Parameters  string    `json:"parameters" db:"parameters"`
	Description string    `json:"description" db:"description"`
	Changelog   string    `json:"changelog" db:"changelog"`
	CreatedBy   string    `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

type CreateCommandVersionRequest struct {
	CommandID   string                 `json:"command_id" binding:"required"`
	CommandText string                 `json:"command_text" binding:"required"`
	Parameters  map[string]interface{} `json:"parameters"`
	Description string                 `json:"description"`
	Changelog   string                 `json:"changelog"`
	CreatedBy   string                 `json:"created_by"`
}

type AddTagRequest struct {
	TagName string `json:"tag_name" binding:"required"`
}

type CommandVersionResult struct {
	Versions []CommandVersion `json:"versions"`
	Total    int              `json:"total"`
}

// --- Rate Limit ---

type RateLimit struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	TargetType    string    `json:"target_type" db:"target_type"`
	TargetID      string    `json:"target_id" db:"target_id"`
	CommandName   string    `json:"command_name" db:"command_name"`
	LimitType     string    `json:"limit_type" db:"limit_type"`
	LimitCount    int       `json:"limit_count" db:"limit_count"`
	WindowSeconds int       `json:"window_seconds" db:"window_seconds"`
	Description   string    `json:"description" db:"description"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

type CreateRateLimitRequest struct {
	TargetType    string `json:"target_type" binding:"required"`
	TargetID      string `json:"target_id"`
	CommandName   string `json:"command_name"`
	LimitType     string `json:"limit_type" binding:"required"`
	LimitCount    int    `json:"limit_count" binding:"required"`
	WindowSeconds int    `json:"window_seconds" binding:"required"`
	Description   string `json:"description"`
}

// --- Webhook ---

type Webhook struct {
	ID             string    `json:"id" db:"id"`
	TenantID       string    `json:"tenant_id" db:"tenant_id"`
	Name           string    `json:"name" db:"name"`
	URL            string    `json:"url" db:"url"`
	Events         string    `json:"events" db:"events"`
	SecretKey      string    `json:"secret_key" db:"secret_key"`
	Enabled        bool      `json:"enabled" db:"enabled"`
	RetryCount     int       `json:"retry_count" db:"retry_count"`
	TimeoutSeconds int       `json:"timeout_seconds" db:"timeout_seconds"`
	Headers        string    `json:"headers" db:"headers"`
	Description    string    `json:"description" db:"description"`
	CreatedBy      string    `json:"created_by" db:"created_by"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type CreateWebhookRequest struct {
	Name           string            `json:"name" binding:"required"`
	URL            string            `json:"url" binding:"required"`
	Events         []string          `json:"events" binding:"required"`
	SecretKey      string            `json:"secret_key"`
	Enabled        bool              `json:"enabled"`
	RetryCount     int               `json:"retry_count"`
	TimeoutSeconds int               `json:"timeout_seconds"`
	Headers        map[string]string `json:"headers"`
	Description    string            `json:"description"`
	CreatedBy      string            `json:"created_by"`
}

type TestWebhookResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// --- Dashboard Stats ---

type DashboardStatsRequest struct {
	Range     string `json:"range"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
}

type DashboardStatsResult struct {
	TotalCommands   int                      `json:"total_commands"`
	TotalExecutions int                      `json:"total_executions"`
	SuccessRate     float64                  `json:"success_rate"`
	TopCommands     []map[string]interface{} `json:"top_commands"`
	ActiveUsers     int                      `json:"active_users"`
}

// --- Health Check ---

type HealthCheckResult struct {
	Success       bool                   `json:"success"`
	EventBus      map[string]interface{} `json:"event_bus"`
	SSE           map[string]interface{} `json:"sse"`
	Subscriptions map[string]interface{} `json:"subscriptions"`
	Metrics       map[string]interface{} `json:"metrics"`
}

// --- Knowledge Recommendation ---

type KnowledgeRecommendation struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Context     string `json:"context"`
	Description string `json:"description"`
}

// --- User Allowed Commands ---

type AllowedCommandsResult struct {
	UserID   string   `json:"user_id"`
	Commands []string `json:"commands"`
}

// --- Message (Webhook receive) ---

type ReceiveMessageRequest struct {
	Text        string `json:"text"`
	Message     string `json:"message"`
	Platform    string `json:"platform"`
	Channel     string `json:"channel"`
	Environment string `json:"environment"`
}

// --- Recommendation ---

type RecommendationContext struct {
	CurrentPage string `json:"current_page"`
	ResourceID  string `json:"resource_id"`
}

type GetRecommendationsRequest struct {
	Context RecommendationContext `json:"context"`
}

// --- Pagination helpers ---

type PaginationResult struct {
	Data  []interface{} `json:"data"`
	Total int           `json:"total"`
}
