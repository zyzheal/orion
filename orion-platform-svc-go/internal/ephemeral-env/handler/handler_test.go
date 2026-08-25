package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ephemeral-env/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/ephemeral-env/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeEphemeral_envService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeEphemeral_envService struct{}

func (f *fakeEphemeral_envService) CreateEnv(ctx context.Context, tenantID string, req models.CreateEphemeralEnvRequest) (*models.EphemeralEnv, error) {
	return &models.EphemeralEnv{}, nil
}

func (f *fakeEphemeral_envService) DeleteEnv(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeEphemeral_envService) DestroyEnv(ctx context.Context, tenantID, id string) (*models.EphemeralEnv, error) {
	return &models.EphemeralEnv{}, nil
}

func (f *fakeEphemeral_envService) ExtendTTL(ctx context.Context, tenantID, id string, req models.ExtendTTLRequest) (*models.EphemeralEnv, error) {
	return &models.EphemeralEnv{}, nil
}

func (f *fakeEphemeral_envService) GetEnv(ctx context.Context, tenantID, id string) (*models.EphemeralEnv, error) {
	return &models.EphemeralEnv{}, nil
}

func (f *fakeEphemeral_envService) GetLogs(ctx context.Context, tenantID, envID string, limit int) ([]models.EnvLog, error) {
	return []models.EnvLog{}, nil
}

func (f *fakeEphemeral_envService) ListEnvs(ctx context.Context, tenantID string, limit, offset int) (*models.ListEnvsResponse, error) {
	return &models.ListEnvsResponse{}, nil
}

var _ service.ServiceInterface = (*fakeEphemeral_envService)(nil)


func TestHandler_EPHEMERAL_ENV_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_EPHEMERAL_EN_CreateEnv(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateEnv(c)
	if w.Code >= 500 {
		t.Fatalf("CreateEnv: got %d", w.Code)
	}
}
func TestHandler_EPHEMERAL_EN_DeleteEnv(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteEnv(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteEnv: got %d", w.Code)
	}
}
func TestHandler_EPHEMERAL_EN_DestroyEnv(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DestroyEnv(c)
	if w.Code >= 500 {
		t.Fatalf("DestroyEnv: got %d", w.Code)
	}
}
func TestHandler_EPHEMERAL_EN_ExtendTTL(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExtendTTL(c)
	if w.Code >= 500 {
		t.Fatalf("ExtendTTL: got %d", w.Code)
	}
}
func TestHandler_EPHEMERAL_EN_GetEnv(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEnv(c)
	if w.Code >= 500 {
		t.Fatalf("GetEnv: got %d", w.Code)
	}
}
func TestHandler_EPHEMERAL_EN_GetLogs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetLogs(c)
	if w.Code >= 500 {
		t.Fatalf("GetLogs: got %d", w.Code)
	}
}
func TestHandler_EPHEMERAL_EN_ListEnvs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListEnvs(c)
	if w.Code >= 500 {
		t.Fatalf("ListEnvs: got %d", w.Code)
	}
}
