package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/abac-policy/models"
	"orion/platform-svc-go/internal/abac-policy/service"

	"github.com/gin-gonic/gin"
	"context"
)

func makeHandler() *Handler {
	return NewHandler(&fakeHandlerService{})
}

type fakeHandlerService struct{}

func (f *fakeHandlerService) Create(ctx context.Context, tenantID string, req *models.CreateABACPolicyRequest) (*models.ABACPolicy, error) {
	return &models.ABACPolicy{}, nil
}

func (f *fakeHandlerService) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

func (f *fakeHandlerService) GetByID(ctx context.Context, tenantID, id string) (*models.ABACPolicy, error) {
	return &models.ABACPolicy{}, nil
}

func (f *fakeHandlerService) List(ctx context.Context, tenantID string, filter *models.ABACPolicyFilter) ([]models.ABACPolicy, int, error) {
	return []models.ABACPolicy{}, 0, nil
}

func (f *fakeHandlerService) Update(ctx context.Context, tenantID, id string, req *models.UpdateABACPolicyRequest) (*models.ABACPolicy, error) {
	return &models.ABACPolicy{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)


func strPtr(s string) *string {
	return &s
}

func makeCtx(method string, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, path, buf)
	c.Params = gin.Params{}
	for k, v := range params {
		c.Params = append(c.Params, gin.Param{Key: k, Value: v})
	}
	return c, w
}

func TestHandlerABAC_RegisterRoutes(t *testing.T) {
	makeHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestHandlerABAC_ListPolicies(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/abac-policy", nil, nil)
	makeHandler().ListPolicies(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListPolicies: got %d", w.Code)
	}
}

func TestHandlerABAC_CreatePolicy_Success(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/abac-policy", models.CreateABACPolicyRequest{
		Name: "test", ResourceType: "r", Action: "read", Effect: "allow",
	}, nil)
	makeHandler().CreatePolicy(c)
	if w.Code >= 500 {
		t.Fatalf("CreatePolicy: got server error %d", w.Code)
	}
}

func TestHandlerABAC_CreatePolicy_BadRequest(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/abac-policy", map[string]string{}, nil)
	makeHandler().CreatePolicy(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("CreatePolicy badreq: got %d", w.Code)
	}
}

func TestHandlerABAC_GetPolicy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/abac-policy/:id", nil, map[string]string{"id": "p1"})
	makeHandler().GetPolicy(c)
	if w.Code < 200 || w.Code >= 500 {
		t.Fatalf("GetPolicy: got %d", w.Code)
	}
}

func TestHandlerABAC_UpdatePolicy(t *testing.T) {
	c, w := makeCtx(http.MethodPut, "/abac-policy/:id", models.UpdateABACPolicyRequest{
		Name: strPtr("updated"),
	}, map[string]string{"id": "p1"})
	makeHandler().UpdatePolicy(c)
	if w.Code >= 500 {
		t.Fatalf("UpdatePolicy: got server error %d", w.Code)
	}
}

func TestHandlerABAC_DeletePolicy(t *testing.T) {
	c, w := makeCtx(http.MethodDelete, "/abac-policy/:id", nil, map[string]string{"id": "p1"})
	makeHandler().DeletePolicy(c)
	if w.Code >= 500 {
		t.Fatalf("DeletePolicy: got server error %d", w.Code)
	}
}
