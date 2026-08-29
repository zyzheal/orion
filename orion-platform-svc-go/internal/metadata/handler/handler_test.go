package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/metadata/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/metadata/models"
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

func (f *fakeHandlerService) BatchCreate(ctx context.Context, tenantID string) error {
	return nil
}

func (f *fakeHandlerService) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return &models.Record{}, nil
}

func (f *fakeHandlerService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return &models.Record{}, nil
}

func (f *fakeHandlerService) GetStats(ctx context.Context, tenantID string) (gin.H, error) {
	return gin.H{}, nil
}

func (f *fakeHandlerService) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return []models.Record{}, nil
}

func (f *fakeHandlerService) Search(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return &models.Record{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)

func TestHandler_METADATA_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_METADATA_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestHandler_METADATA_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestHandler_METADATA_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestHandler_METADATA_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestHandler_METADATA_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}

func TestHandler_METADATA_BatchCreate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().BatchCreate(c)
	if w.Code >= 500 {
		t.Fatalf("BatchCreate: got %d", w.Code)
	}
}

func TestHandler_METADATA_Search(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Search(c)
	if w.Code >= 500 {
		t.Fatalf("Search: got %d", w.Code)
	}
}

func TestHandler_METADATA_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
