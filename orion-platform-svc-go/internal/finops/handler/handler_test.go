package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/finops/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/finops/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeFinopsService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeFinopsService struct{}

func (f *fakeFinopsService) ApplyOptimization(ctx context.Context, tenantID string, id string) (bool, error) {
	return false, nil
}

func (f *fakeFinopsService) CompareCosts(ctx context.Context, tenantID string, serviceA string, serviceB string, period string) (*models.CostComparisonResult, error) {
	return &models.CostComparisonResult{}, nil
}

func (f *fakeFinopsService) CreateBudgetGuard(ctx context.Context, req *models.CreateBudgetGuardRequest, tenantID string) (*models.BudgetGuard, error) {
	return &models.BudgetGuard{}, nil
}

func (f *fakeFinopsService) DeleteBudgetGuard(ctx context.Context, id string, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeFinopsService) DetectAnomalies(ctx context.Context, tenantID string, days *int, startStr *string, endStr *string) (*models.AnomalyDetectionResult, error) {
	return &models.AnomalyDetectionResult{}, nil
}

func (f *fakeFinopsService) EvaluateCost(ctx context.Context, tenantID string, pipelineID string, estimatedCost float64, projectID *string, environment *string) (*models.EvaluationResult, error) {
	return &models.EvaluationResult{}, nil
}

func (f *fakeFinopsService) GetBudgetGuard(ctx context.Context, id string, tenantID string) (*models.BudgetGuard, error) {
	return &models.BudgetGuard{}, nil
}

func (f *fakeFinopsService) GetCostOverview(ctx context.Context, tenantID string) (*models.CostOverview, error) {
	return &models.CostOverview{}, nil
}

func (f *fakeFinopsService) GetCostTrend(ctx context.Context, tenantID string, days int) (*models.CostTrendResult, error) {
	return &models.CostTrendResult{}, nil
}

func (f *fakeFinopsService) GetOptimizationSuggestions(ctx context.Context, tenantID string, category *string, minSavings *float64) ([]models.OptimizationSuggestion, error) {
	return []models.OptimizationSuggestion{}, nil
}

func (f *fakeFinopsService) GetServiceCostTrend(ctx context.Context, tenantID string, serviceID string, period string) (*models.CostTrendResult, error) {
	return &models.CostTrendResult{}, nil
}

func (f *fakeFinopsService) GetServiceOptimizationSuggestions(ctx context.Context, tenantID string, serviceID string, entityType string) ([]models.OptimizationSuggestion, error) {
	return []models.OptimizationSuggestion{}, nil
}

func (f *fakeFinopsService) ListBudgetGuards(ctx context.Context, tenantID string) ([]models.BudgetGuard, error) {
	return []models.BudgetGuard{}, nil
}

func (f *fakeFinopsService) RejectOptimization(ctx context.Context, tenantID string, id string) (bool, error) {
	return false, nil
}

var _ service.ServiceInterface = (*fakeFinopsService)(nil)

func TestHandler_FINOPS_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_FINOPS_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_FINOPS_CreateBudgetGuard(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateBudgetGuard(c)
	if w.Code >= 500 {
		t.Fatalf("CreateBudgetGuard: got %d", w.Code)
	}
}
func TestHandler_FINOPS_ListBudgetGuards(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListBudgetGuards(c)
	if w.Code >= 500 {
		t.Fatalf("ListBudgetGuards: got %d", w.Code)
	}
}
func TestHandler_FINOPS_DeleteBudgetGuard(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteBudgetGuard(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteBudgetGuard: got %d", w.Code)
	}
}
func TestHandler_FINOPS_EvaluateCost(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EvaluateCost(c)
	if w.Code >= 500 {
		t.Fatalf("EvaluateCost: got %d", w.Code)
	}
}
func TestHandler_FINOPS_DetectAnomalies(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DetectAnomalies(c)
	if w.Code >= 500 {
		t.Fatalf("DetectAnomalies: got %d", w.Code)
	}
}
func TestHandler_FINOPS_GetCostTrend(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCostTrend(c)
	if w.Code >= 500 {
		t.Fatalf("GetCostTrend: got %d", w.Code)
	}
}
func TestHandler_FINOPS_GetCostOverview(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCostOverview(c)
	if w.Code >= 500 {
		t.Fatalf("GetCostOverview: got %d", w.Code)
	}
}
func TestHandler_FINOPS_ListOptimizations(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListOptimizations(c)
	if w.Code >= 500 {
		t.Fatalf("ListOptimizations: got %d", w.Code)
	}
}
func TestHandler_FINOPS_ApplyOptimization(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ApplyOptimization(c)
	if w.Code >= 500 {
		t.Fatalf("ApplyOptimization: got %d", w.Code)
	}
}
func TestHandler_FINOPS_RejectOptimization(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RejectOptimization(c)
	if w.Code >= 500 {
		t.Fatalf("RejectOptimization: got %d", w.Code)
	}
}
func TestHandler_FINOPS_CompareCosts(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CompareCosts(c)
	if w.Code >= 500 {
		t.Fatalf("CompareCosts: got %d", w.Code)
	}
}
func TestHandler_FINOPS_GetServiceCostTrend(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetServiceCostTrend(c)
	if w.Code >= 500 {
		t.Fatalf("GetServiceCostTrend: got %d", w.Code)
	}
}
func TestHandler_FINOPS_GetServiceOptimizationSuggestions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetServiceOptimizationSuggestions(c)
	if w.Code >= 500 {
		t.Fatalf("GetServiceOptimizationSuggestions: got %d", w.Code)
	}
}
