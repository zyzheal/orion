package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/hook-chain/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/hook-chain/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeHook_chainService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeHook_chainService struct{}

func (f *fakeHook_chainService) Count(ctx context.Context, tenantID string) (int, error) {
	return 0, nil
}

func (f *fakeHook_chainService) Create(ctx context.Context, tenantID, userID string, req *models.CreateHookRequest) (*models.Hook, error) {
	return &models.Hook{}, nil
}

func (f *fakeHook_chainService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHook_chainService) GetByID(ctx context.Context, tenantID, id string) (*models.Hook, error) {
	return &models.Hook{}, nil
}

func (f *fakeHook_chainService) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Hook, error) {
	return []models.Hook{}, nil
}

func (f *fakeHook_chainService) Update(ctx context.Context, tenantID, id string, req *models.UpdateHookRequest) (*models.Hook, error) {
	return &models.Hook{}, nil
}

var _ service.ServiceInterface = (*fakeHook_chainService)(nil)

func TestHandler_HOOK_CHAIN_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_HOOK_CHAIN_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_HOOK_CHAIN_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_HOOK_CHAIN_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_HOOK_CHAIN_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_HOOK_CHAIN_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_HOOK_CHAIN_Count(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Count(c)
	if w.Code >= 500 {
		t.Fatalf("Count: got %d", w.Code)
	}
}
