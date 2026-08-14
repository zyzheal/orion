package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/vector-store/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/vector-store/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeVector_storeService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeVector_storeService struct{}

func (f *fakeVector_storeService) Create(ctx context.Context, tenantID string, req models.CreateVectorStoreRequest) (*models.VectorStore, error) {
	return &models.VectorStore{}, nil
}

func (f *fakeVector_storeService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeVector_storeService) Get(ctx context.Context, tenantID, id string) (*models.VectorStore, error) {
	return &models.VectorStore{}, nil
}

func (f *fakeVector_storeService) List(ctx context.Context, tenantID string) ([]models.VectorStore, error) {
	return []models.VectorStore{}, nil
}

func (f *fakeVector_storeService) Update(ctx context.Context, tenantID, id string, req models.UpdateVectorStoreRequest) (*models.VectorStore, error) {
	return &models.VectorStore{}, nil
}

var _ service.ServiceInterface = (*fakeVector_storeService)(nil)


func TestHandler_VECTOR_STORE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_VECTOR_STORE_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_VECTOR_STORE_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_VECTOR_STORE_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_VECTOR_STORE_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_VECTOR_STORE_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
