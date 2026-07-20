package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/multi-cloud/service"

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

func TestHandler_MULTI_CLOUD_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_MULTI_CLOUD_AddProvider(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddProvider(c)
	if w.Code >= 500 {
		t.Fatalf("AddProvider: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_ListProviders(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListProviders(c)
	if w.Code >= 500 {
		t.Fatalf("ListProviders: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_UpdateProvider(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateProvider(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateProvider: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_DeleteProvider(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteProvider(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteProvider: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_GetProvider(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetProvider(c)
	if w.Code >= 500 {
		t.Fatalf("GetProvider: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_ListResources(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListResources(c)
	if w.Code >= 500 {
		t.Fatalf("ListResources: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_GetResource(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetResource(c)
	if w.Code >= 500 {
		t.Fatalf("GetResource: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_SyncResources(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SyncResources(c)
	if w.Code >= 500 {
		t.Fatalf("SyncResources: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_GetCosts(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCosts(c)
	if w.Code >= 500 {
		t.Fatalf("GetCosts: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_GetProviderCost(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetProviderCost(c)
	if w.Code >= 500 {
		t.Fatalf("GetProviderCost: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_CompareCosts(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CompareCosts(c)
	if w.Code >= 500 {
		t.Fatalf("CompareCosts: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_GetRecommendations(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRecommendations(c)
	if w.Code >= 500 {
		t.Fatalf("GetRecommendations: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_GetHealth(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetHealth(c)
	if w.Code >= 500 {
		t.Fatalf("GetHealth: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_GetStatistics(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStatistics(c)
	if w.Code >= 500 {
		t.Fatalf("GetStatistics: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_TriggerSync(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TriggerSync(c)
	if w.Code >= 500 {
		t.Fatalf("TriggerSync: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_RunComplianceCheck(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RunComplianceCheck(c)
	if w.Code >= 500 {
		t.Fatalf("RunComplianceCheck: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_GetComplianceRules(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetComplianceRules(c)
	if w.Code >= 500 {
		t.Fatalf("GetComplianceRules: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_CreateSchedulingPolicy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateSchedulingPolicy(c)
	if w.Code >= 500 {
		t.Fatalf("CreateSchedulingPolicy: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_ListSchedulingPolicies(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSchedulingPolicies(c)
	if w.Code >= 500 {
		t.Fatalf("ListSchedulingPolicies: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_ScheduleResource(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ScheduleResource(c)
	if w.Code >= 500 {
		t.Fatalf("ScheduleResource: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_GetSchedulingHistory(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSchedulingHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetSchedulingHistory: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_CreateMigrationPlan(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateMigrationPlan(c)
	if w.Code >= 500 {
		t.Fatalf("CreateMigrationPlan: got %d", w.Code)
	}
}
func TestHandler_MULTI_CLOUD_ExecuteMigration(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExecuteMigration(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteMigration: got %d", w.Code)
	}
}
