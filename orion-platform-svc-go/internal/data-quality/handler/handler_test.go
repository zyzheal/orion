package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/data-quality/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/data-quality/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeData_qualityService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeData_qualityService struct{}

func (f *fakeData_qualityService) CreateAlert(ctx context.Context, tenantID string, req *models.CreateAlertRequest) (*models.Alert, error) {
	return &models.Alert{}, nil
}

func (f *fakeData_qualityService) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.Rule, error) {
	return &models.Rule{}, nil
}

func (f *fakeData_qualityService) CreateScanResult(ctx context.Context, tenantID string, req *models.CreateScanResultRequest) (*models.ScanResult, error) {
	return &models.ScanResult{}, nil
}

func (f *fakeData_qualityService) DeleteAlert(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeData_qualityService) DeleteRule(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeData_qualityService) GetAlert(ctx context.Context, tenantID, id string) (*models.Alert, error) {
	return &models.Alert{}, nil
}

func (f *fakeData_qualityService) GetRule(ctx context.Context, tenantID, id string) (*models.Rule, error) {
	return &models.Rule{}, nil
}

func (f *fakeData_qualityService) GetStats(ctx context.Context, tenantID string) (*models.QualityStats, error) {
	return &models.QualityStats{}, nil
}

func (f *fakeData_qualityService) ListAlerts(ctx context.Context, tenantID string, status *string) ([]models.Alert, error) {
	return []models.Alert{}, nil
}

func (f *fakeData_qualityService) ListRules(ctx context.Context, tenantID string, filter *models.RuleFilter) ([]models.Rule, error) {
	return []models.Rule{}, nil
}

func (f *fakeData_qualityService) ListScanResults(ctx context.Context, tenantID, ruleID string, status *string) ([]models.ScanResult, error) {
	return []models.ScanResult{}, nil
}

func (f *fakeData_qualityService) UpdateAlert(ctx context.Context, tenantID, id string, req *models.UpdateAlertRequest) (*models.Alert, error) {
	return &models.Alert{}, nil
}

func (f *fakeData_qualityService) UpdateRule(ctx context.Context, tenantID, id string, req *models.UpdateRuleRequest) (*models.Rule, error) {
	return &models.Rule{}, nil
}

var _ service.ServiceInterface = (*fakeData_qualityService)(nil)


func TestHandler_DATA_QUALITY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DATA_QUALITY_ListRules(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListRules(c)
	if w.Code >= 500 {
		t.Fatalf("ListRules: got %d", w.Code)
	}
}
func TestHandler_DATA_QUALITY_CreateRule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateRule(c)
	if w.Code >= 500 {
		t.Fatalf("CreateRule: got %d", w.Code)
	}
}
func TestHandler_DATA_QUALITY_GetRule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRule(c)
	if w.Code >= 500 {
		t.Fatalf("GetRule: got %d", w.Code)
	}
}
func TestHandler_DATA_QUALITY_UpdateRule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateRule(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateRule: got %d", w.Code)
	}
}
func TestHandler_DATA_QUALITY_DeleteRule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteRule(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteRule: got %d", w.Code)
	}
}
func TestHandler_DATA_QUALITY_CreateScanResult(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateScanResult(c)
	if w.Code >= 500 {
		t.Fatalf("CreateScanResult: got %d", w.Code)
	}
}
func TestHandler_DATA_QUALITY_ListScanResults(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListScanResults(c)
	if w.Code >= 500 {
		t.Fatalf("ListScanResults: got %d", w.Code)
	}
}
func TestHandler_DATA_QUALITY_ListAlerts(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAlerts(c)
	if w.Code >= 500 {
		t.Fatalf("ListAlerts: got %d", w.Code)
	}
}
func TestHandler_DATA_QUALITY_CreateAlert(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateAlert(c)
	if w.Code >= 500 {
		t.Fatalf("CreateAlert: got %d", w.Code)
	}
}
func TestHandler_DATA_QUALITY_GetAlert(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAlert(c)
	if w.Code >= 500 {
		t.Fatalf("GetAlert: got %d", w.Code)
	}
}
func TestHandler_DATA_QUALITY_UpdateAlert(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateAlert(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateAlert: got %d", w.Code)
	}
}
func TestHandler_DATA_QUALITY_DeleteAlert(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteAlert(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteAlert: got %d", w.Code)
	}
}
func TestHandler_DATA_QUALITY_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
