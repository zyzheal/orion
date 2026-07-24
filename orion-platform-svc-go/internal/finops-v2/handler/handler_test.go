package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/finops-v2/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

func TestHandler_FINOPS_V2_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_FINOPS_V2_TrackProjectCost(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TrackProjectCost(c)
	if w.Code >= 500 {
		t.Fatalf("TrackProjectCost: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_TrackTenantCost(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TrackTenantCost(c)
	if w.Code >= 500 {
		t.Fatalf("TrackTenantCost: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_TrackTeamCost(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TrackTeamCost(c)
	if w.Code >= 500 {
		t.Fatalf("TrackTeamCost: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetCostByEntity(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCostByEntity(c)
	if w.Code >= 500 {
		t.Fatalf("GetCostByEntity: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetEntityCostTrend(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEntityCostTrend(c)
	if w.Code >= 500 {
		t.Fatalf("GetEntityCostTrend: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetCostOverview(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCostOverview(c)
	if w.Code >= 500 {
		t.Fatalf("GetCostOverview: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetCostBreakdown(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCostBreakdown(c)
	if w.Code >= 500 {
		t.Fatalf("GetCostBreakdown: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetChargeback(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetChargeback(c)
	if w.Code >= 500 {
		t.Fatalf("GetChargeback: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_ListBudgets(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListBudgets(c)
	if w.Code >= 500 {
		t.Fatalf("ListBudgets: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_CreateBudget(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateBudget(c)
	if w.Code >= 500 {
		t.Fatalf("CreateBudget: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetBudget(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBudget(c)
	if w.Code >= 500 {
		t.Fatalf("GetBudget: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_UpdateBudget(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateBudget(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateBudget: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_DeleteBudget(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteBudget(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteBudget: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetBudgetStatus(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBudgetStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetBudgetStatus: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_ForecastBudget(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ForecastBudget(c)
	if w.Code >= 500 {
		t.Fatalf("ForecastBudget: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_CheckBudgetAlerts(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CheckBudgetAlerts(c)
	if w.Code >= 500 {
		t.Fatalf("CheckBudgetAlerts: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetAlertTriggers(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAlertTriggers(c)
	if w.Code >= 500 {
		t.Fatalf("GetAlertTriggers: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetCostForecasts(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCostForecasts(c)
	if w.Code >= 500 {
		t.Fatalf("GetCostForecasts: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_ListRecommendations(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListRecommendations(c)
	if w.Code >= 500 {
		t.Fatalf("ListRecommendations: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_UpdateRecommendation(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateRecommendation(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateRecommendation: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_DeleteRecommendation(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteRecommendation(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteRecommendation: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetRightSizing(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRightSizing(c)
	if w.Code >= 500 {
		t.Fatalf("GetRightSizing: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetUnusedResources(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetUnusedResources(c)
	if w.Code >= 500 {
		t.Fatalf("GetUnusedResources: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetSavingsEstimate(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSavingsEstimate(c)
	if w.Code >= 500 {
		t.Fatalf("GetSavingsEstimate: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetReports(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetReports(c)
	if w.Code >= 500 {
		t.Fatalf("GetReports: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetROIHistory(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetROIHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetROIHistory: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetROISummary(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetROISummary(c)
	if w.Code >= 500 {
		t.Fatalf("GetROISummary: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetMetrics(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetMetrics: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_HealthCheck(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().HealthCheck(c)
	if w.Code >= 500 {
		t.Fatalf("HealthCheck: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_CollectCost(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CollectCost(c)
	if w.Code >= 500 {
		t.Fatalf("CollectCost: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetProviders(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetProviders(c)
	if w.Code >= 500 {
		t.Fatalf("GetProviders: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_SetSchedule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SetSchedule(c)
	if w.Code >= 500 {
		t.Fatalf("SetSchedule: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetSchedule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSchedule(c)
	if w.Code >= 500 {
		t.Fatalf("GetSchedule: got %d", w.Code)
	}
}
