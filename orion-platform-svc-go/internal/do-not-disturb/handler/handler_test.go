package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/do-not-disturb/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/do-not-disturb/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeDo_not_disturbService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeDo_not_disturbService struct{}

func (f *fakeDo_not_disturbService) Create(ctx context.Context, tenantID, userID string, req *models.CreateDoNotDisturbRequest) (*models.DoNotDisturb, error) {
	return &models.DoNotDisturb{}, nil
}

func (f *fakeDo_not_disturbService) Get(ctx context.Context, tenantID, userID string) (*models.DoNotDisturb, error) {
	return &models.DoNotDisturb{}, nil
}

func (f *fakeDo_not_disturbService) IsActive(ctx context.Context, tenantID, userID string) (bool, error) {
	return false, nil
}

func (f *fakeDo_not_disturbService) Update(ctx context.Context, tenantID, userID string, req *models.UpdateDoNotDisturbRequest) (*models.DoNotDisturb, error) {
	return &models.DoNotDisturb{}, nil
}

var _ service.ServiceInterface = (*fakeDo_not_disturbService)(nil)

func TestHandler_DO_NOT_DISTURB_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DO_NOT_DISTU_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_DO_NOT_DISTU_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_DO_NOT_DISTU_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_DO_NOT_DISTU_IsActive(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().IsActive(c)
	if w.Code >= 500 {
		t.Fatalf("IsActive: got %d", w.Code)
	}
}
