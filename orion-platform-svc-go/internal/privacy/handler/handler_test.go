package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/privacy/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/privacy/models"
)

func newHandler() *Handler {
	return NewHandler(&fakePrivacyService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakePrivacyService struct{}

func (f *fakePrivacyService) DeletePrivacyConfig(ctx context.Context, tenantID string) error {
	return nil
}

func (f *fakePrivacyService) GetPrivacyConfig(ctx context.Context, tenantID string) (*models.PrivacyConfig, error) {
	return &models.PrivacyConfig{}, nil
}

func (f *fakePrivacyService) ListComplianceStatus(ctx context.Context) ([]models.ComplianceStatus, error) {
	return []models.ComplianceStatus{}, nil
}

func (f *fakePrivacyService) UpdatePrivacyConfig(ctx context.Context, tenantID string, updates map[string]any) (*models.PrivacyConfig, error) {
	return &models.PrivacyConfig{}, nil
}

func (f *fakePrivacyService) UpsertPrivacyConfig(ctx context.Context, tenantID string, config *models.PrivacyConfig) (*models.PrivacyConfig, error) {
	return &models.PrivacyConfig{}, nil
}

var _ service.ServiceInterface = (*fakePrivacyService)(nil)


func TestHandler_PRIVACY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PRIVACY_GetConfig(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetConfig(c)
	if w.Code >= 500 {
		t.Fatalf("GetConfig: got %d", w.Code)
	}
}
func TestHandler_PRIVACY_UpsertConfig(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpsertConfig(c)
	if w.Code >= 500 {
		t.Fatalf("UpsertConfig: got %d", w.Code)
	}
}
func TestHandler_PRIVACY_DeleteConfig(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteConfig(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteConfig: got %d", w.Code)
	}
}
func TestHandler_PRIVACY_ListComplianceStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListComplianceStatus(c)
	if w.Code >= 500 {
		t.Fatalf("ListComplianceStatus: got %d", w.Code)
	}
}
