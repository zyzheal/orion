package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/health-check/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/health-check/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeHealth_checkService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeHealth_checkService struct{}

func (f *fakeHealth_checkService) Create(ctx context.Context, tenantID string, req models.CreateHealthCheckRequest) (string, error) {
	return "", nil
}

func (f *fakeHealth_checkService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHealth_checkService) ExecuteAll(ctx context.Context, tenantID string) (*models.HealthCheckResult, error) {
	return &models.HealthCheckResult{}, nil
}

func (f *fakeHealth_checkService) ExecuteCheck(ctx context.Context, tenantID, id string, req models.ExecuteHealthCheckRequest) (*models.HealthCheckResult, error) {
	return &models.HealthCheckResult{}, nil
}

func (f *fakeHealth_checkService) Get(ctx context.Context, tenantID, id string) (*models.HealthCheck, error) {
	return &models.HealthCheck{}, nil
}

func (f *fakeHealth_checkService) List(ctx context.Context, tenantID string) ([]models.HealthCheck, error) {
	return []models.HealthCheck{}, nil
}

func (f *fakeHealth_checkService) QuickCheck(ctx context.Context, req models.QuickHealthCheckRequest) (*models.HealthCheckResult, error) {
	return &models.HealthCheckResult{}, nil
}

func (f *fakeHealth_checkService) Update(ctx context.Context, tenantID, id string, req models.CreateHealthCheckRequest) error {
	return nil
}

var _ service.ServiceInterface = (*fakeHealth_checkService)(nil)


func TestHandler_HEALTH_CHECK_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_HEALTH_CHECK_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_HEALTH_CHECK_ListChecks(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListChecks(c)
	if w.Code >= 500 {
		t.Fatalf("ListChecks: got %d", w.Code)
	}
}
func TestHandler_HEALTH_CHECK_GetCheck(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCheck(c)
	if w.Code >= 500 {
		t.Fatalf("GetCheck: got %d", w.Code)
	}
}
func TestHandler_HEALTH_CHECK_CreateCheck(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateCheck(c)
	if w.Code >= 500 {
		t.Fatalf("CreateCheck: got %d", w.Code)
	}
}
func TestHandler_HEALTH_CHECK_UpdateCheck(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateCheck(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateCheck: got %d", w.Code)
	}
}
func TestHandler_HEALTH_CHECK_DeleteCheck(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteCheck(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteCheck: got %d", w.Code)
	}
}
func TestHandler_HEALTH_CHECK_ExecuteCheck(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExecuteCheck(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteCheck: got %d", w.Code)
	}
}
func TestHandler_HEALTH_CHECK_ExecuteAll(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExecuteAll(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteAll: got %d", w.Code)
	}
}
func TestHandler_HEALTH_CHECK_QuickCheck(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().QuickCheck(c)
	if w.Code >= 500 {
		t.Fatalf("QuickCheck: got %d", w.Code)
	}
}
