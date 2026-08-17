package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/sso-providers/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/sso-providers/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeSso_providersService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

<<<<<<< Updated upstream
type fakeSso_providersService struct{}

func (f *fakeSso_providersService) Create(ctx context.Context, tenantID string, req *models.CreateSSOProviderRequest) (*models.SSOProvider, error) {
	return &models.SSOProvider{}, nil
}

func (f *fakeSso_providersService) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

func (f *fakeSso_providersService) GetByID(ctx context.Context, tenantID, id string) (*models.SSOProvider, error) {
	return &models.SSOProvider{}, nil
}

func (f *fakeSso_providersService) List(ctx context.Context, tenantID string, filter *models.SSOProviderFilter) ([]models.SSOProvider, int, error) {
	return []models.SSOProvider{}, 0, nil
}

func (f *fakeSso_providersService) TestConnection(ctx context.Context, tenantID, id string) (bool, string, error) {
	return false, "", nil
}

func (f *fakeSso_providersService) Update(ctx context.Context, tenantID, id string, req *models.UpdateSSOProviderRequest) (*models.SSOProvider, error) {
	return &models.SSOProvider{}, nil
}

var _ service.ServiceInterface = (*fakeSso_providersService)(nil)
=======
type fakesso_providersService struct{}

func (f *fakesso_providersService) Create(ctx context.Context, tenantID string, req *models.CreateSSOProviderRequest) ((*models.SSOProvider, error)) {
	return &models.SSOProvider{}, nil
}

func (f *fakesso_providersService) Delete(ctx context.Context, tenantID, id string) ((bool, error)) {
	return false, nil
}

func (f *fakesso_providersService) GetByID(ctx context.Context, tenantID, id string) ((*models.SSOProvider, error)) {
	return &models.SSOProvider{}, nil
}

func (f *fakesso_providersService) List(ctx context.Context, tenantID string, filter *models.SSOProviderFilter) (([]models.SSOProvider, int, error)) {
	return []models.SSOProvider{}, 0, nil
}

func (f *fakesso_providersService) TestConnection(ctx context.Context, tenantID, id string) ((bool, string, error)) {
	return false, "", nil
}

func (f *fakesso_providersService) Update(ctx context.Context, tenantID, id string, req *models.UpdateSSOProviderRequest) ((*models.SSOProvider, error)) {
	return &models.SSOProvider{}, nil
}

var _ service.ServiceInterface = (*fakesso_providersService)(nil)
>>>>>>> Stashed changes


func TestHandler_SSO_PROVIDERS_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SSO_PROVIDER_CreateProvider(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateProvider(c)
	if w.Code >= 500 {
		t.Fatalf("CreateProvider: got %d", w.Code)
	}
}
func TestHandler_SSO_PROVIDER_GetProvider(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetProvider(c)
	if w.Code >= 500 {
		t.Fatalf("GetProvider: got %d", w.Code)
	}
}
func TestHandler_SSO_PROVIDER_ListProviders(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListProviders(c)
	if w.Code >= 500 {
		t.Fatalf("ListProviders: got %d", w.Code)
	}
}
func TestHandler_SSO_PROVIDER_UpdateProvider(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateProvider(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateProvider: got %d", w.Code)
	}
}
func TestHandler_SSO_PROVIDER_DeleteProvider(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteProvider(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteProvider: got %d", w.Code)
	}
}
func TestHandler_SSO_PROVIDER_TestConnection(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TestConnection(c)
	if w.Code >= 500 {
		t.Fatalf("TestConnection: got %d", w.Code)
	}
}
