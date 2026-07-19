package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/abac-policy/models"

	"github.com/gin-gonic/gin"
)

// --- mock Service (implements handler's Service interface) ---

type mockABACService struct {
	listFn   func(ctx context.Context, tenantID string, filter *models.ABACPolicyFilter) (res []models.ABACPolicy, total int, err error)
	createFn func(ctx context.Context, tenantID string, req *models.CreateABACPolicyRequest) (*models.ABACPolicy, error)
	getFn    func(ctx context.Context, tenantID, id string) (*models.ABACPolicy, error)
	updateFn func(ctx context.Context, tenantID, id string, req *models.UpdateABACPolicyRequest) (*models.ABACPolicy, error)
	deleteFn func(ctx context.Context, tenantID, id string) (bool, error)
}

func (m *mockABACService) List(ctx context.Context, tenantID string, filter *models.ABACPolicyFilter) ([]models.ABACPolicy, int, error) {
	if m.listFn != nil { return m.listFn(ctx, tenantID, filter) }
	return nil, 0, nil
}
func (m *mockABACService) Create(ctx context.Context, tenantID string, req *models.CreateABACPolicyRequest) (*models.ABACPolicy, error) {
	if m.createFn != nil { return m.createFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockABACService) GetByID(ctx context.Context, tenantID, id string) (*models.ABACPolicy, error) {
	if m.getFn != nil { return m.getFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockABACService) Update(ctx context.Context, tenantID, id string, req *models.UpdateABACPolicyRequest) (*models.ABACPolicy, error) {
	if m.updateFn != nil { return m.updateFn(ctx, tenantID, id, req) }
	return nil, nil
}
func (m *mockABACService) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	if m.deleteFn != nil { return m.deleteFn(ctx, tenantID, id) }
	return false, nil
}

func makePolicy(id string) *models.ABACPolicy {
	return &models.ABACPolicy{ID: id, Name: "p1", Status: "active"}
}

func makeReq() models.CreateABACPolicyRequest {
	return models.CreateABACPolicyRequest{Name: "x", ResourceType: "r", Action: "read", Effect: "allow"}
}

// === helpers ===

func policyRequest(method string, body interface{}, params map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	if body != nil { json.NewEncoder(buf).Encode(body) }
	c.Request = httptest.NewRequest(method, "/", buf)
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params { c.Params = append(c.Params, gin.Param{Key: k, Value: v}) }
	}
	return w
}

func newHandlerWithSvc(svc Service) *Handler { return NewHandler(svc.(*service.Service)) }

func TestHandlerABAC_InterfaceImplementsService(t *testing.T) {
	var svc Service = &mockABACService{}
	_ = svc
}

func TestHandlerABAC_RegisterRoutes(t *testing.T) {
	svc := &mockABACService{}
	NewHandler(svc.(*service.Service)).RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestHandlerABAC_ListPolicies_Success(t *testing.T) {
	svc := &mockABACService{listFn: func(_ context.Context, _ string, _ *models.ABACPolicyFilter) ([]models.ABACPolicy, int, error) {
		return []models.ABACPolicy{{ID: "p1"}}, 1, nil
	}}
	h := NewHandler(svc.(*service.Service))
	w := policyRequest("GET", nil, nil)
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	h.ListPolicies(c)
	if w.Code != http.StatusOK { t.Errorf("ListPolicies: got %d", w.Code) }
}

func TestHandlerABAC_ListPolicies_Error(t *testing.T) {
	svc := &mockABACService{listFn: func(_ context.Context, _ string, _ *models.ABACPolicyFilter) ([]models.ABACPolicy, int, error) {
		return nil, 0, errors.New("db")
	}}
	h := NewHandler(svc.(*service.Service))
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	h.ListPolicies(c)
	if w.Code != http.StatusInternalServerError { t.Errorf("ListPolicies error: got %d", w.Code) }
}

func TestHandlerABAC_CreatePolicy_Success(t *testing.T) {
	svc := &mockABACService{createFn: func(_ context.Context, _ string, _ *models.CreateABACPolicyRequest) (*models.ABACPolicy, error) {
		return makePolicy("p1"), nil
	}}
	h := NewHandler(svc.(*service.Service))
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	json.NewEncoder(buf).Encode(makeReq())
	c.Request = httptest.NewRequest(http.MethodPost, "/", buf)
	h.CreatePolicy(c)
	if w.Code != http.StatusCreated { t.Errorf("CreatePolicy: got %d", w.Code) }
}

func TestHandlerABAC_CreatePolicy_BadRequest(t *testing.T) {
	svc := &mockABACService{}
	h := NewHandler(svc.(*service.Service))
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewBuffer([]byte("{}")))
	h.CreatePolicy(c)
	if w.Code != http.StatusBadRequest { t.Errorf("CreatePolicy badreq: got %d", w.Code) }
}

func TestHandlerABAC_GetPolicy_Success(t *testing.T) {
	svc := &mockABACService{getFn: func(_ context.Context, _, id string) (*models.ABACPolicy, error) {
		return makePolicy(id), nil
	}}
	h := NewHandler(svc.(*service.Service))
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{gin.Param{Key: "id", Value: "p1"}}
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	h.GetPolicy(c)
	if w.Code != http.StatusOK { t.Errorf("GetPolicy: got %d", w.Code) }
}

func TestHandlerABAC_GetPolicy_NotFound(t *testing.T) {
	svc := &mockABACService{getFn: func(_ context.Context, _, _ string) (*models.ABACPolicy, error) {
		return nil, errors.New("not found")
	}}
	h := NewHandler(svc.(*service.Service))
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{gin.Param{Key: "id", Value: "x"}}
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	h.GetPolicy(c)
	if w.Code != http.StatusNotFound { t.Errorf("GetPolicy nf: got %d", w.Code) }
}

func TestHandlerABAC_UpdatePolicy_Success(t *testing.T) {
	svc := &mockABACService{updateFn: func(_ context.Context, _, id string, _ *models.UpdateABACPolicyRequest) (*models.ABACPolicy, error) {
		return makePolicy(id), nil
	}}
	h := NewHandler(svc.(*service.Service))
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{gin.Param{Key: "id", Value: "p1"}}
	buf := new(bytes.Buffer)
	json.NewEncoder(buf).Encode(models.UpdateABACPolicyRequest{})
	c.Request = httptest.NewRequest(http.MethodPut, "/", buf)
	h.UpdatePolicy(c)
	if w.Code != http.StatusOK { t.Errorf("UpdatePolicy: got %d", w.Code) }
}

func TestHandlerABAC_DeletePolicy_Success(t *testing.T) {
	svc := &mockABACService{deleteFn: func(_ context.Context, _, _ string) (bool, error) {
		return true, nil
	}}
	h := NewHandler(svc.(*service.Service))
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{gin.Param{Key: "id", Value: "p1"}}
	c.Request = httptest.NewRequest(http.MethodDelete, "/", nil)
	h.DeletePolicy(c)
	if w.Code != http.StatusOK { t.Errorf("DeletePolicy: got %d", w.Code) }
}

func TestHandlerABAC_DeletePolicy_NotFound(t *testing.T) {
	svc := &mockABACService{deleteFn: func(_ context.Context, _, _ string) (bool, error) {
		return false, nil
	}}
	h := NewHandler(svc.(*service.Service))
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{gin.Param{Key: "id", Value: "p1"}}
	c.Request = httptest.NewRequest(http.MethodDelete, "/", nil)
	h.DeletePolicy(c)
	if w.Code != http.StatusNotFound { t.Errorf("DeletePolicy nf: got %d", w.Code) }
}
