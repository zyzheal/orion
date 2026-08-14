package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/performance/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/performance/models"
)

func newHandler() *Handler {
	return NewHandler(&fakePerformanceService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakePerformanceService struct{}

func (f *fakePerformanceService) CreateBaseline(ctx context.Context, tenantID string, req *models.CreateBaselineRequest) (*models.Baseline, error) {
	return &models.Baseline{}, nil
}

func (f *fakePerformanceService) DetectRegression(ctx context.Context, tenantID string, req *models.DetectRegressionRequest) (*models.RegressionResult, error) {
	return &models.RegressionResult{}, nil
}

func (f *fakePerformanceService) EvaluatePerformance(ctx context.Context, tenantID string, req *models.EvaluateRequest) (*models.Evaluation, error) {
	return &models.Evaluation{}, nil
}

func (f *fakePerformanceService) GetBaselineByID(ctx context.Context, id string, tenantID string) (*models.Baseline, error) {
	return &models.Baseline{}, nil
}

func (f *fakePerformanceService) GetBottlenecks(ctx context.Context, tenantID string, profileID string) ([]models.Bottleneck, error) {
	return []models.Bottleneck{}, nil
}

func (f *fakePerformanceService) GetEvaluationHistory(ctx context.Context, id string, tenantID string) ([]models.Evaluation, error) {
	return []models.Evaluation{}, nil
}

func (f *fakePerformanceService) GetSuggestions(ctx context.Context, tenantID string, serviceName string) ([]models.Suggestion, error) {
	return []models.Suggestion{}, nil
}

func (f *fakePerformanceService) GetTestResults(ctx context.Context, tenantID string, serviceName string) ([]models.Baseline, error) {
	return []models.Baseline{}, nil
}

func (f *fakePerformanceService) ListBaselines(ctx context.Context, tenantID string) ([]models.Baseline, error) {
	return []models.Baseline{}, nil
}

func (f *fakePerformanceService) ProfileService(ctx context.Context, tenantID string, serviceName string) (*models.Profile, error) {
	return &models.Profile{}, nil
}

func (f *fakePerformanceService) RecordTestResult(ctx context.Context, tenantID string, req *models.TestResultRequest) error {
	return nil
}

var _ service.ServiceInterface = (*fakePerformanceService)(nil)


func TestHandler_PERFORMANCE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PERFORMANCE_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_CreateBaseline(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateBaseline(c)
	if w.Code >= 500 {
		t.Fatalf("CreateBaseline: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_ListBaselines(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListBaselines(c)
	if w.Code >= 500 {
		t.Fatalf("ListBaselines: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_GetBaselineByID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBaselineByID(c)
	if w.Code >= 500 {
		t.Fatalf("GetBaselineByID: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_GetEvaluationHistory(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEvaluationHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetEvaluationHistory: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_EvaluatePerformance(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EvaluatePerformance(c)
	if w.Code >= 500 {
		t.Fatalf("EvaluatePerformance: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_ProfileService(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ProfileService(c)
	if w.Code >= 500 {
		t.Fatalf("ProfileService: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_GetBottlenecks(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBottlenecks(c)
	if w.Code >= 500 {
		t.Fatalf("GetBottlenecks: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_GetSuggestions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSuggestions(c)
	if w.Code >= 500 {
		t.Fatalf("GetSuggestions: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_DetectRegression(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DetectRegression(c)
	if w.Code >= 500 {
		t.Fatalf("DetectRegression: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_RecordTestResult(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RecordTestResult(c)
	if w.Code >= 500 {
		t.Fatalf("RecordTestResult: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_GetTestResults(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTestResults(c)
	if w.Code >= 500 {
		t.Fatalf("GetTestResults: got %d", w.Code)
	}
}
