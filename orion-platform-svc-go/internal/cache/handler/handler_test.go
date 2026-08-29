package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/cache/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/cache/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeCacheService{})
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

type fakeCacheService struct{}

func (f *fakeCacheService) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.CacheEntry, error) {
	return &models.CacheEntry{}, nil
}

func (f *fakeCacheService) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeCacheService) Get(ctx context.Context, id, tenantID string) (*models.CacheEntry, error) {
	return &models.CacheEntry{}, nil
}

func (f *fakeCacheService) List(ctx context.Context, tenantID string) ([]models.CacheEntry, error) {
	return []models.CacheEntry{}, nil
}

func (f *fakeCacheService) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.CacheEntry, error) {
	return &models.CacheEntry{}, nil
}

var _ service.ServiceInterface = (*fakeCacheService)(nil)

func TestCACHE_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCACHE_Handler_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestCACHE_Handler_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestCACHE_Handler_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestCACHE_Handler_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestCACHE_Handler_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestCACHE_Handler_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
