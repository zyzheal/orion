package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/chatops/models"
	"orion/platform-svc-go/internal/chatops/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	// --- Commands ---
	CreateCommand(ctx context.Context, tenantID string, req models.CreateCommandRequest) (*models.ChatOpsCommand, error)
	GetCommand(ctx context.Context, tenantID, id string) (*models.ChatOpsCommand, error)
	ListCommands(ctx context.Context, tenantID string, permissionLevel, name *string, limit, offset int) ([]models.ChatOpsCommand, error)
	UpdateCommand(ctx context.Context, tenantID, id string, req models.UpdateCommandRequest) (*models.ChatOpsCommand, error)
	DeleteCommand(ctx context.Context, tenantID, id string) error
	GetCommandHelp(ctx context.Context, tenantID, name string) (*models.ChatOpsCommand, error)

	// --- Execution ---
	ExecuteCommand(ctx context.Context, tenantID, userID string, req models.ExecuteCommandRequest) (*models.Execution, error)
	GetExecutionStatus(ctx context.Context, tenantID, id string) (*models.Execution, error)
	ListExecutions(ctx context.Context, tenantID string, commandID, userID, status *string, limit, offset int) ([]models.Execution, error)

	// --- Recommendations ---
	GetRecommendations(ctx context.Context, tenantID, userID, currentPage, resourceID string) ([]map[string]interface{}, error)

	// --- Knowledge / Sessions ---
	GetKnowledgeRecommendations(ctx context.Context, tenantID string, context string, limit int) ([]models.KnowledgeRecommendation, error)
	GetSessionMessages(ctx context.Context, tenantID, sessionID string, limit int, cursor *string) ([]models.ChatOpsMessage, error)
	GetAllCommandVersions(ctx context.Context, tenantID string, page, perPage int) (models.CommandVersionResult, error)
	GetUserAllowedCommands(ctx context.Context, tenantID, userID string) ([]string, error)

	// --- Notifications ---
	GetNotificationPreference(ctx context.Context, tenantID, userID string) (*models.NotificationPreference, error)
	UpdateNotificationPreference(ctx context.Context, tenantID, userID string, req models.UpdateNotificationPreferenceRequest) (*models.NotificationPreference, error)

	// --- DND ---
	GetDNDSettings(ctx context.Context, tenantID, userID string) (*models.DNDSettings, error)
	UpdateDNDSettings(ctx context.Context, tenantID, userID string, req models.UpdateDNDRequest) (*models.DNDSettings, error)
	ToggleDND(ctx context.Context, tenantID, userID string, enabled bool) (*models.DNDSettings, error)

	// --- Platform Config ---
	GetPlatformConfigs(ctx context.Context, tenantID, userID string) ([]models.PlatformConfig, error)
	UpdatePlatformConfigs(ctx context.Context, tenantID, userID string, req models.UpdatePlatformConfigRequest) ([]models.PlatformConfig, error)

	// --- Alert States ---
	GetAlertStates(ctx context.Context, tenantID, userID string) ([]models.AlertState, error)
	MarkAlertRead(ctx context.Context, tenantID, userID, alertID string) error
	MarkAlertAcknowledged(ctx context.Context, tenantID, userID, alertID string) error
	MarkAlertDismissed(ctx context.Context, tenantID, userID, alertID string) error

	// --- Question / Command Configs ---
	GetQuestionConfigs(ctx context.Context, tenantID, userID string) ([]models.QuestionConfig, error)
	UpdateQuestionConfigs(ctx context.Context, tenantID, userID string, req models.UpdateQuestionConfigsRequest) ([]models.QuestionConfig, error)
	GetCommandConfigs(ctx context.Context, tenantID, userID string) ([]models.CommandConfig, error)
	UpdateCommandConfigs(ctx context.Context, tenantID, userID string, req models.UpdateCommandConfigsRequest) ([]models.CommandConfig, error)

	// --- Audit ---
	ListAuditLogs(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, error)
	GetAuditStats(ctx context.Context, tenantID string) (map[string]interface{}, error)
	ExportAuditLogs(ctx context.Context, tenantID string, q models.AuditLogQuery) (map[string]interface{}, error)

	// --- Dashboard ---
	GetDashboardStats(ctx context.Context, tenantID string, req models.DashboardStatsRequest) (*models.DashboardStatsResult, error)

	// --- Health ---
	HealthCheck(ctx context.Context) (*models.HealthCheckResult, error)

	// --- Receive Message ---
	ReceiveMessage(ctx context.Context, tenantID, userID string, req models.ReceiveMessageRequest) (map[string]interface{}, error)

	// --- Capability Mappings ---
	GetAllCapabilityMappings(ctx context.Context, tenantID string, environment *string) ([]models.CapabilityMapping, error)
	CreateCapabilityMapping(ctx context.Context, tenantID string, req models.CreateCapabilityMappingRequest) (*models.CapabilityMapping, error)
	UpdateCapabilityMapping(ctx context.Context, tenantID, id string, req models.UpdateCapabilityMappingRequest) (*models.CapabilityMapping, error)
	DeleteCapabilityMapping(ctx context.Context, tenantID, id string) error

	// --- Approval Configs ---
	GetAllApprovalConfigs(ctx context.Context, tenantID string) ([]models.ApprovalConfig, error)
	UpdateApprovalConfigs(ctx context.Context, tenantID string, req models.UpdateApprovalConfigsRequest) ([]models.ApprovalConfig, error)
	GetApprovalConfigByCapability(ctx context.Context, tenantID, capability string) (*models.ApprovalConfig, error)
	UpdateApprovalConfig(ctx context.Context, tenantID, capability string, req models.UpdateApprovalConfigRequest) (*models.ApprovalConfig, error)

	// --- Approvers ---
	GetApprovers(ctx context.Context, tenantID string) ([]models.Approver, error)
	GetApproverSchedule(ctx context.Context, tenantID string) ([]models.ApproverSchedule, error)
	UpdateApproverSchedule(ctx context.Context, tenantID string, schedule []models.ApproverSchedule) error

	// --- Global Approval Config ---
	GetGlobalApprovalConfig(ctx context.Context, tenantID string) (*models.GlobalApprovalConfig, error)
	UpdateGlobalApprovalConfig(ctx context.Context, tenantID string, config *models.GlobalApprovalConfig) error

	// --- Roles ---
	GetAllRoles(ctx context.Context, tenantID string) ([]models.PermissionRole, error)
	CreateRole(ctx context.Context, tenantID string, req models.CreateRoleRequest) (*models.PermissionRole, error)
	GetRole(ctx context.Context, tenantID, id string) (*models.PermissionRole, error)
	UpdateRole(ctx context.Context, tenantID, id string, req models.UpdateRoleRequest) (*models.PermissionRole, error)
	DeleteRole(ctx context.Context, tenantID, id string) error

	// --- Command Permissions ---
	GetAllCommandPermissions(ctx context.Context, tenantID string) ([]models.CommandPermission, error)
	CreateCommandPermission(ctx context.Context, tenantID string, req models.CreateCommandPermissionRequest) (*models.CommandPermission, error)
	UpdateCommandPermission(ctx context.Context, tenantID, id string, req models.UpdateCommandPermissionRequest) (*models.CommandPermission, error)
	DeleteCommandPermission(ctx context.Context, tenantID, id string) error

	// --- Environment Permissions ---
	GetAllEnvironmentPermissions(ctx context.Context, tenantID string) ([]models.EnvironmentPermission, error)
	CreateEnvironmentPermission(ctx context.Context, tenantID string, req models.CreateEnvironmentPermissionRequest) (*models.EnvironmentPermission, error)
	UpdateEnvironmentPermission(ctx context.Context, tenantID, id string, req models.UpdateEnvironmentPermissionRequest) (*models.EnvironmentPermission, error)
	DeleteEnvironmentPermission(ctx context.Context, tenantID, id string) error

	// --- Command Versions ---
	GetVersionsByCommand(ctx context.Context, tenantID, commandID string) ([]models.CommandVersion, error)
	CreateCommandVersion(ctx context.Context, tenantID string, req models.CreateCommandVersionRequest) (*models.CommandVersion, error)
	AddTag(ctx context.Context, tenantID, versionID, tagName, createdBy string) error
	RemoveTag(ctx context.Context, tenantID, versionID, tagName string) error
	DeleteCommandVersion(ctx context.Context, tenantID, id string) error

	// --- Rate Limits ---
	GetAllRateLimits(ctx context.Context, tenantID string) ([]models.RateLimit, error)
	CreateRateLimit(ctx context.Context, tenantID string, req models.CreateRateLimitRequest) (*models.RateLimit, error)
	UpdateRateLimit(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.RateLimit, error)
	DeleteRateLimit(ctx context.Context, tenantID, id string) error

	// --- Webhooks ---
	GetAllWebhooks(ctx context.Context, tenantID string) ([]models.Webhook, error)
	CreateWebhook(ctx context.Context, tenantID string, req models.CreateWebhookRequest) (*models.Webhook, error)
	UpdateWebhook(ctx context.Context, tenantID, id string, body map[string]interface{}) (*models.Webhook, error)
	DeleteWebhook(ctx context.Context, tenantID, id string) error
	TestWebhook(ctx context.Context, tenantID, id string) (*models.TestWebhookResult, error)
	GetWebhookLogs(ctx context.Context, tenantID, webhookID string, limit int) ([]map[string]interface{}, error)
}

// Handler wires Gin routes to the ChatOps service.
type Handler struct {
	svc Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all ChatOps endpoints under the given group.
// Mirrors /api/v1/chatops routes from the TS source (~75 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	c := rg.Group("/chatops")

	// ---- Commands ----
	// GET /commands - List available ChatOps commands
	c.GET("/commands", auth.RequirePermission("chatops", "read"), h.ListCommands)
	// GET /commands/:name/help - Get help for a specific command
	c.GET("/commands/:name/help", auth.RequirePermission("chatops", "read"), h.GetCommandHelp)

	// ---- Execution ----
	// POST /execute - Execute a ChatOps command
	c.POST("/execute", auth.RequirePermission("chatops", "write"), h.ExecuteCommand)
	// GET /status/:commandId - Get execution status
	c.GET("/status/:commandId", auth.RequirePermission("chatops", "read"), h.GetExecutionStatus)
	// GET /executions - List command executions
	c.GET("/executions", auth.RequirePermission("chatops", "read"), h.ListExecutions)

	// ---- Webhook Message ----
	// POST /message - Receive webhook message from IM platform
	c.POST("/message", auth.RequirePermission("chatops", "write"), h.ReceiveMessage)

	// ---- Recommendations ----
	// POST /recommendations - Get AI-powered command recommendations
	c.POST("/recommendations", auth.RequirePermission("chatops", "write"), h.GetRecommendations)

	// ---- Knowledge Recommendations ----
	// GET /knowledge - Get knowledge base recommendations
	c.GET("/knowledge", auth.RequirePermission("chatops", "read"), h.GetKnowledgeRecommendations)

	// ---- Sessions / Messages ----
	// GET /sessions/:id/messages - Get messages for a session
	c.GET("/sessions/:id/messages", auth.RequirePermission("chatops", "read"), h.GetSessionMessages)

	// ---- SSE Stream ----
	// GET /stream/recommendations - SSE stream for real-time recommendations
	c.GET("/stream/recommendations", auth.RequirePermission("chatops", "read"), h.StreamRecommendations)

	// ---- Notification Preferences ----
	// GET /settings/notification-preferences
	c.GET("/settings/notification-preferences", auth.RequirePermission("chatops", "read"), h.GetNotificationPreferences)
	// PUT /settings/notification-preferences
	c.PUT("/settings/notification-preferences", auth.RequirePermission("chatops", "write"), h.UpdateNotificationPreferences)

	// ---- DND Settings ----
	// GET /settings/dnd
	c.GET("/settings/dnd", auth.RequirePermission("chatops", "read"), h.GetDNDSettings)
	// PUT /settings/dnd
	c.PUT("/settings/dnd", auth.RequirePermission("chatops", "write"), h.UpdateDNDSettings)
	// PATCH /settings/dnd/toggle
	c.PATCH("/settings/dnd/toggle", auth.RequirePermission("chatops", "write"), h.ToggleDND)

	// ---- Platform Config ----
	// GET /settings/platforms
	c.GET("/settings/platforms", auth.RequirePermission("chatops", "read"), h.GetPlatformConfigs)
	// PUT /settings/platforms
	c.PUT("/settings/platforms", auth.RequirePermission("chatops", "write"), h.UpdatePlatformConfigs)

	// ---- Alert States ----
	// GET /alerts/states
	c.GET("/alerts/states", auth.RequirePermission("chatops", "read"), h.GetAlertStates)
	// POST /alerts/:id/read - Mark alert as read
	c.POST("/alerts/:id/read", auth.RequirePermission("chatops", "write"), h.MarkAlertRead)
	// POST /alerts/:id/acknowledge - Acknowledge alert
	c.POST("/alerts/:id/acknowledge", auth.RequirePermission("chatops", "write"), h.MarkAlertAcknowledged)
	// POST /alerts/:id/dismiss - Dismiss alert
	c.POST("/alerts/:id/dismiss", auth.RequirePermission("chatops", "write"), h.MarkAlertDismissed)

	// ---- Dashboard Stats ----
	// GET /dashboard/stats
	c.GET("/dashboard/stats", auth.RequirePermission("chatops", "read"), h.GetDashboardStats)

	// ---- Health Check ----
	// GET /health - ChatOps service health check
	c.GET("/health", h.HealthCheck)

	// ---- Audit ----
	// GET /audit/logs
	c.GET("/audit/logs", auth.RequirePermission("chatops", "read"), h.GetAuditLogs)
	// GET /audit/stats
	c.GET("/audit/stats", auth.RequirePermission("chatops", "read"), h.GetAuditStats)
	// POST /audit/export
	c.POST("/audit/export", auth.RequirePermission("chatops", "write"), h.ExportAuditLogs)

	// ---- Permission Check ----
	// GET /permissions/allowed-commands
	c.GET("/permissions/allowed-commands", h.GetAllowedCommands)

	// ---- Admin: Capability Mappings ----
	// GET /admin/capability-mappings
	c.GET("/admin/capability-mappings", auth.RequirePermission("chatops", "admin"), h.GetAllCapabilityMappings)
	// POST /admin/capability-mappings
	c.POST("/admin/capability-mappings", auth.RequirePermission("chatops", "admin"), h.CreateCapabilityMapping)
	// PUT /admin/capability-mappings/:id
	c.PUT("/admin/capability-mappings/:id", auth.RequirePermission("chatops", "admin"), h.UpdateCapabilityMapping)
	// DELETE /admin/capability-mappings/:id
	c.DELETE("/admin/capability-mappings/:id", auth.RequirePermission("chatops", "admin"), h.DeleteCapabilityMapping)

	// ---- Admin: Approval Configs ----
	// GET /admin/approval-configs
	c.GET("/admin/approval-configs", auth.RequirePermission("chatops", "admin"), h.GetAllApprovalConfigs)
	// PUT /admin/approval-configs
	c.PUT("/admin/approval-configs", auth.RequirePermission("chatops", "admin"), h.UpdateApprovalConfigs)
	// GET /admin/approval-configs/:capability
	c.GET("/admin/approval-configs/:capability", auth.RequirePermission("chatops", "admin"), h.GetApprovalConfigByCapability)
	// PUT /admin/approval-configs/:capability
	c.PUT("/admin/approval-configs/:capability", auth.RequirePermission("chatops", "admin"), h.UpdateApprovalConfig)

	// ---- Admin: Approvers ----
	// GET /admin/approvers
	c.GET("/admin/approvers", auth.RequirePermission("chatops", "admin"), h.GetApprovers)
	// GET /admin/approvers/schedule
	c.GET("/admin/approvers/schedule", auth.RequirePermission("chatops", "admin"), h.GetApproverSchedule)
	// PUT /admin/approvers/schedule
	c.PUT("/admin/approvers/schedule", auth.RequirePermission("chatops", "admin"), h.UpdateApproverSchedule)

	// ---- Admin: Global Approval Config ----
	// GET /admin/approval-global-config
	c.GET("/admin/approval-global-config", auth.RequirePermission("chatops", "admin"), h.GetGlobalApprovalConfig)
	// PUT /admin/approval-global-config
	c.PUT("/admin/approval-global-config", auth.RequirePermission("chatops", "admin"), h.UpdateGlobalApprovalConfig)

	// ---- Admin: Roles ----
	// GET /admin/roles
	c.GET("/admin/roles", auth.RequirePermission("chatops", "admin"), h.GetAllRoles)
	// POST /admin/roles
	c.POST("/admin/roles", auth.RequirePermission("chatops", "admin"), h.CreateRole)
	// PUT /admin/roles/:id
	c.PUT("/admin/roles/:id", auth.RequirePermission("chatops", "admin"), h.UpdateRole)
	// DELETE /admin/roles/:id
	c.DELETE("/admin/roles/:id", auth.RequirePermission("chatops", "admin"), h.DeleteRole)

	// ---- Admin: Command Permissions ----
	// GET /admin/command-permissions
	c.GET("/admin/command-permissions", auth.RequirePermission("chatops", "admin"), h.GetAllCommandPermissions)
	// POST /admin/command-permissions
	c.POST("/admin/command-permissions", auth.RequirePermission("chatops", "admin"), h.CreateCommandPermission)
	// PUT /admin/command-permissions/:id
	c.PUT("/admin/command-permissions/:id", auth.RequirePermission("chatops", "admin"), h.UpdateCommandPermission)
	// DELETE /admin/command-permissions/:id
	c.DELETE("/admin/command-permissions/:id", auth.RequirePermission("chatops", "admin"), h.DeleteCommandPermission)

	// ---- Admin: Environment Permissions ----
	// GET /admin/environment-permissions
	c.GET("/admin/environment-permissions", auth.RequirePermission("chatops", "admin"), h.GetAllEnvironmentPermissions)
	// POST /admin/environment-permissions
	c.POST("/admin/environment-permissions", auth.RequirePermission("chatops", "admin"), h.CreateEnvironmentPermission)
	// PUT /admin/environment-permissions/:id
	c.PUT("/admin/environment-permissions/:id", auth.RequirePermission("chatops", "admin"), h.UpdateEnvironmentPermission)
	// DELETE /admin/environment-permissions/:id
	c.DELETE("/admin/environment-permissions/:id", auth.RequirePermission("chatops", "admin"), h.DeleteEnvironmentPermission)

	// ---- Admin: Command Versions ----
	// GET /admin/command-versions
	c.GET("/admin/command-versions", auth.RequirePermission("chatops", "admin"), h.GetAllCommandVersions)
	// GET /admin/command-versions/:commandId
	c.GET("/admin/command-versions/:commandId", auth.RequirePermission("chatops", "admin"), h.GetVersionsByCommand)
	// POST /admin/command-versions
	c.POST("/admin/command-versions", auth.RequirePermission("chatops", "admin"), h.CreateCommandVersion)
	// POST /admin/command-versions/:commandId/rollback/:version
	c.POST("/admin/command-versions/:commandId/rollback/:version", auth.RequirePermission("chatops", "admin"), h.RollbackCommandVersion)
	// POST /admin/command-versions/:versionId/tags
	c.POST("/admin/command-versions/:versionId/tags", auth.RequirePermission("chatops", "admin"), h.AddVersionTag)
	// DELETE /admin/command-versions/:versionId/tags/:tagName
	c.DELETE("/admin/command-versions/:versionId/tags/:tagName", auth.RequirePermission("chatops", "admin"), h.RemoveVersionTag)
	// DELETE /admin/command-versions/:id
	c.DELETE("/admin/command-versions/:id", auth.RequirePermission("chatops", "admin"), h.DeleteCommandVersion)

	// ---- Admin: Rate Limits ----
	// GET /admin/rate-limits
	c.GET("/admin/rate-limits", auth.RequirePermission("chatops", "admin"), h.GetAllRateLimits)
	// POST /admin/rate-limits
	c.POST("/admin/rate-limits", auth.RequirePermission("chatops", "admin"), h.CreateRateLimit)
	// PUT /admin/rate-limits/:id
	c.PUT("/admin/rate-limits/:id", auth.RequirePermission("chatops", "admin"), h.UpdateRateLimit)
	// DELETE /admin/rate-limits/:id
	c.DELETE("/admin/rate-limits/:id", auth.RequirePermission("chatops", "admin"), h.DeleteRateLimit)

	// ---- Admin: Webhooks ----
	// GET /admin/webhooks
	c.GET("/admin/webhooks", auth.RequirePermission("chatops", "admin"), h.GetAllWebhooks)
	// POST /admin/webhooks
	c.POST("/admin/webhooks", auth.RequirePermission("chatops", "admin"), h.CreateWebhook)
	// PUT /admin/webhooks/:id
	c.PUT("/admin/webhooks/:id", auth.RequirePermission("chatops", "admin"), h.UpdateWebhook)
	// DELETE /admin/webhooks/:id
	c.DELETE("/admin/webhooks/:id", auth.RequirePermission("chatops", "admin"), h.DeleteWebhook)
	// POST /admin/webhooks/:id/test
	c.POST("/admin/webhooks/:id/test", auth.RequirePermission("chatops", "admin"), h.TestWebhook)
	// GET /admin/webhooks/:id/logs
	c.GET("/admin/webhooks/:id/logs", auth.RequirePermission("chatops", "admin"), h.GetWebhookLogs)

	// ---- Chat Config ----
	// GET /settings/questions
	c.GET("/settings/questions", auth.RequirePermission("chatops", "read"), h.GetQuestionConfigs)
	// PUT /settings/questions
	c.PUT("/settings/questions", auth.RequirePermission("chatops", "write"), h.UpdateQuestionConfigs)
	// GET /settings/commands
	c.GET("/settings/commands", auth.RequirePermission("chatops", "read"), h.GetCommandConfigs)
	// PUT /settings/commands
	c.PUT("/settings/commands", auth.RequirePermission("chatops", "write"), h.UpdateCommandConfigs)
}

