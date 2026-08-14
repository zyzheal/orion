package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/sso/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/sso/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeSsoService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeSsoService struct{}

func (f *fakeSsoService) CreateProvider(ctx context.Context, tenantID string, provider *models.SSOProvider) (*models.SSOProvider, error) {
	return &models.SSOProvider{}, nil
}

func (f *fakeSsoService) GetProvider(ctx context.Context, tenantID, id string) (*models.SSOProvider, error) {
	return &models.SSOProvider{}, nil
}

func (f *fakeSsoService) HandleCallback(ctx context.Context, tenantID string, state string, userID string) (*models.SSOProvider, error) {
	return &models.SSOProvider{}, nil
}

func (f *fakeSsoService) InitiateLogin(ctx context.Context, tenantID string, req *models.SSOLoginRequest) (*models.SSOSession, error) {
	return &models.SSOSession{}, nil
}

func (f *fakeSsoService) ListProviders(ctx context.Context, tenantID string, q models.ListProvidersQuery) ([]models.SSOProvider, int, error) {
	return []models.SSOProvider{}, 0, nil
}

func (f *fakeSsoService) UpdateProvider(ctx context.Context, tenantID, id string, updates map[string]any) error {
	return nil
}

var _ service.ServiceInterface = (*fakeSsoService)(nil)


func TestHandler_SSO_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SSO_CreateProvider(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateProvider(c)
	if w.Code >= 500 {
		t.Fatalf("CreateProvider: got %d", w.Code)
	}
}
func TestHandler_SSO_GetProvider(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetProvider(c)
	if w.Code >= 500 {
		t.Fatalf("GetProvider: got %d", w.Code)
	}
}
func TestHandler_SSO_HandleCallback(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().HandleCallback(c)
	if w.Code >= 500 {
		t.Fatalf("HandleCallback: got %d", w.Code)
	}
}
func TestHandler_SSO_InitiateLogin(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().InitiateLogin(c)
	if w.Code >= 500 {
		t.Fatalf("InitiateLogin: got %d", w.Code)
	}
}
func TestHandler_SSO_ListProviders(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListProviders(c)
	if w.Code >= 500 {
		t.Fatalf("ListProviders: got %d", w.Code)
	}
}
func TestHandler_SSO_UpdateProvider(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateProvider(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateProvider: got %d", w.Code)
	}
}
