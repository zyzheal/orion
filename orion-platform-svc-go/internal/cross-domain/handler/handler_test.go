package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/cross-domain/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/cross-domain/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeCross_domainService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeCross_domainService struct{}

func (f *fakeCross_domainService) Create(ctx context.Context, tenantID string, req *models.CreateCrossDomainRequest) (*models.CrossDomain, error) {
	return &models.CrossDomain{}, nil
}

func (f *fakeCross_domainService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeCross_domainService) Get(ctx context.Context, tenantID, id string) (*models.CrossDomain, error) {
	return &models.CrossDomain{}, nil
}

func (f *fakeCross_domainService) List(ctx context.Context, tenantID string) ([]models.CrossDomain, error) {
	return []models.CrossDomain{}, nil
}

func (f *fakeCross_domainService) Update(ctx context.Context, tenantID, id string, req *models.UpdateCrossDomainRequest) (*models.CrossDomain, error) {
	return &models.CrossDomain{}, nil
}

var _ service.ServiceInterface = (*fakeCross_domainService)(nil)


func TestHandler_CROSS_DOMAIN_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_CROSS_DOMAIN_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_CROSS_DOMAIN_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_CROSS_DOMAIN_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_CROSS_DOMAIN_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_CROSS_DOMAIN_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
