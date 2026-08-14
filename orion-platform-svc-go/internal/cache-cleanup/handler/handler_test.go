package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/cache-cleanup/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/cache-cleanup/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeCache_cleanupService{})
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
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	return c, w
}

type fakeCache_cleanupService struct{}

func (f *fakeCache_cleanupService) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.CacheCleanup, error) {
	return &models.CacheCleanup{}, nil
}

func (f *fakeCache_cleanupService) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeCache_cleanupService) Get(ctx context.Context, id, tenantID string) (*models.CacheCleanup, error) {
	return &models.CacheCleanup{}, nil
}

func (f *fakeCache_cleanupService) List(ctx context.Context, tenantID string) ([]models.CacheCleanup, error) {
	return []models.CacheCleanup{}, nil
}

func (f *fakeCache_cleanupService) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.CacheCleanup, error) {
	return &models.CacheCleanup{}, nil
}

var _ service.ServiceInterface = (*fakeCache_cleanupService)(nil)


func TestCACHE_CLEANUP_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCACHE_CLEANUP_Handler_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestCACHE_CLEANUP_Handler_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestCACHE_CLEANUP_Handler_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestCACHE_CLEANUP_Handler_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestCACHE_CLEANUP_Handler_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestCACHE_CLEANUP_Handler_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
