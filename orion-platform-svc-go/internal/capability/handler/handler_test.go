package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/capability/models"

	"github.com/gin-gonic/gin"
)

type mockSvc struct {
	createFn          func(ctx context.Context, tenantID string, req models.CreateCapabilityRequest) (*models.Capability, error)
	getFn             func(ctx context.Context, tenantID, id string) (*models.Capability, error)
	listFn            func(ctx context.Context, tenantID string, limit, offset int) ([]models.Capability, error)
	updateFn          func(ctx context.Context, tenantID, id string, req models.UpdateCapabilityRequest) (*models.Capability, error)
	deleteFn          func(ctx context.Context, tenantID, id string) error
	getTreeFn         func(ctx context.Context, tenantID string) ([]models.Capability, error)
	grantToRoleFn     func(ctx context.Context, tenantID, capabilityID, roleName, grantedBy string) error
	revokeFromRoleFn  func(ctx context.Context, tenantID, capabilityID, roleName string) error
	grantToUserFn     func(ctx context.Context, tenantID, capabilityID, targetUserID, grantedBy string, expiresInHours *int) error
	revokeFromUserFn  func(ctx context.Context, tenantID, capabilityID, targetUserID string) error
	mapCommandFn      func(ctx context.Context, tenantID, commandName, commandAction, capabilityID, environmentSuffix string) error
	getCapabilityFn   func(ctx context.Context, tenantID, command, action, environment string) (*string, error)
	checkPermissionFn func(ctx context.Context, tenantID string, req models.CheckPermissionRequest) (*models.CheckPermissionResult, error)
	getEffectiveFn    func(ctx context.Context, tenantID, userID string, roles []string) ([]string, error)
}

func (m *mockSvc) Create(ctx context.Context, tenantID string, req models.CreateCapabilityRequest) (*models.Capability, error) {
	if m.createFn != nil {
		return m.createFn(ctx, tenantID, req)
	}
	return nil, nil
}
func (m *mockSvc) Get(ctx context.Context, tenantID, id string) (*models.Capability, error) {
	if m.getFn != nil {
		return m.getFn(ctx, tenantID, id)
	}
	return nil, nil
}
func (m *mockSvc) List(ctx context.Context, tenantID string, limit, offset int) ([]models.Capability, error) {
	if m.listFn != nil {
		return m.listFn(ctx, tenantID, limit, offset)
	}
	return nil, nil
}
func (m *mockSvc) Update(ctx context.Context, tenantID, id string, req models.UpdateCapabilityRequest) (*models.Capability, error) {
	if m.updateFn != nil {
		return m.updateFn(ctx, tenantID, id, req)
	}
	return nil, nil
}
func (m *mockSvc) Delete(ctx context.Context, tenantID, id string) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, tenantID, id)
	}
	return nil
}
func (m *mockSvc) GetTree(ctx context.Context, tenantID string) ([]models.Capability, error) {
	if m.getTreeFn != nil {
		return m.getTreeFn(ctx, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) GrantCapabilityToRole(ctx context.Context, tenantID, capabilityID, roleName, grantedBy string) error {
	if m.grantToRoleFn != nil {
		return m.grantToRoleFn(ctx, tenantID, capabilityID, roleName, grantedBy)
	}
	return nil
}
func (m *mockSvc) RevokeCapabilityFromRole(ctx context.Context, tenantID, capabilityID, roleName string) error {
	if m.revokeFromRoleFn != nil {
		return m.revokeFromRoleFn(ctx, tenantID, capabilityID, roleName)
	}
	return nil
}
func (m *mockSvc) GrantCapabilityToUser(ctx context.Context, tenantID, capabilityID, targetUserID, grantedBy string, expiresInHours *int) error {
	if m.grantToUserFn != nil {
		return m.grantToUserFn(ctx, tenantID, capabilityID, targetUserID, grantedBy, expiresInHours)
	}
	return nil
}
func (m *mockSvc) RevokeCapabilityFromUser(ctx context.Context, tenantID, capabilityID, targetUserID string) error {
	if m.revokeFromUserFn != nil {
		return m.revokeFromUserFn(ctx, tenantID, capabilityID, targetUserID)
	}
	return nil
}
func (m *mockSvc) MapCommandToCapability(ctx context.Context, tenantID, commandName, commandAction, capabilityID, environmentSuffix string) error {
	if m.mapCommandFn != nil {
		return m.mapCommandFn(ctx, tenantID, commandName, commandAction, capabilityID, environmentSuffix)
	}
	return nil
}
func (m *mockSvc) GetCapabilityForCommand(ctx context.Context, tenantID, command, action, environment string) (*string, error) {
	if m.getCapabilityFn != nil {
		return m.getCapabilityFn(ctx, tenantID, command, action, environment)
	}
	return nil, nil
}
func (m *mockSvc) CheckPermission(ctx context.Context, tenantID string, req models.CheckPermissionRequest) (*models.CheckPermissionResult, error) {
	if m.checkPermissionFn != nil {
		return m.checkPermissionFn(ctx, tenantID, req)
	}
	return nil, nil
}
func (m *mockSvc) GetUserEffectiveCapabilities(ctx context.Context, tenantID, userID string, roles []string) ([]string, error) {
	if m.getEffectiveFn != nil {
		return m.getEffectiveFn(ctx, tenantID, userID, roles)
	}
	return nil, nil
}

func (m *mockSvc) GetUserPermissionRequests(ctx context.Context, tenantID, userID string) ([]models.PermissionRequest, error) {
	return nil, nil
}
func (m *mockSvc) GrantTemporaryPermission(ctx context.Context, req models.GrantTemporaryRequest) (*models.TemporaryPermission, error) {
	return nil, nil
}
func (m *mockSvc) GetActiveTemporaryPermissions(ctx context.Context, tenantID, userID string) ([]models.TemporaryPermission, error) {
	return nil, nil
}
func (m *mockSvc) RevokeTemporaryPermission(ctx context.Context, tenantID string, id int, revokedBy string, reason string) (*models.TemporaryPermission, error) {
	return nil, nil
}
func (m *mockSvc) GetAuditLogs(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, error) {
	return nil, nil
}
func (m *mockSvc) CreatePermissionRequest(ctx context.Context, tenantID, userID, capabilityID string, body models.CreatePermissionRequestBody) (*models.PermissionRequest, error) {
	return nil, nil
}
func (m *mockSvc) GetPermissionRequestByTicket(ctx context.Context, tenantID string, ticketID int) (*models.PermissionRequest, error) {
	return nil, nil
}
func (m *mockSvc) ApproveRequest(ctx context.Context, tenantID string, ticketID int, approverID string, approverRoles []string) (*models.PermissionRequest, error) {
	return nil, nil
}
func (m *mockSvc) RejectRequest(ctx context.Context, tenantID string, ticketID int, rejecterID string, reason string) (bool, error) {
	return false, nil
}
func (m *mockSvc) CleanupExpiredTemporaryPermissions(ctx context.Context, tenantID string) (*models.CleanupResult, error) {
	return nil, nil
}
func (m *mockSvc) RequestPermission(ctx context.Context, tenantID string, body models.RequestPermissionBody) (*models.PermissionRequest, error) {
	return nil, nil
}
func (m *mockSvc) GrantSimplified(ctx context.Context, req models.GrantSimplifiedRequest) (*models.TemporaryPermission, error) {
	return nil, nil
}
func (m *mockSvc) RevokeSimplified(ctx context.Context, tenantID string, id int, revokedBy string) (*models.TemporaryPermission, error) {
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

// --- List ---

func TestHandler_List_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(ctx context.Context, tenantID string, limit, offset int) ([]models.Capability, error) {
			if tenantID != "test-tenant" {
				t.Errorf("expected test-tenant, got %s", tenantID)
			}
			return []models.Capability{{ID: "cap-1", Name: "test-cap"}}, nil
		},
	})
	w := performRequest(h, h.List, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_List_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(ctx context.Context, tenantID string, limit, offset int) ([]models.Capability, error) {
			return nil, errors.New("db error")
		},
	})
	w := performRequest(h, h.List, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// --- Create ---

func TestHandler_Create_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID string, req models.CreateCapabilityRequest) (*models.Capability, error) {
			if tenantID != "test-tenant" {
				t.Errorf("expected test-tenant, got %s", tenantID)
			}
			return &models.Capability{ID: "cap-new", Name: req.Name}, nil
		},
	})
	w := performRequest(h, h.Create, "POST", map[string]interface{}{"name": "new-cap"}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
}

func TestHandler_Create_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.Create, "POST", map[string]interface{}{}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandler_Create_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID string, req models.CreateCapabilityRequest) (*models.Capability, error) {
			return nil, errors.New("db error")
		},
	})
	w := performRequest(h, h.Create, "POST", map[string]interface{}{"name": "new-cap"}, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// --- Get ---

func TestHandler_Get_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(ctx context.Context, tenantID, id string) (*models.Capability, error) {
			if tenantID != "test-tenant" {
				t.Errorf("expected test-tenant, got %s", tenantID)
			}
			return &models.Capability{ID: id, Name: "test-cap"}, nil
		},
	})
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "cap-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Get_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(ctx context.Context, _, _ string) (*models.Capability, error) {
			return nil, errors.New("capability not found")
		},
	})
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "nonexistent"}, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// --- Update ---

func TestHandler_Update_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		updateFn: func(ctx context.Context, tenantID, id string, req models.UpdateCapabilityRequest) (*models.Capability, error) {
			return &models.Capability{ID: id, Name: "updated"}, nil
		},
	})
	w := performRequest(h, h.Update, "PUT", map[string]interface{}{"name": "updated"}, map[string]string{"id": "cap-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Update_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.Update, "PUT", "invalid json", map[string]string{"id": "cap-1"}, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// --- Delete ---

func TestHandler_Delete_Success(t *testing.T) {
	var called bool
	h := newHandlerWithSvc(&mockSvc{
		deleteFn: func(ctx context.Context, tenantID, id string) error {
			called = true
			if tenantID != "test-tenant" {
				t.Errorf("expected test-tenant, got %s", tenantID)
			}
			return nil
		},
	})
	w := performRequest(h, h.Delete, "DELETE", nil, map[string]string{"id": "cap-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !called {
		t.Error("expected delete to be called")
	}
}

// --- GetTree ---

func TestHandler_GetTree_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getTreeFn: func(ctx context.Context, tenantID string) ([]models.Capability, error) {
			return []models.Capability{{ID: "root", Name: "root-cap"}}, nil
		},
	})
	w := performRequest(h, h.GetTree, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetTree_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getTreeFn: func(ctx context.Context, _ string) ([]models.Capability, error) {
			return nil, errors.New("db error")
		},
	})
	w := performRequest(h, h.GetTree, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// --- GrantToRole ---

func TestHandler_GrantToRole_Success(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "test-tenant")
	c.Set("user_id", "user-1")
	c.Params = append(c.Params, gin.Param{Key: "id", Value: "cap-1"})

	body := map[string]interface{}{"role_name": "admin"}
	b, _ := json.Marshal(body)
	c.Request = httptest.NewRequest("POST", "/", bytes.NewBuffer(b))
	c.Request.Header.Set("Content-Type", "application/json")

	var capturedRole string
	h := newHandlerWithSvc(&mockSvc{
		grantToRoleFn: func(ctx context.Context, _, capID, roleName, grantedBy string) error {
			capturedRole = roleName
			return nil
		},
	})
	h.GrantToRole(c)

	if c.Writer.Status() != http.StatusCreated {
		t.Errorf("expected 201, got %d", c.Writer.Status())
	}
	if capturedRole != "admin" {
		t.Errorf("expected role 'admin', got %s", capturedRole)
	}
}

// --- CheckPermission ---

func TestHandler_CheckPermission_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		checkPermissionFn: func(ctx context.Context, tenantID string, req models.CheckPermissionRequest) (*models.CheckPermissionResult, error) {
			return &models.CheckPermissionResult{Allowed: true}, nil
		},
	})
	w := performRequest(h, h.CheckPermission, "POST", map[string]interface{}{
		"user_id":       "user-1",
		"capability_id": "cap-1",
	}, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_CheckPermission_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.CheckPermission, "POST", map[string]interface{}{}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// --- GetEffectiveCapabilities ---

func TestHandler_GetEffectiveCapabilities_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getEffectiveFn: func(ctx context.Context, tenantID, userID string, roles []string) ([]string, error) {
			return []string{"cap-1", "cap-2"}, nil
		},
	})
	w := performRequest(h, h.GetEffectiveCapabilities, "GET", nil, nil, map[string]string{"user_id": "user-1"})
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}
