package repository

import (
	"context"
	"orion/platform-svc-go/internal/chatops/models"
)


// RepositoryInterface defines the data access contract for the chatops module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateCommand(ctx context.Context, m *models.ChatOpsCommand) error
	GetCommand(ctx context.Context, tenantID, id string) (*models.ChatOpsCommand, error)
	ListCommands(ctx context.Context, tenantID string, permissionLevel, name *string, limit, offset int) ([]models.ChatOpsCommand, error)
	UpdateCommand(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteCommand(ctx context.Context, tenantID, id string) error
	CreateExecution(ctx context.Context, m *models.Execution) error
	GetExecution(ctx context.Context, tenantID, id string) (*models.Execution, error)
	UpdateExecutionStatus(ctx context.Context, tenantID, id, status string) error
	ListExecutions(ctx context.Context, tenantID string, commandID, userID, status *string, limit, offset int) ([]models.Execution, error)
	CreateAuditLog(ctx context.Context, m *models.AuditLog) error
	ListAuditLogs(ctx context.Context, tenantID string, q *models.AuditLogQuery) ([]models.AuditLog, error)
	AuditLogStats(ctx context.Context, tenantID string) (map[string]interface{}, error)
	GetNotificationPreference(ctx context.Context, tenantID, userID string) (*models.NotificationPreference, error)
	UpsertNotificationPreference(ctx context.Context, m *models.NotificationPreference) error
	GetDNDSettings(ctx context.Context, tenantID, userID string) (*models.DNDSettings, error)
	UpsertDNDSettings(ctx context.Context, m *models.DNDSettings) error
	GetPlatformConfigs(ctx context.Context, tenantID, userID string) ([]models.PlatformConfig, error)
	UpsertPlatformConfigs(ctx context.Context, tenantID, userID string, configs []models.PlatformConfig) error
	GetAlertStates(ctx context.Context, tenantID, userID string) ([]models.AlertState, error)
	UpdateAlertState(ctx context.Context, tenantID, userID, alertID, status string) error
	GetQuestionConfigs(ctx context.Context, tenantID, userID string) ([]models.QuestionConfig, error)
	UpsertQuestionConfigs(ctx context.Context, tenantID, userID string, configs []models.QuestionConfig) error
	GetCommandConfigs(ctx context.Context, tenantID, userID string) ([]models.CommandConfig, error)
	UpsertCommandConfigs(ctx context.Context, tenantID, userID string, configs []models.CommandConfig) error
	GetAllCapabilityMappings(ctx context.Context, tenantID string, environment *string) ([]models.CapabilityMapping, error)
	CreateCapabilityMapping(ctx context.Context, m *models.CapabilityMapping) error
	GetCapabilityMapping(ctx context.Context, tenantID, id string) (*models.CapabilityMapping, error)
	UpdateCapabilityMapping(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteCapabilityMapping(ctx context.Context, tenantID, id string) error
	GetAllApprovalConfigs(ctx context.Context, tenantID string) ([]models.ApprovalConfig, error)
	GetApprovalConfigByCapability(ctx context.Context, tenantID, capability string) (*models.ApprovalConfig, error)
	UpsertApprovalConfig(ctx context.Context, tenantID, capability string, enabled *bool, approvers *string, threshold *int) error
	BatchUpdateApprovalConfigs(ctx context.Context, tenantID string, configs []models.ApprovalConfig) error
	GetApprovers(ctx context.Context, tenantID string) ([]models.Approver, error)
	GetApproverSchedule(ctx context.Context, tenantID string) ([]models.ApproverSchedule, error)
	UpdateApproverSchedule(ctx context.Context, tenantID string, schedule []models.ApproverSchedule) error
	GetGlobalApprovalConfig(ctx context.Context, tenantID string) (*models.GlobalApprovalConfig, error)
	UpsertGlobalApprovalConfig(ctx context.Context, tenantID string, config *models.GlobalApprovalConfig) error
	GetAllRoles(ctx context.Context, tenantID string) ([]models.PermissionRole, error)
	CreateRole(ctx context.Context, m *models.PermissionRole) error
	GetRole(ctx context.Context, tenantID, id string) (*models.PermissionRole, error)
	UpdateRole(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteRole(ctx context.Context, tenantID, id string) error
	GetAllCommandPermissions(ctx context.Context, tenantID string) ([]models.CommandPermission, error)
	CreateCommandPermission(ctx context.Context, m *models.CommandPermission) error
	GetCommandPermission(ctx context.Context, tenantID, id string) (*models.CommandPermission, error)
	UpdateCommandPermission(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteCommandPermission(ctx context.Context, tenantID, id string) error
	GetAllEnvironmentPermissions(ctx context.Context, tenantID string) ([]models.EnvironmentPermission, error)
	CreateEnvironmentPermission(ctx context.Context, m *models.EnvironmentPermission) error
	GetEnvironmentPermission(ctx context.Context, tenantID, id string) (*models.EnvironmentPermission, error)
	UpdateEnvironmentPermission(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteEnvironmentPermission(ctx context.Context, tenantID, id string) error
	GetAllCommandVersions(ctx context.Context, tenantID string, limit, offset int) ([]models.CommandVersion, int, error)
	GetVersionsByCommand(ctx context.Context, tenantID, commandID string) ([]models.CommandVersion, error)
	CreateCommandVersion(ctx context.Context, m *models.CommandVersion) error
	AddTag(ctx context.Context, tenantID, versionID, tagName, createdBy string) error
	RemoveTag(ctx context.Context, tenantID, versionID, tagName string) error
	GetCommandVersion(ctx context.Context, tenantID, id string) (*models.CommandVersion, error)
	DeleteCommandVersion(ctx context.Context, tenantID, id string) error
	GetAllRateLimits(ctx context.Context, tenantID string) ([]models.RateLimit, error)
	CreateRateLimit(ctx context.Context, m *models.RateLimit) error
	GetRateLimit(ctx context.Context, tenantID, id string) (*models.RateLimit, error)
	UpdateRateLimit(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteRateLimit(ctx context.Context, tenantID, id string) error
	GetAllWebhooks(ctx context.Context, tenantID string) ([]models.Webhook, error)
	CreateWebhook(ctx context.Context, m *models.Webhook) error
	GetWebhook(ctx context.Context, tenantID, id string) (*models.Webhook, error)
	UpdateWebhook(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	DeleteWebhook(ctx context.Context, tenantID, id string) error
	GetWebhookLogs(ctx context.Context, tenantID, webhookID string, limit int) ([]map[string]interface{}, error)
	TestWebhook(ctx context.Context, tenantID, webhookID string) (*models.TestWebhookResult, error)
	GetDashboardStats(ctx context.Context, tenantID string, days int) (*models.DashboardStatsResult, error)
	GetUserAllowedCommands(ctx context.Context, tenantID, userID string) ([]string, error)
	HealthCheck(ctx context.Context) (*models.HealthCheckResult, error)
	GetKnowledgeRecommendations(ctx context.Context, tenantID string, context string, limit int) ([]models.KnowledgeRecommendation, error)
	CreateMessage(ctx context.Context, m *models.ChatOpsMessage) error
	GetSessionMessages(ctx context.Context, tenantID, sessionID string, limit int, cursor *string) ([]models.ChatOpsMessage, error)
	CreateSession(ctx context.Context, tenantID, userID string) (*models.ChatOpsSession, error)
	GetRecommendations(ctx context.Context, tenantID, userID string, currentPage, resourceID string) ([]map[string]interface{}, error)
	ExportAuditLogs(ctx context.Context, tenantID string, q *models.AuditLogQuery) ([]models.AuditLog, error)
	GetUserPermissionRequests(ctx context.Context, tenantID, userID string) ([]map[string]interface{}, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
