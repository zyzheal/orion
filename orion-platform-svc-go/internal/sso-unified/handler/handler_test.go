package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/sso-unified/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/sso-unified/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeSso_unifiedService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeSso_unifiedService struct{}

func (f *fakeSso_unifiedService) Create(ctx context.Context, tenantID string, req *models.CreateSSOConfigRequest) (*models.SSOConfig, error) {
	return &models.SSOConfig{}, nil
}

func (f *fakeSso_unifiedService) Delete(ctx context.Context, tenantID, provider string) (bool, error) {
	return false, nil
}

func (f *fakeSso_unifiedService) Get(ctx context.Context, tenantID, provider string) (*models.SSOConfig, error) {
	return &models.SSOConfig{}, nil
}

func (f *fakeSso_unifiedService) GetAll(ctx context.Context, tenantID string) ([]models.SSOConfig, error) {
	return []models.SSOConfig{}, nil
}

func (f *fakeSso_unifiedService) Update(ctx context.Context, tenantID, provider string, req *models.UpdateSSOConfigRequest) (*models.SSOConfig, error) {
	return &models.SSOConfig{}, nil
}

var _ service.ServiceInterface = (*fakeSso_unifiedService)(nil)


func TestHandler_SSO_UNIFIED_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SSO_UNIFIED_CreateConfig(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateConfig(c)
	if w.Code >= 500 {
		t.Fatalf("CreateConfig: got %d", w.Code)
	}
}
func TestHandler_SSO_UNIFIED_ListConfigs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListConfigs(c)
	if w.Code >= 500 {
		t.Fatalf("ListConfigs: got %d", w.Code)
	}
}
func TestHandler_SSO_UNIFIED_GetConfig(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetConfig(c)
	if w.Code >= 500 {
		t.Fatalf("GetConfig: got %d", w.Code)
	}
}
func TestHandler_SSO_UNIFIED_UpdateConfig(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateConfig(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateConfig: got %d", w.Code)
	}
}
func TestHandler_SSO_UNIFIED_DeleteConfig(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteConfig(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteConfig: got %d", w.Code)
	}
}
