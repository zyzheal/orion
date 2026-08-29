package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ueba/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ueba/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeUebaService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeUebaService struct{}

func (f *fakeUebaService) CreateAlert(ctx context.Context, tenantID string, req *models.CreateAlertRequest) (*models.UEBAAlert, error) {
	return &models.UEBAAlert{}, nil
}

func (f *fakeUebaService) DetectAnomaly(ctx context.Context, tenantID string, req *models.DetectAnomalyRequest) (*models.CreateAlertRequest, error) {
	return &models.CreateAlertRequest{}, nil
}

func (f *fakeUebaService) DismissAlert(ctx context.Context, id, tenantID string, req *models.DismissAlertRequest) error {
	return nil
}

func (f *fakeUebaService) GetAlert(ctx context.Context, id, tenantID string) (*models.UEBAAlert, error) {
	return &models.UEBAAlert{}, nil
}

func (f *fakeUebaService) GetProfile(ctx context.Context, tenantID, entityID string) (*models.UEBAProfile, error) {
	return &models.UEBAProfile{}, nil
}

func (f *fakeUebaService) ListAlerts(ctx context.Context, tenantID string, q models.ListAlertsQuery) ([]models.UEBAAlert, error) {
	return []models.UEBAAlert{}, nil
}

func (f *fakeUebaService) ListProfiles(ctx context.Context, tenantID string) ([]models.UEBAProfile, error) {
	return []models.UEBAProfile{}, nil
}

func (f *fakeUebaService) SaveProfile(ctx context.Context, tenantID, userID, entityType, entityID, profileData string) error {
	return nil
}

var _ service.ServiceInterface = (*fakeUebaService)(nil)

func TestHandler_UEBA_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_UEBA_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_UEBA_ListAlerts(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAlerts(c)
	if w.Code >= 500 {
		t.Fatalf("ListAlerts: got %d", w.Code)
	}
}
func TestHandler_UEBA_GetAlert(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAlert(c)
	if w.Code >= 500 {
		t.Fatalf("GetAlert: got %d", w.Code)
	}
}
func TestHandler_UEBA_CreateAlert(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateAlert(c)
	if w.Code >= 500 {
		t.Fatalf("CreateAlert: got %d", w.Code)
	}
}
func TestHandler_UEBA_DismissAlert(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DismissAlert(c)
	if w.Code >= 500 {
		t.Fatalf("DismissAlert: got %d", w.Code)
	}
}
func TestHandler_UEBA_ListProfiles(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListProfiles(c)
	if w.Code >= 500 {
		t.Fatalf("ListProfiles: got %d", w.Code)
	}
}
func TestHandler_UEBA_GetProfile(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetProfile(c)
	if w.Code >= 500 {
		t.Fatalf("GetProfile: got %d", w.Code)
	}
}
func TestHandler_UEBA_DetectAnomaly(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DetectAnomaly(c)
	if w.Code >= 500 {
		t.Fatalf("DetectAnomaly: got %d", w.Code)
	}
}
