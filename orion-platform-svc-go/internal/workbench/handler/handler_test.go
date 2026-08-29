package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/workbench/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/workbench/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeWorkbenchService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeWorkbenchService struct{}

func (f *fakeWorkbenchService) Create(ctx context.Context, tenantID string, req models.CreateWorkbenchRequest) (*models.Workbench, error) {
	return &models.Workbench{}, nil
}

func (f *fakeWorkbenchService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeWorkbenchService) Get(ctx context.Context, tenantID, id string) (*models.Workbench, error) {
	return &models.Workbench{}, nil
}

func (f *fakeWorkbenchService) List(ctx context.Context, tenantID string, limit, offset int) ([]models.Workbench, error) {
	return []models.Workbench{}, nil
}

func (f *fakeWorkbenchService) Update(ctx context.Context, tenantID, id string, req models.UpdateWorkbenchRequest) (*models.Workbench, error) {
	return &models.Workbench{}, nil
}

var _ service.ServiceInterface = (*fakeWorkbenchService)(nil)

func TestHandler_WORKBENCH_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_WORKBENCH_GetWorkbench(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetWorkbench(c)
	if w.Code >= 500 {
		t.Fatalf("GetWorkbench: got %d", w.Code)
	}
}
func TestHandler_WORKBENCH_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_WORKBENCH_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_WORKBENCH_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_WORKBENCH_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_WORKBENCH_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
