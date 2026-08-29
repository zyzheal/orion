package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/change-intelligence/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/change-intelligence/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeChange_intelligenceService{})
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

type fakeChange_intelligenceService struct{}

func (f *fakeChange_intelligenceService) Analyze(ctx context.Context, req *models.AnalyzeRequest, tenantID string, createdBy string) (*models.ChangeAnalysis, error) {
	return &models.ChangeAnalysis{}, nil
}

func (f *fakeChange_intelligenceService) GetBlastRadius(ctx context.Context, analysisID string, tenantID string) (*models.BlastRadiusResponse, error) {
	return &models.BlastRadiusResponse{}, nil
}

func (f *fakeChange_intelligenceService) GetReport(ctx context.Context, id string, tenantID string) (*models.ChangeAnalysis, error) {
	return &models.ChangeAnalysis{}, nil
}

func (f *fakeChange_intelligenceService) ListReports(ctx context.Context, tenantID string) ([]models.ReportSummary, int, error) {
	return []models.ReportSummary{}, 0, nil
}

var _ service.ServiceInterface = (*fakeChange_intelligenceService)(nil)

func TestCHANGE_INTELLIGENCE_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCHANGE_INTELLIGENCE_Handler_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestCHANGE_INTELLIGENCE_Handler_Analyze(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Analyze(c)
	if w.Code >= 500 {
		t.Fatalf("Analyze: got %d", w.Code)
	}
}

func TestCHANGE_INTELLIGENCE_Handler_ListReports(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListReports(c)
	if w.Code >= 500 {
		t.Fatalf("ListReports: got %d", w.Code)
	}
}

func TestCHANGE_INTELLIGENCE_Handler_GetReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetReport(c)
	if w.Code >= 500 {
		t.Fatalf("GetReport: got %d", w.Code)
	}
}

func TestCHANGE_INTELLIGENCE_Handler_GetBlastRadius(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetBlastRadius(c)
	if w.Code >= 500 {
		t.Fatalf("GetBlastRadius: got %d", w.Code)
	}
}
