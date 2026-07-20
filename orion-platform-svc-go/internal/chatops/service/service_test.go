package service

import (
	"context"
	"database/sql"
	"testing"

	"orion/platform-svc-go/internal/chatops/models"
)

type mockChatOpsRepo struct {
	commands map[string]*models.ChatOpsCommand
	dbErr    error
}

func newMockChatOpsRepo() *mockChatOpsRepo {
	return &mockChatOpsRepo{commands: map[string]*models.ChatOpsCommand{}}
}

// --- Commands ---

func (m *mockChatOpsRepo) CreateCommand(_ context.Context, cmd *models.ChatOpsCommand) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	if cmd.ID == "" {
		cmd.ID = cmd.TenantID + ":" + cmd.Name
	}
	m.commands[cmd.TenantID+":"+cmd.ID] = cmd
	return nil
}

func (m *mockChatOpsRepo) GetCommand(_ context.Context, tenantID, id string) (*models.ChatOpsCommand, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	c, ok := m.commands[tenantID+":"+id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return c, nil
}

func (m *mockChatOpsRepo) ListCommands(_ context.Context, tenantID string, permLevel, name *string, _limit, _offset int) ([]models.ChatOpsCommand, error) {
	var out []models.ChatOpsCommand
	for _, c := range m.commands {
		if c.TenantID == tenantID {
			out = append(out, *c)
		}
	}
	return out, nil
}

func (m *mockChatOpsRepo) UpdateCommand(_ context.Context, tenantID, id string, updates map[string]interface{}) error {
	c, ok := m.commands[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	if v, ok := updates["name"]; ok {
		c.Name = v.(string)
	}
	if v, ok := updates["description"]; ok {
		c.Description = v.(string)
	}
	return nil
}

func (m *mockChatOpsRepo) DeleteCommand(_ context.Context, tenantID, id string) error {
	_, ok := m.commands[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	delete(m.commands, tenantID+":"+id)
	return nil
}

// --- Executions (stub) ---

func (m *mockChatOpsRepo) CreateExecution(_ context.Context, m2 *models.Execution) error { return nil }
func (m *mockChatOpsRepo) GetExecution(_ context.Context, tenantID, id string) (*models.Execution, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpdateExecutionStatus(_ context.Context, tenantID, id, status string) error {
	return nil
}
func (m *mockChatOpsRepo) ListExecutions(_ context.Context, tenantID string, commandID, userID, status *string, limit, offset int) ([]models.Execution, error) {
	return nil, nil
}

// --- Audit Logs (stub) ---

func (m *mockChatOpsRepo) CreateAuditLog(_ context.Context, m2 *models.AuditLog) error { return nil }
func (m *mockChatOpsRepo) ListAuditLogs(_ context.Context, tenantID string, q *models.AuditLogQuery) ([]models.AuditLog, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) AuditLogStats(_ context.Context, tenantID string) (map[string]interface{}, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) ExportAuditLogs(_ context.Context, tenantID string, q *models.AuditLogQuery) ([]models.AuditLog, error) {
	return nil, nil
}

// --- Notification Preferences (stub) ---

func (m *mockChatOpsRepo) GetNotificationPreference(_ context.Context, tenantID, userID string) (*models.NotificationPreference, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpsertNotificationPreference(_ context.Context, m2 *models.NotificationPreference) error {
	return nil
}

// --- DND Settings (stub) ---

func (m *mockChatOpsRepo) GetDNDSettings(_ context.Context, tenantID, userID string) (*models.DNDSettings, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpsertDNDSettings(_ context.Context, m2 *models.DNDSettings) error {
	return nil
}

// --- Platform Configs (stub) ---

func (m *mockChatOpsRepo) GetPlatformConfigs(_ context.Context, tenantID, userID string) ([]models.PlatformConfig, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpsertPlatformConfigs(_ context.Context, tenantID, userID string, configs []models.PlatformConfig) error {
	return nil
}

// --- Alert States (stub) ---

func (m *mockChatOpsRepo) GetAlertStates(_ context.Context, tenantID, userID string) ([]models.AlertState, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpdateAlertState(_ context.Context, tenantID, userID, alertID, status string) error {
	return nil
}

// --- Question / Command Configs (stub) ---

func (m *mockChatOpsRepo) GetQuestionConfigs(_ context.Context, tenantID, userID string) ([]models.QuestionConfig, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpsertQuestionConfigs(_ context.Context, tenantID, userID string, configs []models.QuestionConfig) error {
	return nil
}
func (m *mockChatOpsRepo) GetCommandConfigs(_ context.Context, tenantID, userID string) ([]models.CommandConfig, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpsertCommandConfigs(_ context.Context, tenantID, userID string, configs []models.CommandConfig) error {
	return nil
}

// --- Capability Mappings (stub) ---

func (m *mockChatOpsRepo) GetAllCapabilityMappings(_ context.Context, tenantID string, environment *string) ([]models.CapabilityMapping, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) CreateCapabilityMapping(_ context.Context, m2 *models.CapabilityMapping) error {
	return nil
}
func (m *mockChatOpsRepo) GetCapabilityMapping(_ context.Context, tenantID, id string) (*models.CapabilityMapping, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpdateCapabilityMapping(_ context.Context, tenantID, id string, updates map[string]interface{}) error {
	return nil
}
func (m *mockChatOpsRepo) DeleteCapabilityMapping(_ context.Context, tenantID, id string) error {
	return nil
}

// --- Approval Configs (stub) ---

func (m *mockChatOpsRepo) GetAllApprovalConfigs(_ context.Context, tenantID string) ([]models.ApprovalConfig, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) GetApprovalConfigByCapability(_ context.Context, tenantID, capability string) (*models.ApprovalConfig, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpsertApprovalConfig(_ context.Context, tenantID, capability string, enabled *bool, approvers *string, threshold *int) error {
	return nil
}
func (m *mockChatOpsRepo) BatchUpdateApprovalConfigs(_ context.Context, tenantID string, configs []models.ApprovalConfig) error {
	return nil
}

// --- Approvers (stub) ---

func (m *mockChatOpsRepo) GetApprovers(_ context.Context, tenantID string) ([]models.Approver, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) GetApproverSchedule(_ context.Context, tenantID string) ([]models.ApproverSchedule, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpdateApproverSchedule(_ context.Context, tenantID string, schedule []models.ApproverSchedule) error {
	return nil
}

// --- Global Approval Config (stub) ---

func (m *mockChatOpsRepo) GetGlobalApprovalConfig(_ context.Context, tenantID string) (*models.GlobalApprovalConfig, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpsertGlobalApprovalConfig(_ context.Context, tenantID string, config *models.GlobalApprovalConfig) error {
	return nil
}

// --- Roles (stub) ---

func (m *mockChatOpsRepo) GetAllRoles(_ context.Context, tenantID string) ([]models.PermissionRole, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) CreateRole(_ context.Context, m2 *models.PermissionRole) error { return nil }
func (m *mockChatOpsRepo) GetRole(_ context.Context, tenantID, id string) (*models.PermissionRole, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpdateRole(_ context.Context, tenantID, id string, updates map[string]interface{}) error {
	return nil
}
func (m *mockChatOpsRepo) DeleteRole(_ context.Context, tenantID, id string) error { return nil }
func (m *mockChatOpsRepo) GetUserAllowedCommands(_ context.Context, tenantID, userID string) ([]string, error) {
	return nil, nil
}

// --- Command Permissions (stub) ---

func (m *mockChatOpsRepo) GetAllCommandPermissions(_ context.Context, tenantID string) ([]models.CommandPermission, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) CreateCommandPermission(_ context.Context, m2 *models.CommandPermission) error {
	return nil
}
func (m *mockChatOpsRepo) GetCommandPermission(_ context.Context, tenantID, id string) (*models.CommandPermission, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpdateCommandPermission(_ context.Context, tenantID, id string, updates map[string]interface{}) error {
	return nil
}
func (m *mockChatOpsRepo) DeleteCommandPermission(_ context.Context, tenantID, id string) error {
	return nil
}

// --- Environment Permissions (stub) ---

func (m *mockChatOpsRepo) GetAllEnvironmentPermissions(_ context.Context, tenantID string) ([]models.EnvironmentPermission, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) CreateEnvironmentPermission(_ context.Context, m2 *models.EnvironmentPermission) error {
	return nil
}
func (m *mockChatOpsRepo) GetEnvironmentPermission(_ context.Context, tenantID, id string) (*models.EnvironmentPermission, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpdateEnvironmentPermission(_ context.Context, tenantID, id string, updates map[string]interface{}) error {
	return nil
}
func (m *mockChatOpsRepo) DeleteEnvironmentPermission(_ context.Context, tenantID, id string) error {
	return nil
}

// --- Command Versions (stub) ---

func (m *mockChatOpsRepo) GetAllCommandVersions(_ context.Context, tenantID string, limit, offset int) ([]models.CommandVersion, int, error) {
	return nil, 0, nil
}
func (m *mockChatOpsRepo) GetVersionsByCommand(_ context.Context, tenantID, commandID string) ([]models.CommandVersion, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) CreateCommandVersion(_ context.Context, m2 *models.CommandVersion) error {
	return nil
}
func (m *mockChatOpsRepo) AddTag(_ context.Context, tenantID, versionID, tagName, createdBy string) error {
	return nil
}
func (m *mockChatOpsRepo) RemoveTag(_ context.Context, tenantID, versionID, tagName string) error {
	return nil
}
func (m *mockChatOpsRepo) DeleteCommandVersion(_ context.Context, tenantID, id string) error {
	return nil
}

// --- Rate Limits (stub) ---

func (m *mockChatOpsRepo) GetAllRateLimits(_ context.Context, tenantID string) ([]models.RateLimit, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) CreateRateLimit(_ context.Context, m2 *models.RateLimit) error { return nil }
func (m *mockChatOpsRepo) GetRateLimit(_ context.Context, tenantID, id string) (*models.RateLimit, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpdateRateLimit(_ context.Context, tenantID, id string, updates map[string]interface{}) error {
	return nil
}
func (m *mockChatOpsRepo) DeleteRateLimit(_ context.Context, tenantID, id string) error { return nil }

// --- Webhooks (stub) ---

func (m *mockChatOpsRepo) GetAllWebhooks(_ context.Context, tenantID string) ([]models.Webhook, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) CreateWebhook(_ context.Context, m2 *models.Webhook) error { return nil }
func (m *mockChatOpsRepo) GetWebhook(_ context.Context, tenantID, id string) (*models.Webhook, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) UpdateWebhook(_ context.Context, tenantID, id string, updates map[string]interface{}) error {
	return nil
}
func (m *mockChatOpsRepo) DeleteWebhook(_ context.Context, tenantID, id string) error { return nil }
func (m *mockChatOpsRepo) TestWebhook(_ context.Context, tenantID, webhookID string) (*models.TestWebhookResult, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) GetWebhookLogs(_ context.Context, tenantID, webhookID string, limit int) ([]map[string]interface{}, error) {
	return nil, nil
}

// --- Dashboard Stats (stub) ---

func (m *mockChatOpsRepo) GetDashboardStats(_ context.Context, tenantID string, days int) (*models.DashboardStatsResult, error) {
	return nil, nil
}

// --- Knowledge Recommendations (stub) ---

func (m *mockChatOpsRepo) GetKnowledgeRecommendations(_ context.Context, tenantID, ctx string, limit int) ([]models.KnowledgeRecommendation, error) {
	return nil, nil
}

// --- Recommendations (stub) ---

func (m *mockChatOpsRepo) GetRecommendations(_ context.Context, tenantID, userID string, currentPage, resourceID string) ([]map[string]interface{}, error) {
	return nil, nil
}

// --- Messages / Sessions (stub) ---

func (m *mockChatOpsRepo) CreateMessage(_ context.Context, m2 *models.ChatOpsMessage) error {
	return nil
}
func (m *mockChatOpsRepo) GetSessionMessages(_ context.Context, tenantID, sessionID string, limit int, cursor *string) ([]models.ChatOpsMessage, error) {
	return nil, nil
}
func (m *mockChatOpsRepo) CreateSession(_ context.Context, tenantID, userID string) (*models.ChatOpsSession, error) {
	return nil, nil
}

// --- Health Check (stub) ---

func (m *mockChatOpsRepo) HealthCheck(_ context.Context) (*models.HealthCheckResult, error) {
	return &models.HealthCheckResult{Success: true}, nil
}

func newTestChatOpsService(repo *mockChatOpsRepo) *Service {
	return &Service{repo: repo}
}

func setupCommand(repo *mockChatOpsRepo, tenantID, id string) *models.ChatOpsCommand {
	c := &models.ChatOpsCommand{ID: id, TenantID: tenantID, Name: "test-cmd", Description: "test"}
	repo.commands[tenantID+":"+id] = c
	return c
}

func TestCreateCommand_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockChatOpsRepo()
	svc := newTestChatOpsService(repo)

	c, err := svc.CreateCommand(ctx, "t1", models.CreateCommandRequest{Name: "new-cmd"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if c.Name != "new-cmd" {
		t.Errorf("expected 'new-cmd', got %s", c.Name)
	}
}

func TestGetCommand_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockChatOpsRepo()
	setupCommand(repo, "t1", "c1")
	svc := newTestChatOpsService(repo)

	c, err := svc.GetCommand(ctx, "t1", "c1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if c.Name != "test-cmd" {
		t.Errorf("expected 'test-cmd', got %s", c.Name)
	}
}

func TestUpdateCommand_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockChatOpsRepo()
	setupCommand(repo, "t1", "c1")
	svc := newTestChatOpsService(repo)

	name := "updated"
	_, err := svc.UpdateCommand(ctx, "t1", "c1", models.UpdateCommandRequest{Name: &name})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	c, _ := repo.GetCommand(ctx, "t1", "c1")
	if c.Name != "updated" {
		t.Errorf("expected 'updated', got %s", c.Name)
	}
}

func TestDeleteCommand_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockChatOpsRepo()
	setupCommand(repo, "t1", "c1")
	svc := newTestChatOpsService(repo)

	err := svc.DeleteCommand(ctx, "t1", "c1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	_, err = repo.GetCommand(ctx, "t1", "c1")
	if err == nil {
		t.Error("expected command deleted")
	}
}

func TestHealthCheck_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockChatOpsRepo()
	svc := newTestChatOpsService(repo)

	result, err := svc.HealthCheck(ctx)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !result.Success {
		t.Error("expected health check success")
	}
}
