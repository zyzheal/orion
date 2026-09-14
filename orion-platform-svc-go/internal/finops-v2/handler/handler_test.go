package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/finops-v2/models"
	"orion/platform-svc-go/internal/finops-v2/service"

	"github.com/gin-gonic/gin"
)

// fakeFinopsV2Service implements service.ServiceInterface for testing.
type fakeFinopsV2Service struct {
	getBudgetErr       error
	getBudgetStatusErr error
	getScheduleErr     error
	healthOK           bool
	healthErr          error
	triggers           []models.AlertTrigger
	alerts             []models.BudgetAlert
	lastAlertsEntity   string
	lastAlertsType     string
	lastAlertsTenant   string
	lastTriggersTenant string
	lastAlertsBody     []byte
}

func (f *fakeFinopsV2Service) TrackProjectCost(ctx context.Context, tenantID string, req models.TrackCostRequest) (*models.CostEntry, error) {
	return &models.CostEntry{}, nil
}
func (f *fakeFinopsV2Service) TrackTenantCost(ctx context.Context, tenantID string, req models.TrackCostRequest) (*models.CostEntry, error) {
	return &models.CostEntry{}, nil
}
func (f *fakeFinopsV2Service) TrackTeamCost(ctx context.Context, tenantID string, req models.TrackCostRequest) (*models.CostEntry, error) {
	return &models.CostEntry{}, nil
}
func (f *fakeFinopsV2Service) GetCostByEntity(ctx context.Context, tenantID, entityType, entityID string) ([]models.CostEntry, error) {
	return []models.CostEntry{}, nil
}
func (f *fakeFinopsV2Service) GetEntityCostTrend(ctx context.Context, tenantID, entityType, entityID, period string) (*models.CostTrend, error) {
	return &models.CostTrend{}, nil
}
func (f *fakeFinopsV2Service) GetCostSummary(ctx context.Context, tenantID, period string) (*models.CostSummary, error) {
	return &models.CostSummary{}, nil
}
func (f *fakeFinopsV2Service) GetCostBreakdown(ctx context.Context, tenantID, dimension string) (*models.CostBreakdownResponse, error) {
	return &models.CostBreakdownResponse{}, nil
}
func (f *fakeFinopsV2Service) GetChargebackReport(ctx context.Context, tenantID string) ([]models.ChargebackEntry, error) {
	return []models.ChargebackEntry{}, nil
}
func (f *fakeFinopsV2Service) ListBudgets(ctx context.Context, tenantID string, limit, offset int) ([]models.Budget, error) {
	return []models.Budget{}, nil
}
func (f *fakeFinopsV2Service) CreateBudget(ctx context.Context, tenantID string, req models.CreateBudgetRequest) (*models.Budget, error) {
	return &models.Budget{}, nil
}
func (f *fakeFinopsV2Service) GetBudget(ctx context.Context, tenantID, id string) (*models.Budget, error) {
	return &models.Budget{}, f.getBudgetErr
}
func (f *fakeFinopsV2Service) UpdateBudget(ctx context.Context, tenantID, id string, req models.UpdateBudgetRequest) (*models.Budget, error) {
	return &models.Budget{}, nil
}
func (f *fakeFinopsV2Service) DeleteBudget(ctx context.Context, tenantID, id string) error {
	return nil
}
func (f *fakeFinopsV2Service) GetBudgetStatus(ctx context.Context, tenantID, id string) (*models.BudgetStatusResponse, error) {
	return &models.BudgetStatusResponse{}, f.getBudgetStatusErr
}
func (f *fakeFinopsV2Service) ForecastBudget(ctx context.Context, tenantID, id string) (*models.BudgetForecastResponse, error) {
	return &models.BudgetForecastResponse{}, nil
}
func (f *fakeFinopsV2Service) CheckBudgetAlerts(ctx context.Context, tenantID, entityID, entityType string) ([]models.BudgetAlert, error) {
	f.lastAlertsTenant, f.lastAlertsEntity, f.lastAlertsType = tenantID, entityID, entityType
	if f.alerts == nil {
		return []models.BudgetAlert{}, nil
	}
	return f.alerts, nil
}
func (f *fakeFinopsV2Service) GetAlertTriggers(ctx context.Context, tenantID string) ([]models.AlertTrigger, error) {
	f.lastTriggersTenant = tenantID
	if f.triggers == nil {
		return []models.AlertTrigger{}, nil
	}
	return f.triggers, nil
}
func (f *fakeFinopsV2Service) GetCostForecast(ctx context.Context, tenantID, entityType, entityID, period string) (*models.CostForecast, error) {
	return &models.CostForecast{}, nil
}
func (f *fakeFinopsV2Service) ListRecommendations(ctx context.Context, tenantID string) ([]models.Recommendation, error) {
	return []models.Recommendation{}, nil
}
func (f *fakeFinopsV2Service) UpdateRecommendationStatus(ctx context.Context, tenantID, id string, req models.UpdateRecommendationRequest) error {
	return nil
}
func (f *fakeFinopsV2Service) DeleteRecommendation(ctx context.Context, tenantID, id string) error {
	return nil
}
func (f *fakeFinopsV2Service) GetRightSizingRecommendations(ctx context.Context, tenantID string) ([]models.RightSizingRecommendation, error) {
	return []models.RightSizingRecommendation{}, nil
}
func (f *fakeFinopsV2Service) DetectUnusedResources(ctx context.Context, tenantID string) ([]models.UnusedResource, error) {
	return []models.UnusedResource{}, nil
}
func (f *fakeFinopsV2Service) EstimateSavings(ctx context.Context, tenantID string) (*models.SavingsEstimate, error) {
	return &models.SavingsEstimate{}, nil
}
func (f *fakeFinopsV2Service) GetReportHistory(ctx context.Context, tenantID string) ([]models.Report, error) {
	return []models.Report{}, nil
}
func (f *fakeFinopsV2Service) GetROIHistory(ctx context.Context, tenantID string) ([]models.ROIEntry, error) {
	return []models.ROIEntry{}, nil
}
func (f *fakeFinopsV2Service) GetROISummary(ctx context.Context, tenantID string) (*models.ROISummary, error) {
	return &models.ROISummary{}, nil
}
func (f *fakeFinopsV2Service) GetMetrics(ctx context.Context, tenantID string) (*models.FinOpsMetricsResponse, error) {
	return &models.FinOpsMetricsResponse{}, nil
}
func (f *fakeFinopsV2Service) GetRegisteredProviders(ctx context.Context, tenantID string) ([]models.CloudProviderEntry, error) {
	return []models.CloudProviderEntry{}, nil
}
func (f *fakeFinopsV2Service) SetSchedule(ctx context.Context, provider, cronExpression string, enabled bool) error {
	return nil
}
func (f *fakeFinopsV2Service) GetSchedule(ctx context.Context, provider string) (*models.CollectionSchedule, error) {
	return &models.CollectionSchedule{}, f.getScheduleErr
}
func (f *fakeFinopsV2Service) CollectCost(ctx context.Context, tenantID string, req models.CollectCostRequest) (*models.CollectCostResponse, error) {
	return &models.CollectCostResponse{}, nil
}
func (f *fakeFinopsV2Service) HealthCheck(ctx context.Context) (bool, error) {
	return f.healthOK, f.healthErr
}

func newHandler() *Handler {
	return NewHandler(&fakeFinopsV2Service{healthOK: true})
}

func newHandlerWith(f *fakeFinopsV2Service) *Handler {
	return NewHandler(f)
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
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TrackProjectCost(c)
	if w.Code >= 500 {
		t.Fatalf("TrackProjectCost: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_TrackTenantCost(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TrackTenantCost(c)
	if w.Code >= 500 {
		t.Fatalf("TrackTenantCost: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_TrackTeamCost(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TrackTeamCost(c)
	if w.Code >= 500 {
		t.Fatalf("TrackTeamCost: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetCostByEntity(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCostByEntity(c)
	if w.Code >= 500 {
		t.Fatalf("GetCostByEntity: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetEntityCostTrend(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEntityCostTrend(c)
	if w.Code >= 500 {
		t.Fatalf("GetEntityCostTrend: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetCostOverview(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCostOverview(c)
	if w.Code >= 500 {
		t.Fatalf("GetCostOverview: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetCostBreakdown(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCostBreakdown(c)
	if w.Code >= 500 {
		t.Fatalf("GetCostBreakdown: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetChargeback(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetChargeback(c)
	if w.Code >= 500 {
		t.Fatalf("GetChargeback: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_ListBudgets(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListBudgets(c)
	if w.Code >= 500 {
		t.Fatalf("ListBudgets: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_CreateBudget(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateBudget(c)
	if w.Code >= 500 {
		t.Fatalf("CreateBudget: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetBudget(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBudget(c)
	if w.Code >= 500 {
		t.Fatalf("GetBudget: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_UpdateBudget(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateBudget(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateBudget: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_DeleteBudget(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteBudget(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteBudget: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetBudgetStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBudgetStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetBudgetStatus: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_ForecastBudget(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ForecastBudget(c)
	if w.Code >= 500 {
		t.Fatalf("ForecastBudget: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_CheckBudgetAlerts(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CheckBudgetAlerts(c)
	if w.Code >= 500 {
		t.Fatalf("CheckBudgetAlerts: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetAlertTriggers(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAlertTriggers(c)
	if w.Code >= 500 {
		t.Fatalf("GetAlertTriggers: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetCostForecasts(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCostForecasts(c)
	if w.Code >= 500 {
		t.Fatalf("GetCostForecasts: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_ListRecommendations(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListRecommendations(c)
	if w.Code >= 500 {
		t.Fatalf("ListRecommendations: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_UpdateRecommendation(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateRecommendation(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateRecommendation: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_DeleteRecommendation(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteRecommendation(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteRecommendation: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetRightSizing(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRightSizing(c)
	if w.Code >= 500 {
		t.Fatalf("GetRightSizing: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetUnusedResources(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetUnusedResources(c)
	if w.Code >= 500 {
		t.Fatalf("GetUnusedResources: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetSavingsEstimate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSavingsEstimate(c)
	if w.Code >= 500 {
		t.Fatalf("GetSavingsEstimate: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetReports(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetReports(c)
	if w.Code >= 500 {
		t.Fatalf("GetReports: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetROIHistory(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetROIHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetROIHistory: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetROISummary(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetROISummary(c)
	if w.Code >= 500 {
		t.Fatalf("GetROISummary: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetMetrics(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetMetrics: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_HealthCheck(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().HealthCheck(c)
	if w.Code >= 500 {
		t.Fatalf("HealthCheck: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_CollectCost(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CollectCost(c)
	if w.Code >= 500 {
		t.Fatalf("CollectCost: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetProviders(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetProviders(c)
	if w.Code >= 500 {
		t.Fatalf("GetProviders: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_SetSchedule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SetSchedule(c)
	if w.Code >= 500 {
		t.Fatalf("SetSchedule: got %d", w.Code)
	}
}
func TestHandler_FINOPS_V2_GetSchedule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSchedule(c)
	if w.Code >= 500 {
		t.Fatalf("GetSchedule: got %d", w.Code)
	}
}

// --- 404 must mean "no such row", not "the database failed" ---

func TestHandler_FINOPS_V2_GetBudgetMapsNotFoundTo404(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/budgets/9")
	c.Params = gin.Params{{Key: "id", Value: "9"}}
	h := newHandlerWith(&fakeFinopsV2Service{getBudgetErr: service.ErrBudgetNotFound, healthOK: true})
	h.GetBudget(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", w.Code)
	}
}

func TestHandler_FINOPS_V2_GetBudgetMapsAnOutageTo500(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/budgets/9")
	c.Params = gin.Params{{Key: "id", Value: "9"}}
	h := newHandlerWith(&fakeFinopsV2Service{getBudgetErr: errors.New("pq: connection refused"), healthOK: true})
	h.GetBudget(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("an outage is not 404: got %d", w.Code)
	}
}

func TestHandler_FINOPS_V2_GetBudgetStatusMapsNotFoundAndOutage(t *testing.T) {
	for name, tc := range map[string]struct {
		err  error
		want int
	}{
		"not found": {sql.ErrNoRows, http.StatusNotFound},
		"outage":    {errors.New("pq: canceling statement due to user request"), http.StatusInternalServerError},
	} {
		c, w := makeCtx(http.MethodGet, "/budgets/9/status")
		c.Params = gin.Params{{Key: "id", Value: "9"}}
		h := newHandlerWith(&fakeFinopsV2Service{getBudgetStatusErr: tc.err, healthOK: true})
		h.GetBudgetStatus(c)
		if w.Code != tc.want {
			t.Errorf("%s: want %d, got %d", name, tc.want, w.Code)
		}
	}
}

func TestHandler_FINOPS_V2_GetScheduleMapsNotFoundAndOutage(t *testing.T) {
	for name, tc := range map[string]struct {
		err  error
		want int
	}{
		"not found": {sql.ErrNoRows, http.StatusNotFound},
		"outage":    {errors.New("pq: connection refused"), http.StatusInternalServerError},
	} {
		c, w := makeCtx(http.MethodGet, "/providers/aws/schedule")
		c.Params = gin.Params{{Key: "provider", Value: "aws"}}
		h := newHandlerWith(&fakeFinopsV2Service{getScheduleErr: tc.err, healthOK: true})
		h.GetSchedule(c)
		if w.Code != tc.want {
			t.Errorf("%s: want %d, got %d", name, tc.want, w.Code)
		}
	}
}

// --- malformed JSON is a 400, not a swallowed 500 ---

func TestHandler_FINOPS_V2_CheckBudgetAlertsRejectsMalformedJSON(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Request = httptest.NewRequest(http.MethodPost, "/budgets/check-alerts",
		strings.NewReader(`{"entity_id": "proj-1", `))
	h := newHandlerWith(&fakeFinopsV2Service{healthOK: true})
	h.CheckBudgetAlerts(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("malformed body: want 400, got %d", w.Code)
	}
}

// --- the tenant id must reach the service ---

func TestHandler_FINOPS_V2_CheckBudgetAlertsForwardsTenantAndBody(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Request = httptest.NewRequest(http.MethodPost, "/budgets/check-alerts",
		strings.NewReader(`{"entity_id":"proj-1","entity_type":"project"}`))
	f := &fakeFinopsV2Service{healthOK: true, alerts: []models.BudgetAlert{{BudgetID: 3}}}
	newHandlerWith(f).CheckBudgetAlerts(c)
	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
	}
	if f.lastAlertsTenant != "tenant-1" || f.lastAlertsEntity != "proj-1" || f.lastAlertsType != "project" {
		t.Fatalf("got tenant=%q entity=%q type=%q", f.lastAlertsTenant, f.lastAlertsEntity, f.lastAlertsType)
	}
}

func TestHandler_FINOPS_V2_GetAlertTriggersForwardsTheTenant(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/budgets/alert-triggers")
	f := &fakeFinopsV2Service{healthOK: true, triggers: []models.AlertTrigger{{BudgetID: 5}}}
	newHandlerWith(f).GetAlertTriggers(c)
	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", w.Code)
	}
	if f.lastTriggersTenant != "tenant-1" {
		t.Fatalf("tenant=%q, want tenant-1", f.lastTriggersTenant)
	}
}

// --- the health answer must be honoured ---

func TestHandler_FINOPS_V2_HealthCheckHonoursTheAnswer(t *testing.T) {
	for name, tc := range map[string]struct {
		ok   bool
		want int
	}{
		"healthy":   {true, http.StatusOK},
		"unhealthy": {false, http.StatusServiceUnavailable},
	} {
		c, w := makeCtx(http.MethodGet, "/health")
		h := newHandlerWith(&fakeFinopsV2Service{healthOK: tc.ok})
		h.HealthCheck(c)
		if w.Code != tc.want {
			t.Errorf("%s: want %d, got %d", name, tc.want, w.Code)
		}
	}
}

func TestHandler_FINOPS_V2_HealthCheckMapsAnErrorTo500(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/health")
	h := newHandlerWith(&fakeFinopsV2Service{healthErr: errors.New("pq: relation does not exist")})
	h.HealthCheck(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("want 500, got %d", w.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not JSON: %v (%s)", err, w.Body.String())
	}
}
