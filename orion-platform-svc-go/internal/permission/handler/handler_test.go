package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/permission/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeHandler{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeHandler struct{}

func (f *fakeHandler) Create(ctx context.Context, tenantID, userID string, req *models.CreatePermissionRequest) (*models.Permission, error) {
	return &models.Permission{}, nil
}

func (f *fakeHandler) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Permission, error) {
	return []models.Permission{}, nil
}

func (f *fakeHandler) GetByID(ctx context.Context, tenantID, id string) (*models.Permission, error) {
	return &models.Permission{}, nil
}

func (f *fakeHandler) Update(ctx context.Context, tenantID, id string, req *models.UpdatePermissionRequest) (*models.Permission, error) {
	return &models.Permission{}, nil
}

func (f *fakeHandler) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandler) Count(ctx context.Context, tenantID string) (int, error) {
	return 0, nil
}

func TestHandler_PERMISSION_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PERMISSION_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_PERMISSION_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_PERMISSION_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_PERMISSION_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_PERMISSION_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_PERMISSION_Count(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Count(c)
	if w.Code >= 500 {
		t.Fatalf("Count: got %d", w.Code)
	}
}
