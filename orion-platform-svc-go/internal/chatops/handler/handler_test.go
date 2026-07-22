package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/chatops/models"

	"github.com/gin-gonic/gin"
)

type mockSvc struct {
	// --- Commands ---
	createCommandFn  func(ctx context.Context, tenantID string, req models.CreateCommandRequest) (*models.ChatOpsCommand, error)
	getCommandFn     func(ctx context.Context, tenantID, id string) (*models.ChatOpsCommand, error)
	listCommandsFn   func(ctx context.Context, tenantID string, permissionLevel, name *string, limit, offset int) ([]models.ChatOpsCommand, error)
	updateCommandFn  func(ctx context.Context, tenantID, id string, req models.UpdateCommandRequest) (*models.ChatOpsCommand, error)
	deleteCommandFn  func(ctx context.Context, tenantID, id string) error
	getCommandHelpFn func(ctx context.Context, tenantID, name string) (*models.ChatOpsCommand, error)

	// --- Execution ---
	executeCommandFn     func(ctx context.Context, tenantID, userID string, req models.ExecuteCommandRequest) (*models.Execution, error)
	getExecutionStatusFn func(ctx context.Context, tenantID, id string) (*models.Execution, error)
	listExecutionsFn     func(ctx context.Context, tenantID string, commandID, userID, status *string, limit, offset int) ([]models.Execution, error)

	// --- Recommendations ---
	getRecommendationsFn func(ctx context.Context, tenantID, userID, currentPage, resourceID string) ([]map[string]interface{}, error)

	// --- Knowledge / Sessions ---
	getKnowledgeRecsFn       func(ctx context.Context, tenantID string, context string, limit int) ([]models.KnowledgeRecommendation, error)
	getSessionMessagesFn     func(ctx context.Context, tenantID, sessionID string, limit int, cursor *string) ([]models.ChatOpsMessage, error)
	getAllCommandVersionsFn  func(ctx context.Context, tenantID string, page, perPage int) (models.CommandVersionResult, error)
	getUserAllowedCommandsFn func(ctx context.Context, tenantID, userID string) ([]string, error)

	// --- Notifications ---
	getNotificationPrefFn    func(ctx context.Context, tenantID, userID string) (*models.NotificationPreference, error)
	updateNotificationPrefFn func(ctx context.Context, tenantID, userID string, req models.UpdateNotificationPreferenceRequest) (*models.NotificationPreference, error)

	// --- DND ---
	getDNDSettingsFn    func(ctx context.Context, tenantID, userID string) (*models.DNDSettings, error)
	updateDNDSettingsFn func(ctx context.Context, tenantID, userID string, req models.UpdateDNDRequest) (*models.DNDSettings, error)
	toggleDNDFn         func(ctx context.Context, tenantID, userID string, enabled bool) (*models.DNDSettings, error)

	// --- Platform Config ---
	getPlatformConfigsFn    func(ctx context.Context, tenantID, userID string) ([]models.PlatformConfig, error)
	updatePlatformConfigsFn func(ctx context.Context, tenantID, userID string, req models.UpdatePlatformConfigRequest) ([]models.PlatformConfig, error)

	// --- Alert States ---
	getAlertStatesFn        func(ctx context.Context, tenantID, userID string) ([]models.AlertState, error)
	markAlertReadFn         func(ctx context.Context, tenantID, userID, alertID string) error
	markAlertAcknowledgedFn func(ctx context.Context, tenantID, userID, alertID string) error
	markAlertDismissedFn    func(ctx context.Context, tenantID, userID, alertID string) error

	// --- Question / Command Configs ---
	getQuestionConfigsFn    func(ctx context.Context, tenantID, userID string) ([]models.QuestionConfig, error)
	updateQuestionConfigsFn func(ctx context.Context, tenantID, userID string, req models.UpdateQuestionConfigsRequest) ([]models.QuestionConfig, error)
	getCommandConfigsFn     func(ctx context.Context, tenantID, userID string) ([]models.CommandConfig, error)
	updateCommandConfigsFn  func(ctx context.Context, tenantID, userID string, req models.UpdateCommandConfigsRequest) ([]models.CommandConfig, error)

	// --- Audit ---
	listAuditLogsFn   func(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, error)
	getAuditStatsFn   func(ctx context.Context, tenantID string) (map[string]interface{}, error)
	exportAuditLogsFn func(ctx context.Context, tenantID string, q models.AuditLogQuery) (map[string]interface{}, error)

	// --- Dashboard ---
	getDashboardStatsFn func(ctx context.Context, tenantID string, req models.DashboardStatsRequest) (*models.DashboardStatsResult, error)

	// --- Health ---
	healthCheckFn func(ctx context.Context) (*models.HealthCheckResult, error)

	// --- Capability Mappings ---
	getAllCapabilityMappingsFn func(ctx context.Context, tenantID string, environment *string) ([]models.CapabilityMapping, error)
	createCapabilityMappingFn  func(ctx context.Context, tenantID string, req models.CreateCapabilityMappingRequest) (*models.CapabilityMapping, error)
	updateCapabilityMappingFn  func(ctx context.Context, tenantID, id string, req models.UpdateCapabilityMappingRequest) (*models.CapabilityMapping, error)
	deleteCapabilityMappingFn  func(ctx context.Context, tenantID, id string) error

	// --- Approval Configs ---
	getAllApprovalConfigsFn         func(ctx context.Context, tenantID string) ([]models.ApprovalConfig, error)
	updateApprovalConfigsFn         func(ctx context.Context, tenantID string, req models.UpdateApprovalConfigsRequest) ([]models.ApprovalConfig, error)
	getApprovalConfigByCapabilityFn func(ctx context.Context, tenantID, capability string) (*models.ApprovalConfig, error)
	updateApprovalConfigFn          func(ctx context.Context, tenantID, capability string, req models.UpdateApprovalConfigRequest) (*models.ApprovalConfig, error)

	// --- Approvers ---
	getApproversFn           func(ctx context.Context, tenantID string) ([]models.Approver, error)
	getApproverScheduleFn    func(ctx context.Context, tenantID string) ([]models.ApproverSchedule, error)
	updateApproverScheduleFn func(ctx context.Context, tenantID string, schedule []models.ApproverSchedule) error

	// --- Global Approval Config ---
	getGlobalApprovalConfigFn    func(ctx context.Context, tenantID string) (*models.GlobalApprovalConfig, error)
	updateGlobalApprovalConfigFn func(ctx context.Context, tenantID string, config *models.GlobalApprovalConfig) error

	// --- Roles ---
	getAllRolesFn func(ctx context.Context, tenantID string) ([]models.PermissionRole, error)
	createRoleFn  func(ctx context.Context, tenantID string, req models.CreateRoleRequest) (*models.PermissionRole, error)
	getRoleFn     func(ctx context.Context, tenantID, id string) (*models.PermissionRole, error)
	updateRoleFn  func(ctx context.Context, tenantID, id string, req models.UpdateRoleRequest) (*models.PermissionRole, error)
	deleteRoleFn  func(ctx context.Context, tenantID, id string) error

	// --- Command Permissions ---
	getAllCommandPermissionsFn func(ctx context.Context, tenantID string) ([]models.CommandPermission, error)
	createCommandPermissionFn  func(ctx context.Context, tenantID string, req models.CreateCommandPermissionRequest) (*models.CommandPermission, error)
	updateCommandPermissionFn  func(ctx context.Context, tenantID, id string, req models.UpdateCommandPermissionRequest) (*models.CommandPermission, error)
	deleteCommandPermissionFn  func(ctx context.Context, tenantID, id string) error

	// --- Environment Permissions ---
	getAllEnvironmentPermissionsFn func(ctx context.Context, tenantID string) ([]models.EnvironmentPermission, error)
	createEnvironmentPermissionFn  func(ctx context.Context, tenantID string, req models.CreateEnvironmentPermissionRequest) (*models.EnvironmentPermission, error)
	updateEnvironmentPermissionFn  func(ctx context.Context, tenantID, id string, req models.UpdateEnvironmentPermissionRequest) (*models.EnvironmentPermission, error)
	deleteEnvironmentPermissionFn  func(ctx context.Context, tenantID, id string) error

	// --- Command Versions ---
	getVersionsByCommandFn func(ctx context.Context, tenantID, commandID string) ([]models.CommandVersion, error)
	createCommandVersionFn func(ctx context.Context, tenantID string, req models.CreateCommandVersionRequest) (*models.CommandVersion, error)
	addTagFn               func(ctx context.Context, tenantID, versionID, tagName, createdBy string) error
	removeTagFn            func(ctx context.Context, tenantID, versionID, tagName string) error
	deleteCommandVersionFn func(ctx context.Context, tenantID, id string) error

	// --- Rate Limits ---
	getAllRateLimitsFn func(ctx context.Context, tenantID string) ([]models.RateLimit, error)
	createRateLimitFn  func(ctx context.Context, tenantID string, req models.CreateRateLimitRequest) (*models.RateLimit, error)
	updateRateLimitFn  func(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.RateLimit, error)
	deleteRateLimitFn  func(ctx context.Context, tenantID, id string) error

	// --- Webhooks ---
	getAllWebhooksFn func(ctx context.Context, tenantID string) ([]models.Webhook, error)
	createWebhookFn  func(ctx context.Context, tenantID string, req models.CreateWebhookRequest) (*models.Webhook, error)
	updateWebhookFn  func(ctx context.Context, tenantID, id string, body map[string]interface{}) (*models.Webhook, error)
	deleteWebhookFn  func(ctx context.Context, tenantID, id string) error
	testWebhookFn    func(ctx context.Context, tenantID, id string) (*models.TestWebhookResult, error)
	getWebhookLogsFn func(ctx context.Context, tenantID, webhookID string, limit int) ([]map[string]interface{}, error)

	// --- Receive Message ---
	receiveMessageFn func(ctx context.Context, tenantID, userID string, req models.ReceiveMessageRequest) (map[string]interface{}, error)
}

func (m *mockSvc) CreateCommand(ctx context.Context, tenantID string, req models.CreateCommandRequest) (*models.ChatOpsCommand, error) {
	if m.createCommandFn != nil {
		return m.createCommandFn(ctx, tenantID, req)
	}
	return nil, nil
}
func (m *mockSvc) GetCommand(ctx context.Context, tenantID, id string) (*models.ChatOpsCommand, error) {
	if m.getCommandFn != nil {
		return m.getCommandFn(ctx, tenantID, id)
	}
	return nil, nil
}
func (m *mockSvc) ListCommands(ctx context.Context, tenantID string, permissionLevel, name *string, limit, offset int) ([]models.ChatOpsCommand, error) {
	if m.listCommandsFn != nil {
		return m.listCommandsFn(ctx, tenantID, permissionLevel, name, limit, offset)
	}
	return nil, nil
}
func (m *mockSvc) UpdateCommand(ctx context.Context, tenantID, id string, req models.UpdateCommandRequest) (*models.ChatOpsCommand, error) {
	if m.updateCommandFn != nil {
		return m.updateCommandFn(ctx, tenantID, id, req)
	}
	return nil, nil
}
func (m *mockSvc) DeleteCommand(ctx context.Context, tenantID, id string) error {
	if m.deleteCommandFn != nil {
		return m.deleteCommandFn(ctx, tenantID, id)
	}
	return nil
}
func (m *mockSvc) GetCommandHelp(ctx context.Context, tenantID, name string) (*models.ChatOpsCommand, error) {
	if m.getCommandHelpFn != nil {
		return m.getCommandHelpFn(ctx, tenantID, name)
	}
	return nil, nil
}
func (m *mockSvc) ExecuteCommand(ctx context.Context, tenantID, userID string, req models.ExecuteCommandRequest) (*models.Execution, error) {
	if m.executeCommandFn != nil {
		return m.executeCommandFn(ctx, tenantID, userID, req)
	}
	return nil, nil
}
func (m *mockSvc) GetExecutionStatus(ctx context.Context, tenantID, id string) (*models.Execution, error) {
	if m.getExecutionStatusFn != nil {
		return m.getExecutionStatusFn(ctx, tenantID, id)
	}
	return nil, nil
}
func (m *mockSvc) ListExecutions(ctx context.Context, tenantID string, commandID, userID, status *string, limit, offset int) ([]models.Execution, error) {
	if m.listExecutionsFn != nil {
		return m.listExecutionsFn(ctx, tenantID, commandID, userID, status, limit, offset)
	}
	return nil, nil
}
func (m *mockSvc) ListAuditLogs(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, error) {
	if m.listAuditLogsFn != nil {
		return m.listAuditLogsFn(ctx, tenantID, q)
	}
	return nil, nil
}
func (m *mockSvc) GetAuditStats(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	if m.getAuditStatsFn != nil {
		return m.getAuditStatsFn(ctx, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) GetDashboardStats(ctx context.Context, tenantID string, req models.DashboardStatsRequest) (*models.DashboardStatsResult, error) {
	if m.getDashboardStatsFn != nil {
		return m.getDashboardStatsFn(ctx, tenantID, req)
	}
	return nil, nil
}
func (m *mockSvc) HealthCheck(ctx context.Context) (*models.HealthCheckResult, error) {
	if m.healthCheckFn != nil {
		return m.healthCheckFn(ctx)
	}
	return nil, nil
}
func (m *mockSvc) GetAllRoles(ctx context.Context, tenantID string) ([]models.PermissionRole, error) {
	if m.getAllRolesFn != nil {
		return m.getAllRolesFn(ctx, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) CreateRole(ctx context.Context, tenantID string, req models.CreateRoleRequest) (*models.PermissionRole, error) {
	if m.createRoleFn != nil {
		return m.createRoleFn(ctx, tenantID, req)
	}
	return nil, nil
}
func (m *mockSvc) GetRole(ctx context.Context, tenantID, id string) (*models.PermissionRole, error) {
	if m.getRoleFn != nil {
		return m.getRoleFn(ctx, tenantID, id)
	}
	return nil, nil
}
func (m *mockSvc) DeleteRole(ctx context.Context, tenantID, id string) error {
	if m.deleteRoleFn != nil {
		return m.deleteRoleFn(ctx, tenantID, id)
	}
	return nil
}
func (m *mockSvc) GetNotificationPreference(ctx context.Context, tenantID, userID string) (*models.NotificationPreference, error) {
	if m.getNotificationPrefFn != nil {
		return m.getNotificationPrefFn(ctx, tenantID, userID)
	}
	return nil, nil
}
func (m *mockSvc) UpdateNotificationPreference(ctx context.Context, tenantID, userID string, req models.UpdateNotificationPreferenceRequest) (*models.NotificationPreference, error) {
	if m.updateNotificationPrefFn != nil {
		return m.updateNotificationPrefFn(ctx, tenantID, userID, req)
	}
	return nil, nil
}
func (m *mockSvc) GetAllWebhooks(ctx context.Context, tenantID string) ([]models.Webhook, error) {
	if m.getAllWebhooksFn != nil {
		return m.getAllWebhooksFn(ctx, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) CreateWebhook(ctx context.Context, tenantID string, req models.CreateWebhookRequest) (*models.Webhook, error) {
	if m.createWebhookFn != nil {
		return m.createWebhookFn(ctx, tenantID, req)
	}
	return nil, nil
}
func (m *mockSvc) DeleteWebhook(ctx context.Context, tenantID, id string) error {
	if m.deleteWebhookFn != nil {
		return m.deleteWebhookFn(ctx, tenantID, id)
	}
	return nil
}
func (m *mockSvc) ReceiveMessage(ctx context.Context, tenantID, userID string, req models.ReceiveMessageRequest) (map[string]interface{}, error) {
	if m.receiveMessageFn != nil {
		return m.receiveMessageFn(ctx, tenantID, userID, req)
	}
	return nil, nil
}
func (m *mockSvc) GetKnowledgeRecommendations(ctx context.Context, tenantID string, context string, limit int) ([]models.KnowledgeRecommendation, error) {
	if m.getKnowledgeRecsFn != nil {
		return m.getKnowledgeRecsFn(ctx, tenantID, context, limit)
	}
	return nil, nil
}
func (m *mockSvc) GetSessionMessages(ctx context.Context, tenantID, sessionID string, limit int, cursor *string) ([]models.ChatOpsMessage, error) {
	if m.getSessionMessagesFn != nil {
		return m.getSessionMessagesFn(ctx, tenantID, sessionID, limit, cursor)
	}
	return nil, nil
}
func (m *mockSvc) GetAllCommandVersions(ctx context.Context, tenantID string, page, perPage int) (models.CommandVersionResult, error) {
	if m.getAllCommandVersionsFn != nil {
		return m.getAllCommandVersionsFn(ctx, tenantID, page, perPage)
	}
	return models.CommandVersionResult{}, nil
}
func (m *mockSvc) GetUserAllowedCommands(ctx context.Context, tenantID, userID string) ([]string, error) {
	if m.getUserAllowedCommandsFn != nil {
		return m.getUserAllowedCommandsFn(ctx, tenantID, userID)
	}
	return nil, nil
}

func newHandlerWithSvc(svc Service) *Handler {
	return &Handler{svc: svc}
}

func performRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "test-tenant")

	var buf bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = *bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, "/", &buf)
	c.Request.Header.Set("Content-Type", "application/json")

	if pathParams != nil {
		c.Params = gin.Params{}
		for k, v := range pathParams {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}

	if queryParams != nil {
		q := c.Request.URL.Query()
		for k, v := range queryParams {
			q.Set(k, v)
		}
		c.Request.URL.RawQuery = q.Encode()
	}

	handlerFn(c)
	return w
}

// --- Commands (Handler has ListCommands, GetCommandHelp only) ---

func TestHandler_ListCommands_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listCommandsFn: func(ctx context.Context, tenantID string, permissionLevel, name *string, limit, offset int) ([]models.ChatOpsCommand, error) {
			return []models.ChatOpsCommand{{ID: "cmd-1"}}, nil
		},
	})
	w := performRequest(h, h.ListCommands, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// --- ExecuteCommand ---

func TestHandler_ExecuteCommand_Success(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "test-tenant")
	c.Set("user_id", "user-1")

	body := map[string]interface{}{"command": "deploy", "params": map[string]interface{}{}}
	b, _ := json.Marshal(body)
	c.Request = httptest.NewRequest("POST", "/", bytes.NewBuffer(b))
	c.Request.Header.Set("Content-Type", "application/json")

	h := newHandlerWithSvc(&mockSvc{
		executeCommandFn: func(ctx context.Context, tenantID, userID string, req models.ExecuteCommandRequest) (*models.Execution, error) {
			return &models.Execution{ID: "exec-1", Status: "running"}, nil
		},
	})
	h.ExecuteCommand(c)
	if c.Writer.Status() != http.StatusCreated {
		t.Errorf("expected 201, got %d", c.Writer.Status())
	}
}

// --- Audit Stats ---

func TestHandler_GetAuditStats_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getAuditStatsFn: func(ctx context.Context, tenantID string) (map[string]interface{}, error) {
			return map[string]interface{}{"total": 10}, nil
		},
	})
	w := performRequest(h, h.GetAuditStats, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// --- Health Check ---

func TestHandler_HealthCheck_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		healthCheckFn: func(ctx context.Context) (*models.HealthCheckResult, error) {
			return &models.HealthCheckResult{Success: true}, nil
		},
	})
	w := performRequest(h, h.HealthCheck, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// --- Roles ---

func TestHandler_CreateRole_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createRoleFn: func(ctx context.Context, tenantID string, req models.CreateRoleRequest) (*models.PermissionRole, error) {
			return &models.PermissionRole{ID: "role-1", Name: req.Name}, nil
		},
	})
	w := performRequest(h, h.CreateRole, "POST", map[string]interface{}{"name": "admin"}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
}

func TestHandler_GetRole_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getRoleFn: func(ctx context.Context, tenantID, id string) (*models.PermissionRole, error) {
			return &models.PermissionRole{ID: id}, nil
		},
	})
	w := performRequest(h, h.GetAllRoles, "GET", nil, map[string]string{"id": "role-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_DeleteRole_Success(t *testing.T) {
	var called bool
	h := newHandlerWithSvc(&mockSvc{
		deleteRoleFn: func(ctx context.Context, tenantID, id string) error {
			called = true
			return nil
		},
	})
	w := performRequest(h, h.DeleteRole, "DELETE", nil, map[string]string{"id": "role-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !called {
		t.Error("expected delete to be called")
	}
}

// --- Webhooks ---

func TestHandler_CreateWebhook_Success(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "test-tenant")
	c.Set("user_id", "user-1")

	body := map[string]interface{}{
		"name": "test-webhook", "url": "http://example.com",
		"events": []string{"deploy"},
	}
	b, _ := json.Marshal(body)
	c.Request = httptest.NewRequest("POST", "/", bytes.NewBuffer(b))
	c.Request.Header.Set("Content-Type", "application/json")

	h := newHandlerWithSvc(&mockSvc{
		createWebhookFn: func(ctx context.Context, tenantID string, req models.CreateWebhookRequest) (*models.Webhook, error) {
			return &models.Webhook{ID: "wh-1", Name: req.Name}, nil
		},
	})
	h.CreateWebhook(c)
	if c.Writer.Status() != http.StatusCreated {
		t.Errorf("expected 201, got %d", c.Writer.Status())
	}
}

func TestHandler_GetAllWebhooks_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getAllWebhooksFn: func(ctx context.Context, tenantID string) ([]models.Webhook, error) {
			return []models.Webhook{{ID: "wh-1"}}, nil
		},
	})
	w := performRequest(h, h.GetAllWebhooks, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// --- Notification Preferences ---

func TestHandler_GetNotificationPreference_Success(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "test-tenant")
	c.Set("user_id", "user-1")
	c.Params = append(c.Params, gin.Param{Key: "userId", Value: "user-1"})
	c.Request = httptest.NewRequest("GET", "/", nil)

	h := newHandlerWithSvc(&mockSvc{
		getNotificationPrefFn: func(ctx context.Context, tenantID, userID string) (*models.NotificationPreference, error) {
			return &models.NotificationPreference{ID: "pref-1"}, nil
		},
	})
	h.GetNotificationPreferences(c)
	if c.Writer.Status() != http.StatusOK {
		t.Errorf("expected 200, got %d", c.Writer.Status())
	}
}

// --- Dashboard Stats ---

func TestHandler_GetDashboardStats_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getDashboardStatsFn: func(ctx context.Context, tenantID string, req models.DashboardStatsRequest) (*models.DashboardStatsResult, error) {
			return &models.DashboardStatsResult{TotalCommands: 5}, nil
		},
	})
	w := performRequest(h, h.GetDashboardStats, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// --- ReceiveMessage ---

func TestHandler_ReceiveMessage_Success(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "test-tenant")
	c.Set("user_id", "user-1")

	body := map[string]interface{}{"text": "deploy", "platform": "slack"}
	b, _ := json.Marshal(body)
	c.Request = httptest.NewRequest("POST", "/", bytes.NewBuffer(b))
	c.Request.Header.Set("Content-Type", "application/json")

	h := newHandlerWithSvc(&mockSvc{
		receiveMessageFn: func(ctx context.Context, tenantID, userID string, req models.ReceiveMessageRequest) (map[string]interface{}, error) {
			return map[string]interface{}{"session_id": "sess-1"}, nil
		},
	})
	h.ReceiveMessage(c)
	if c.Writer.Status() != http.StatusCreated {
		t.Errorf("expected 201, got %d", c.Writer.Status())
	}
}

// --- Stub implementations for all interface methods ---

func (m *mockSvc) GetRecommendations(ctx context.Context, tenantID, userID, currentPage, resourceID string) ([]map[string]interface{}, error) {
	if m.getRecommendationsFn != nil {
		return m.getRecommendationsFn(ctx, tenantID, userID, currentPage, resourceID)
	}
	return nil, nil
}
func (m *mockSvc) GetDNDSettings(ctx context.Context, tenantID, userID string) (*models.DNDSettings, error) {
	return nil, nil
}
func (m *mockSvc) UpdateDNDSettings(ctx context.Context, tenantID, userID string, req models.UpdateDNDRequest) (*models.DNDSettings, error) {
	return nil, nil
}
func (m *mockSvc) ToggleDND(ctx context.Context, tenantID, userID string, enabled bool) (*models.DNDSettings, error) {
	return nil, nil
}
func (m *mockSvc) GetPlatformConfigs(ctx context.Context, tenantID, userID string) ([]models.PlatformConfig, error) {
	return nil, nil
}
func (m *mockSvc) UpdatePlatformConfigs(ctx context.Context, tenantID, userID string, req models.UpdatePlatformConfigRequest) ([]models.PlatformConfig, error) {
	return nil, nil
}
func (m *mockSvc) GetAlertStates(ctx context.Context, tenantID, userID string) ([]models.AlertState, error) {
	return nil, nil
}
func (m *mockSvc) MarkAlertRead(ctx context.Context, tenantID, userID, alertID string) error {
	return nil
}
func (m *mockSvc) MarkAlertAcknowledged(ctx context.Context, tenantID, userID, alertID string) error {
	return nil
}
func (m *mockSvc) MarkAlertDismissed(ctx context.Context, tenantID, userID, alertID string) error {
	return nil
}
func (m *mockSvc) GetQuestionConfigs(ctx context.Context, tenantID, userID string) ([]models.QuestionConfig, error) {
	return nil, nil
}
func (m *mockSvc) UpdateQuestionConfigs(ctx context.Context, tenantID, userID string, req models.UpdateQuestionConfigsRequest) ([]models.QuestionConfig, error) {
	return nil, nil
}
func (m *mockSvc) GetCommandConfigs(ctx context.Context, tenantID, userID string) ([]models.CommandConfig, error) {
	return nil, nil
}
func (m *mockSvc) UpdateCommandConfigs(ctx context.Context, tenantID, userID string, req models.UpdateCommandConfigsRequest) ([]models.CommandConfig, error) {
	return nil, nil
}
func (m *mockSvc) ExportAuditLogs(ctx context.Context, tenantID string, q models.AuditLogQuery) (map[string]interface{}, error) {
	return nil, nil
}
func (m *mockSvc) GetAllCapabilityMappings(ctx context.Context, tenantID string, environment *string) ([]models.CapabilityMapping, error) {
	return nil, nil
}
func (m *mockSvc) CreateCapabilityMapping(ctx context.Context, tenantID string, req models.CreateCapabilityMappingRequest) (*models.CapabilityMapping, error) {
	return nil, nil
}
func (m *mockSvc) UpdateCapabilityMapping(ctx context.Context, tenantID, id string, req models.UpdateCapabilityMappingRequest) (*models.CapabilityMapping, error) {
	return nil, nil
}
func (m *mockSvc) DeleteCapabilityMapping(ctx context.Context, tenantID, id string) error {
	return nil
}
func (m *mockSvc) GetAllApprovalConfigs(ctx context.Context, tenantID string) ([]models.ApprovalConfig, error) {
	return nil, nil
}
func (m *mockSvc) UpdateApprovalConfigs(ctx context.Context, tenantID string, req models.UpdateApprovalConfigsRequest) ([]models.ApprovalConfig, error) {
	return nil, nil
}
func (m *mockSvc) GetApprovalConfigByCapability(ctx context.Context, tenantID, capability string) (*models.ApprovalConfig, error) {
	return nil, nil
}
func (m *mockSvc) UpdateApprovalConfig(ctx context.Context, tenantID, capability string, req models.UpdateApprovalConfigRequest) (*models.ApprovalConfig, error) {
	return nil, nil
}
func (m *mockSvc) GetApprovers(ctx context.Context, tenantID string) ([]models.Approver, error) {
	return nil, nil
}
func (m *mockSvc) GetApproverSchedule(ctx context.Context, tenantID string) ([]models.ApproverSchedule, error) {
	return nil, nil
}
func (m *mockSvc) UpdateApproverSchedule(ctx context.Context, tenantID string, schedule []models.ApproverSchedule) error {
	return nil
}
func (m *mockSvc) GetGlobalApprovalConfig(ctx context.Context, tenantID string) (*models.GlobalApprovalConfig, error) {
	return nil, nil
}
func (m *mockSvc) UpdateGlobalApprovalConfig(ctx context.Context, tenantID string, config *models.GlobalApprovalConfig) error {
	return nil
}
func (m *mockSvc) UpdateRole(ctx context.Context, tenantID, id string, req models.UpdateRoleRequest) (*models.PermissionRole, error) {
	return nil, nil
}
func (m *mockSvc) GetAllCommandPermissions(ctx context.Context, tenantID string) ([]models.CommandPermission, error) {
	return nil, nil
}
func (m *mockSvc) CreateCommandPermission(ctx context.Context, tenantID string, req models.CreateCommandPermissionRequest) (*models.CommandPermission, error) {
	return nil, nil
}
func (m *mockSvc) UpdateCommandPermission(ctx context.Context, tenantID, id string, req models.UpdateCommandPermissionRequest) (*models.CommandPermission, error) {
	return nil, nil
}
func (m *mockSvc) DeleteCommandPermission(ctx context.Context, tenantID, id string) error {
	return nil
}
func (m *mockSvc) GetAllEnvironmentPermissions(ctx context.Context, tenantID string) ([]models.EnvironmentPermission, error) {
	return nil, nil
}
func (m *mockSvc) CreateEnvironmentPermission(ctx context.Context, tenantID string, req models.CreateEnvironmentPermissionRequest) (*models.EnvironmentPermission, error) {
	return nil, nil
}
func (m *mockSvc) UpdateEnvironmentPermission(ctx context.Context, tenantID, id string, req models.UpdateEnvironmentPermissionRequest) (*models.EnvironmentPermission, error) {
	return nil, nil
}
func (m *mockSvc) DeleteEnvironmentPermission(ctx context.Context, tenantID, id string) error {
	return nil
}
func (m *mockSvc) GetVersionsByCommand(ctx context.Context, tenantID, commandID string) ([]models.CommandVersion, error) {
	return nil, nil
}
func (m *mockSvc) CreateCommandVersion(ctx context.Context, tenantID string, req models.CreateCommandVersionRequest) (*models.CommandVersion, error) {
	return nil, nil
}
func (m *mockSvc) AddTag(ctx context.Context, tenantID, versionID, tagName, createdBy string) error {
	return nil
}
func (m *mockSvc) RemoveTag(ctx context.Context, tenantID, versionID, tagName string) error {
	return nil
}
func (m *mockSvc) DeleteCommandVersion(ctx context.Context, tenantID, id string) error {
	return nil
}
func (m *mockSvc) GetAllRateLimits(ctx context.Context, tenantID string) ([]models.RateLimit, error) {
	return nil, nil
}
func (m *mockSvc) CreateRateLimit(ctx context.Context, tenantID string, req models.CreateRateLimitRequest) (*models.RateLimit, error) {
	return nil, nil
}
func (m *mockSvc) UpdateRateLimit(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.RateLimit, error) {
	return nil, nil
}
func (m *mockSvc) DeleteRateLimit(ctx context.Context, tenantID, id string) error {
	return nil
}
func (m *mockSvc) UpdateWebhook(ctx context.Context, tenantID, id string, body map[string]interface{}) (*models.Webhook, error) {
	return nil, nil
}
func (m *mockSvc) TestWebhook(ctx context.Context, tenantID, id string) (*models.TestWebhookResult, error) {
	return nil, nil
}
func (m *mockSvc) GetWebhookLogs(ctx context.Context, tenantID, webhookID string, limit int) ([]map[string]interface{}, error) {
	return nil, nil
}
