package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/tenant/models"
	"orion/platform-svc-go/internal/tenant/service"

	"github.com/gin-gonic/gin"
)

type mockTenantRepo struct {
	dbErr            error
	listTenants      []map[string]any
	listTenantsTotal int
	getTenant        *map[string]any
	getTenantErr     error
	createErr        error
	updateErr        error
	deleteErr        error
	count            int
	poolStatus       *map[string]any
	quota            *map[string]any
	quotaErr         error
	namespaces       []map[string]any
	userTenants      []map[string]any
	listUsers        []map[string]any
	invitePending    *map[string]any
	inviteInfo       *map[string]any
	inviteErr        error
	adminCount       int
}

func newMockRepo() *mockTenantRepo {
	return &mockTenantRepo{
		listTenants: make([]map[string]any, 0),
		listUsers:   make([]map[string]any, 0),
		userTenants: make([]map[string]any, 0),
		namespaces:  make([]map[string]any, 0),
	}
}

func (m *mockTenantRepo) ListTenants(_ context.Context, status *string, limit, offset int) ([]map[string]any, int, error) {
	return m.listTenants, m.listTenantsTotal, m.dbErr
}
func (m *mockTenantRepo) GetTenantRow(_ context.Context, _ string) (*map[string]any, error) {
	return m.getTenant, m.getTenantErr
}
func (m *mockTenantRepo) GetTenantByRow(_ context.Context, _ string) (*map[string]any, error) {
	return m.getTenant, m.getTenantErr
}
func (m *mockTenantRepo) CreateTenant(_ context.Context, _ string, _ *string, _, _ string) (*int, error) {
	if m.createErr != nil {
		return nil, m.createErr
	}
	id := 1
	return &id, nil
}
func (m *mockTenantRepo) UpdateTenant(_ context.Context, _ string, _ *string, _ *string, _ *string, _ string) error {
	return m.updateErr
}
func (m *mockTenantRepo) DeleteTenant(_ context.Context, _ string) error { return m.deleteErr }
func (m *mockTenantRepo) TenantCount(_ context.Context, _ *string) (int, error) {
	return m.count, m.dbErr
}
func (m *mockTenantRepo) GetQuota(_ context.Context, _ int, _ string) (*map[string]any, error) {
	return m.quota, m.quotaErr
}
func (m *mockTenantRepo) UpsertQuota(_ context.Context, _ int, _ string, _ *models.TenantQuota) error {
	return m.dbErr
}
func (m *mockTenantRepo) PoolStatus(_ context.Context) (*map[string]any, error) {
	return m.poolStatus, m.dbErr
}
func (m *mockTenantRepo) AllocateNamespace(_ context.Context, _ int, _, _ string) error {
	return m.dbErr
}
func (m *mockTenantRepo) ReleaseNamespace(_ context.Context, _ string) error { return m.dbErr }
func (m *mockTenantRepo) GetTenantNamespaces(_ context.Context, _ string) ([]map[string]any, error) {
	return m.namespaces, m.dbErr
}
func (m *mockTenantRepo) NamespaceCount(_ context.Context, _ string) (int, error) {
	return len(m.namespaces), m.dbErr
}
func (m *mockTenantRepo) MigrateUserToTenant(_ context.Context, _ int, _ string) error {
	return m.dbErr
}
func (m *mockTenantRepo) RemoveTenantUser(_ context.Context, _, _ string) error { return m.dbErr }
func (m *mockTenantRepo) CountTenantAdmins(_ context.Context, _ string) (int, error) {
	return m.adminCount, m.dbErr
}
func (m *mockTenantRepo) GetUserTenants(_ context.Context, _ string) ([]map[string]any, error) {
	return m.userTenants, m.dbErr
}
func (m *mockTenantRepo) ListTenantUsers(_ context.Context, _ string) ([]map[string]any, error) {
	return m.listUsers, m.dbErr
}
func (m *mockTenantRepo) AddTenantUser(_ context.Context, _, _, _ string) error { return m.dbErr }
func (m *mockTenantRepo) GetPendingInvite(_ context.Context, _, _ string) (*map[string]any, error) {
	return m.invitePending, m.inviteErr
}
func (m *mockTenantRepo) GetTenantUserByEmail(_ context.Context, _, _ string) (bool, error) {
	return false, m.inviteErr
}
func (m *mockTenantRepo) CreateInvite(_ context.Context, _, _, _, _, _, _ string) (*map[string]any, error) {
	return m.inviteInfo, m.inviteErr
}
func (m *mockTenantRepo) GetInviteByCode(_ context.Context, _ string) (*map[string]any, error) {
	return m.inviteInfo, m.inviteErr
}
func (m *mockTenantRepo) UpdateInviteStatus(_ context.Context, _, _, _ string) error { return m.dbErr }
func (m *mockTenantRepo) UserIsTenantMember(_ context.Context, _, _ string) (bool, error) {
	return false, m.dbErr
}
func (m *mockTenantRepo) MoveNamespaces(_ context.Context, _ int, _ string, _ int) error {
	return m.dbErr
}
func (m *mockTenantRepo) MovePipeline(_ context.Context, _ int, _ string, _ int) error {
	return m.dbErr
}
func (m *mockTenantRepo) GetTenantQuotaAlerts(_ context.Context, tenantID string, status *string, limit, offset int) ([]map[string]any, int, error) {
	return nil, 0, m.dbErr
}
func (m *mockTenantRepo) GetAlertStatusCounts(_ context.Context, _ string) ([]map[string]any, error) {
	return nil, m.dbErr
}
func (m *mockTenantRepo) GetAlertResourceCounts(_ context.Context, _ string) ([]map[string]any, error) {
	return nil, m.dbErr
}
func (m *mockTenantRepo) GetActiveAlerts(_ context.Context, _ string, _ int) ([]map[string]any, error) {
	return nil, m.dbErr
}

func newHandlerWithSvc(svc *service.Service) *Handler { return NewHandler(svc) }

func performRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "1")
	c.Set("user_id", "user-1")
	var buf bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = *bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, "/", &buf)
	c.Request.Header.Set("Content-Type", "application/json")
	if pathParams != nil {
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

func TestHandler_List_Success(t *testing.T) {
	repo := newMockRepo()
	repo.listTenants = []map[string]any{{"id": 1, "name": "acme", "status": "active"}}
	repo.listTenantsTotal = 1
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.List, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Create_Success(t *testing.T) {
	repo := newMockRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Create, "POST", models.CreateTenantRequest{Name: "acme"}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
}

func TestHandler_Get_Success(t *testing.T) {
	repo := newMockRepo()
	tenant := map[string]any{"id": 1, "name": "acme"}
	repo.getTenant = &tenant
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Get_NotFound(t *testing.T) {
	repo := newMockRepo()
	repo.getTenant = nil
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "999"}, nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestHandler_Delete_Success(t *testing.T) {
	repo := newMockRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Delete, "DELETE", nil, map[string]string{"id": "1"}, nil)
	if w.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", w.Code)
	}
}

func TestHandler_Update_ServiceError(t *testing.T) {
	repo := newMockRepo()
	repo.updateErr = errors.New("db error")
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Update, "PUT", map[string]interface{}{"name": "updated"}, map[string]string{"id": "1"}, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

func TestHandler_GetCurrent_Success(t *testing.T) {
	repo := newMockRepo()
	tenant := map[string]any{"id": 1, "name": "acme"}
	repo.getTenant = &tenant
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetCurrent, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetQuota_Success(t *testing.T) {
	repo := newMockRepo()
	quota := map[string]any{"max_pipelines": 100}
	repo.quota = &quota
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetQuota, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Invite_Success(t *testing.T) {
	repo := newMockRepo()
	tenant := map[string]any{"id": 1, "name": "acme", "display_name": "acme"}
	repo.getTenant = &tenant
	info := map[string]any{"invite_code": "abc123", "email": "a@b.com", "role": "member", "status": "pending", "display_name": "acme", "name": "acme", "id": 1}
	repo.inviteInfo = &info
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Invite, "POST", models.InviteRequest{Email: "a@b.com", Role: "admin"}, map[string]string{"id": "1"}, nil)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
}

func TestHandler_Invite_UserAlreadyMember(t *testing.T) {
	repo := newMockRepo()
	tenant := map[string]any{"id": 1, "name": "acme", "display_name": "acme"}
	repo.getTenant = &tenant
	info := map[string]any{}
	repo.inviteInfo = &info
	repo.inviteErr = service.ErrUserAlreadyMember
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Invite, "POST", models.InviteRequest{Email: "a@b.com", Role: "admin"}, map[string]string{"id": "1"}, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandler_GetMiddlewareConfig(t *testing.T) {
	repo := newMockRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetMiddlewareConfig, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ListUsers_Success(t *testing.T) {
	repo := newMockRepo()
	repo.listUsers = []map[string]any{{"id": "u1", "role": "admin"}}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.ListUsers, "GET", nil, map[string]string{"id": "1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_AlertStats_Success(t *testing.T) {
	repo := newMockRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.AlertStats, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}
