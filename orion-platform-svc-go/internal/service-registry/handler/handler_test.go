package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/service-registry/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/service-registry/models"
	"orion/platform-svc-go/internal/service-registry/repository"
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

func (f *fakeHandlerService) Deregister(ctx context.Context, tenantID, serviceID string) error {
	return nil
}

func (f *fakeHandlerService) GetByInternalID(ctx context.Context, tenantID, id string) (*models.ServiceRegistry, error) {
	return &models.ServiceRegistry{}, nil
}

func (f *fakeHandlerService) GetByServiceID(ctx context.Context, tenantID, serviceID string) (*models.ServiceRegistry, error) {
	return &models.ServiceRegistry{}, nil
}

func (f *fakeHandlerService) List(ctx context.Context, tenantID string, filters *repository.ListFilters) ([]models.ServiceRegistry, error) {
	return []models.ServiceRegistry{}, nil
}

func (f *fakeHandlerService) RecordHeartbeat(ctx context.Context, tenantID, serviceID string) error {
	return nil
}

func (f *fakeHandlerService) Register(ctx context.Context, tenantID string, req models.RegisterRequest) (*models.ServiceRegistry, error) {
	return &models.ServiceRegistry{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)

func TestHandler_SERVICE_REGIST_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SERVICE_REGI_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_SERVICE_REGI_Register(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Register(c)
	if w.Code >= 500 {
		t.Fatalf("Register: got %d", w.Code)
	}
}
func TestHandler_SERVICE_REGI_Deregister(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Deregister(c)
	if w.Code >= 500 {
		t.Fatalf("Deregister: got %d", w.Code)
	}
}
func TestHandler_SERVICE_REGI_Health(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Health(c)
	if w.Code >= 500 {
		t.Fatalf("Health: got %d", w.Code)
	}
}
func TestHandler_SERVICE_REGI_Heartbeat(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Heartbeat(c)
	if w.Code >= 500 {
		t.Fatalf("Heartbeat: got %d", w.Code)
	}
}
