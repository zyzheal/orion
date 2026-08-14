package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/secret/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/secret/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeHandlerService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeHandlerService struct{}

func (f *fakeHandlerService) Create(ctx context.Context, tenantID, userID string, req *models.CreateSecretRequest) (*service.SecretListItem, error) {
	return &service.SecretListItem{}, nil
}

func (f *fakeHandlerService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeHandlerService) Get(ctx context.Context, id string, tenantID string) (*service.SecretListItem, error) {
	return &service.SecretListItem{}, nil
}

func (f *fakeHandlerService) GetByName(ctx context.Context, tenantID, name, scope string) (*service.SecretListItem, error) {
	return &service.SecretListItem{}, nil
}

func (f *fakeHandlerService) GetReferences(ctx context.Context, id string, tenantID string) (*models.Secret, error) {
	return &models.Secret{}, nil
}

func (f *fakeHandlerService) List(ctx context.Context, tenantID string, filter *models.ListFilter) ([]service.SecretListItem, error) {
	return []service.SecretListItem{}, nil
}

func (f *fakeHandlerService) Resolve(ctx context.Context, tenantID string, req *models.ResolveSecretsRequest) (*models.ResolveSecretsResult, error) {
	return &models.ResolveSecretsResult{}, nil
}

func (f *fakeHandlerService) Update(ctx context.Context, tenantID, id string, req *models.UpdateSecretRequest) (*service.SecretListItem, error) {
	return &service.SecretListItem{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)


func TestHandler_SECRET_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SECRET_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_SECRET_getUserID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getUserID(c)
	if w.Code >= 500 {
		t.Fatalf("getUserID: got %d", w.Code)
	}
}
func TestHandler_SECRET_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_SECRET_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_SECRET_Resolve(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Resolve(c)
	if w.Code >= 500 {
		t.Fatalf("Resolve: got %d", w.Code)
	}
}
func TestHandler_SECRET_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_SECRET_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_SECRET_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_SECRET_GetReferences(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetReferences(c)
	if w.Code >= 500 {
		t.Fatalf("GetReferences: got %d", w.Code)
	}
}
