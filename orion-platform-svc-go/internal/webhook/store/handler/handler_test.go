package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/webhook/store/models"
	"orion/platform-svc-go/internal/webhook/store/service"

	"github.com/gin-gonic/gin"
	"context"
)

func newHandler() *Handler {
	return NewHandler(&fakeStoreService{})
}

func makeCtx(method string, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, path, &buf)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{}
	for k, v := range params {
		c.Params = append(c.Params, gin.Param{Key: k, Value: v})
	}
	return c, w
}

<<<<<<< Updated upstream
type fakeStoreService struct{}

func (f *fakeStoreService) Create(ctx context.Context, tenantID, domain string, req *models.CreateConfigEntryRequest) (*models.ConfigEntry, error) {
	return &models.ConfigEntry{}, nil
}

func (f *fakeStoreService) Get(ctx context.Context, tenantID, id string) (*models.ConfigEntry, error) {
	return &models.ConfigEntry{}, nil
}

func (f *fakeStoreService) ListByDomain(ctx context.Context, tenantID, domain string) ([]models.ConfigEntry, error) {
	return []models.ConfigEntry{}, nil
}

func (f *fakeStoreService) ListAll(ctx context.Context, tenantID string) ([]models.ConfigEntry, error) {
	return []models.ConfigEntry{}, nil
}

func (f *fakeStoreService) Update(ctx context.Context, tenantID, id string, req *models.UpdateConfigEntryRequest) (*models.ConfigEntry, error) {
	return &models.ConfigEntry{}, nil
}

func (f *fakeStoreService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

var _ service.ServiceInterface = (*fakeStoreService)(nil)
=======
type fakestoreService struct{}

func (f *fakestoreService) Create(ctx context.Context, tenantID, domain string, req *models.CreateConfigEntryRequest) ((*models.ConfigEntry, error)) {
	return &models.ConfigEntry{}, nil
}

func (f *fakestoreService) Get(ctx context.Context, tenantID, id string) ((*models.ConfigEntry, error)) {
	return &models.ConfigEntry{}, nil
}

func (f *fakestoreService) ListByDomain(ctx context.Context, tenantID, domain string) (([]models.ConfigEntry, error)) {
	return []models.ConfigEntry{}, nil
}

func (f *fakestoreService) ListAll(ctx context.Context, tenantID string) (([]models.ConfigEntry, error)) {
	return []models.ConfigEntry{}, nil
}

func (f *fakestoreService) Update(ctx context.Context, tenantID, id string, req *models.UpdateConfigEntryRequest) ((*models.ConfigEntry, error)) {
	return &models.ConfigEntry{}, nil
}

func (f *fakestoreService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

var _ service.ServiceInterface = (*fakestoreService)(nil)
>>>>>>> Stashed changes


func TestHandler_WEBHOOK_STORE_NewHandler(t *testing.T) {
	h := newHandler()
	if h == nil {
		t.Fatal("expected non-nil handler")
	}
}

func TestHandler_WEBHOOK_STORE_RegisterRoutes(t *testing.T) {
	r := gin.New()
	newHandler().RegisterRoutes(r.Group("/api/v1"))
	if r == nil {
		t.Fatal("router should not be nil")
	}
}

func TestHandler_WEBHOOK_STORE_getTenantID_FromContext(t *testing.T) {
	h := newHandler()
	c, _ := makeCtx(http.MethodGet, "/", nil, nil)
	c.Set("tenant_id", "tenant-42")
	tid := h.getTenantID(c)
	if tid != "tenant-42" {
		t.Errorf("expected tenant-42, got %s", tid)
	}
}

func TestHandler_WEBHOOK_STORE_getTenantID_Default(t *testing.T) {
	h := newHandler()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	// do NOT set tenant_id to test the default fallback
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	c.Request.Header.Set("Content-Type", "application/json")
	tid := h.getTenantID(c)
	if tid != "00000000-0000-0000-0000-000000000000" {
		t.Errorf("expected default tenant, got %s", tid)
	}
}

func TestHandler_WEBHOOK_STORE_Create(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/webhook-config/auth", models.CreateConfigEntryRequest{
		Name: "key", Value: "val", Enabled: true,
	}, map[string]string{"domain": "auth"})
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestHandler_WEBHOOK_STORE_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/webhook-config/auth/entry-1", nil,
		map[string]string{"domain": "auth", "id": "entry-1"})
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestHandler_WEBHOOK_STORE_ListByDomain(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/webhook-config/auth", nil,
		map[string]string{"domain": "auth"})
	newHandler().ListByDomain(c)
	if w.Code >= 500 {
		t.Fatalf("ListByDomain: got %d", w.Code)
	}
}

func TestHandler_WEBHOOK_STORE_Update(t *testing.T) {
	newName := "updated"
	c, w := makeCtx(http.MethodPut, "/webhook-config/auth/entry-1", models.UpdateConfigEntryRequest{
		Name: &newName,
	}, map[string]string{"domain": "auth", "id": "entry-1"})
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestHandler_WEBHOOK_STORE_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodDelete, "/webhook-config/auth/entry-1", nil,
		map[string]string{"domain": "auth", "id": "entry-1"})
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
