package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	eff_models "orion/platform-svc-go/internal/efficiency/models"

	"github.com/gin-gonic/gin"
)

// mockSvc implements Service interface for efficiency handler tests.
type mockSvc struct {
	generateReportFn        func(ctx context.Context, tenantID string, tw eff_models.TimeWindow, ws int) (*eff_models.EfficiencyReport, error)
	getReportHistoryFn      func(ctx context.Context, tenantID string, limit int) ([]*eff_models.EfficiencyReport, error)
	getTeamMetricsFn        func(ctx context.Context, tenantID, teamID string) (*eff_models.TeamMetrics, error)
	getProjectMetricsFn     func(ctx context.Context, tenantID, projectID string) (*eff_models.ProjectMetrics, error)
	getAllTeamsFn           func(ctx context.Context, tenantID string) []eff_models.TeamInfo
	comparePeriodsFn        func(ctx context.Context, tenantID string, a, b eff_models.PeriodSpec) (*eff_models.PeriodComparisonResult, error)
	getAllDORAFn            func(ctx context.Context, tenantID string, deployments []eff_models.DeploymentRecord, pipelines []eff_models.PipelineCompletionRecord, incidents []eff_models.IncidentRecord, tw eff_models.TimeWindow, ws int) (*eff_models.AllDORAResult, error)
	getDORATrendFn          func(ctx context.Context, tenantID string, deployments []eff_models.DeploymentRecord, pipelines []eff_models.PipelineCompletionRecord, incidents []eff_models.IncidentRecord, tw eff_models.TimeWindow, ws int) (*eff_models.DORATrendResult, error)
	getDashboardDataFn      func(ctx context.Context, tenantID string, tw eff_models.TimeWindow, ws int) *eff_models.DashboardData
	getHistoricalSnapshotsFn func(ctx context.Context, tenantID string, weeks int) ([]eff_models.HistoricalSnapshotWeek, error)
	getBottlenecksFn        func(ctx context.Context, tenantID string, tw eff_models.TimeWindow, ws int) []eff_models.Bottleneck
	getDeveloperProfilesFn  func(ctx context.Context, tenantID string) []eff_models.DeveloperProfile
}

func (m *mockSvc) GenerateReport(ctx context.Context, tenantID string, tw eff_models.TimeWindow, ws int) (*eff_models.EfficiencyReport, error) {
	if m.generateReportFn != nil {
		return m.generateReportFn(ctx, tenantID, tw, ws)
	}
	return nil, nil
}
func (m *mockSvc) GetReportHistory(ctx context.Context, tenantID string, limit int) ([]*eff_models.EfficiencyReport, error) {
	if m.getReportHistoryFn != nil {
		return m.getReportHistoryFn(ctx, tenantID, limit)
	}
	return nil, nil
}
func (m *mockSvc) GetTeamMetrics(ctx context.Context, tenantID, teamID string) (*eff_models.TeamMetrics, error) {
	if m.getTeamMetricsFn != nil {
		return m.getTeamMetricsFn(ctx, tenantID, teamID)
	}
	return nil, nil
}
func (m *mockSvc) GetProjectMetrics(ctx context.Context, tenantID, projectID string) (*eff_models.ProjectMetrics, error) {
	if m.getProjectMetricsFn != nil {
		return m.getProjectMetricsFn(ctx, tenantID, projectID)
	}
	return nil, nil
}
func (m *mockSvc) GetAllTeams(ctx context.Context, tenantID string) []eff_models.TeamInfo {
	if m.getAllTeamsFn != nil {
		return m.getAllTeamsFn(ctx, tenantID)
	}
	return nil
}
func (m *mockSvc) ComparePeriods(ctx context.Context, tenantID string, a, b eff_models.PeriodSpec) (*eff_models.PeriodComparisonResult, error) {
	if m.comparePeriodsFn != nil {
		return m.comparePeriodsFn(ctx, tenantID, a, b)
	}
	return nil, nil
}
func (m *mockSvc) GetAllDORA(ctx context.Context, tenantID string, deployments []eff_models.DeploymentRecord, pipelines []eff_models.PipelineCompletionRecord, incidents []eff_models.IncidentRecord, tw eff_models.TimeWindow, ws int) (*eff_models.AllDORAResult, error) {
	if m.getAllDORAFn != nil {
		return m.getAllDORAFn(ctx, tenantID, deployments, pipelines, incidents, tw, ws)
	}
	return nil, nil
}
func (m *mockSvc) GetDORATrend(ctx context.Context, tenantID string, deployments []eff_models.DeploymentRecord, pipelines []eff_models.PipelineCompletionRecord, incidents []eff_models.IncidentRecord, tw eff_models.TimeWindow, ws int) (*eff_models.DORATrendResult, error) {
	if m.getDORATrendFn != nil {
		return m.getDORATrendFn(ctx, tenantID, deployments, pipelines, incidents, tw, ws)
	}
	return nil, nil
}
func (m *mockSvc) GetDashboardData(ctx context.Context, tenantID string, tw eff_models.TimeWindow, ws int) *eff_models.DashboardData {
	if m.getDashboardDataFn != nil {
		return m.getDashboardDataFn(ctx, tenantID, tw, ws)
	}
	return nil
}
func (m *mockSvc) GetHistoricalSnapshots(ctx context.Context, tenantID string, weeks int) ([]eff_models.HistoricalSnapshotWeek, error) {
	if m.getHistoricalSnapshotsFn != nil {
		return m.getHistoricalSnapshotsFn(ctx, tenantID, weeks)
	}
	return nil, nil
}
func (m *mockSvc) GetBottlenecks(ctx context.Context, tenantID string, tw eff_models.TimeWindow, ws int) []eff_models.Bottleneck {
	if m.getBottlenecksFn != nil {
		return m.getBottlenecksFn(ctx, tenantID, tw, ws)
	}
	return nil
}
func (m *mockSvc) GetDeveloperProfiles(ctx context.Context, tenantID string) []eff_models.DeveloperProfile {
	if m.getDeveloperProfilesFn != nil {
		return m.getDeveloperProfilesFn(ctx, tenantID)
	}
	return nil
}

func newHandlerWithSvc(svc Service) *Handler {
	return NewHandler(svc)
}

func performRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")

	var buf bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = *bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, "/", &buf)
	c.Request.Header.Set("Content-Type", "application/json")

	if pathParams != nil {
		for k, v := range pathParams {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	if queryParams != nil {
		q := c.Request.URL.Query()
		for k, v := range queryParams {
			q.Set(k, v)
		}
		c.Request.URL.RawQuery = q.Encode()
	}

	handlerFn(c)
	return w
}

// ==================== Reports ====================

func TestHandler_GetReports_Success(t *testing.T) {
	report := &eff_models.EfficiencyReport{ReportID: "r-1", TotalPipelineRuns: 5}
	svc := &mockSvc{
		generateReportFn: func(ctx context.Context, tenantID string, tw eff_models.TimeWindow, ws int) (*eff_models.EfficiencyReport, error) {
			return report, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetReports, "GET", nil, nil, map[string]string{"timeWindow": "week"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetReports_Error(t *testing.T) {
	svc := &mockSvc{
		generateReportFn: func(ctx context.Context, tenantID string, tw eff_models.TimeWindow, ws int) (*eff_models.EfficiencyReport, error) {
			return nil, errors.New("db error")
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetReports, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestHandler_GetReportHistory_Success(t *testing.T) {
	reports := []*eff_models.EfficiencyReport{{ReportID: "r-1"}}
	svc := &mockSvc{
		getReportHistoryFn: func(ctx context.Context, tenantID string, limit int) ([]*eff_models.EfficiencyReport, error) {
			return reports, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetReportHistory, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetReportHistory_Error(t *testing.T) {
	svc := &mockSvc{
		getReportHistoryFn: func(ctx context.Context, tenantID string, limit int) ([]*eff_models.EfficiencyReport, error) {
			return nil, errors.New("db down")
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetReportHistory, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// ==================== Team / Project Metrics ====================

func TestHandler_GetTeamMetrics_Success(t *testing.T) {
	metrics := &eff_models.TeamMetrics{TeamID: "team-a", SuccessRate: 100.0}
	svc := &mockSvc{
		getTeamMetricsFn: func(ctx context.Context, tenantID, teamID string) (*eff_models.TeamMetrics, error) {
			return metrics, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetTeamMetrics, "GET", nil, map[string]string{"teamId": "team-a"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetTeamMetrics_Error(t *testing.T) {
	svc := &mockSvc{
		getTeamMetricsFn: func(ctx context.Context, tenantID, teamID string) (*eff_models.TeamMetrics, error) {
			return nil, errors.New("db error")
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetTeamMetrics, "GET", nil, map[string]string{"teamId": "team-a"}, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestHandler_GetTeamMetrics_BadRequest(t *testing.T) {
	svc := &mockSvc{getTeamMetricsFn: func(ctx context.Context, tenantID, teamID string) (*eff_models.TeamMetrics, error) { return nil, nil }}
	h := newHandlerWithSvc(svc)
	// Empty teamId => BadRequest
	w := performRequest(h, h.GetTeamMetrics, "GET", nil, map[string]string{"teamId": ""}, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_GetProjectMetrics_Success(t *testing.T) {
	metrics := &eff_models.ProjectMetrics{ProjectID: "p-1", CommitCount: 42}
	svc := &mockSvc{
		getProjectMetricsFn: func(ctx context.Context, tenantID, projectID string) (*eff_models.ProjectMetrics, error) {
			return metrics, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetProjectMetrics, "GET", nil, map[string]string{"projectId": "p-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetAllTeams_Success(t *testing.T) {
	teams := []eff_models.TeamInfo{{TeamID: "platform", TeamName: "Platform"}}
	svc := &mockSvc{
		getAllTeamsFn: func(ctx context.Context, tenantID string) []eff_models.TeamInfo {
			return teams
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetAllTeams, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== Period Comparison ====================

func TestHandler_ComparePeriods_Success(t *testing.T) {
	now := time.Now().UTC()
	result := &eff_models.PeriodComparisonResult{
		PeriodA: eff_models.PeriodMetrics{Label: "A"},
		PeriodB: eff_models.PeriodMetrics{Label: "B"},
	}
	svc := &mockSvc{
		comparePeriodsFn: func(ctx context.Context, tenantID string, a, b eff_models.PeriodSpec) (*eff_models.PeriodComparisonResult, error) {
			return result, nil
		},
	}
	h := newHandlerWithSvc(svc)
	body := eff_models.ComparePeriodsRequest{
		PeriodA: &eff_models.PeriodSpec{Label: "A", Start: now.Add(-14*24*time.Hour), End: now.Add(-7*24*time.Hour)},
		PeriodB: &eff_models.PeriodSpec{Label: "B", Start: now.Add(-7*24*time.Hour), End: now},
	}
	w := performRequest(h, h.ComparePeriods, "POST", body, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ComparePeriods_BadRequest(t *testing.T) {
	svc := &mockSvc{}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.ComparePeriods, "POST", eff_models.ComparePeriodsRequest{}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// ==================== DORA ====================

func TestHandler_GetAllDORA_Success(t *testing.T) {
	dora := &eff_models.AllDORAResult{ComputedAt: time.Now().UTC()}
	svc := &mockSvc{
		getAllDORAFn: func(ctx context.Context, tenantID string, deployments []eff_models.DeploymentRecord, pipelines []eff_models.PipelineCompletionRecord, incidents []eff_models.IncidentRecord, tw eff_models.TimeWindow, ws int) (*eff_models.AllDORAResult, error) {
			return dora, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetAllDORA, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetDORATrend_Success(t *testing.T) {
	trend := &eff_models.DORATrendResult{Current: eff_models.AllDORAResult{}}
	svc := &mockSvc{
		getDORATrendFn: func(ctx context.Context, tenantID string, deployments []eff_models.DeploymentRecord, pipelines []eff_models.PipelineCompletionRecord, incidents []eff_models.IncidentRecord, tw eff_models.TimeWindow, ws int) (*eff_models.DORATrendResult, error) {
			return trend, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetDORATrend, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== Dashboard ====================

func TestHandler_GetDashboard_Success(t *testing.T) {
	dash := &eff_models.DashboardData{DORA: eff_models.DashboardDORA{DeploymentFrequency: 2.5}}
	svc := &mockSvc{
		getDashboardDataFn: func(ctx context.Context, tenantID string, tw eff_models.TimeWindow, ws int) *eff_models.DashboardData {
			return dash
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetDashboard, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== Trends ====================

func TestHandler_GetTrends_Success(t *testing.T) {
	snapshots := []eff_models.HistoricalSnapshotWeek{{Week: "7/1"}}
	svc := &mockSvc{
		getHistoricalSnapshotsFn: func(ctx context.Context, tenantID string, weeks int) ([]eff_models.HistoricalSnapshotWeek, error) {
			return snapshots, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetTrends, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetTrends_Error(t *testing.T) {
	svc := &mockSvc{
		getHistoricalSnapshotsFn: func(ctx context.Context, tenantID string, weeks int) ([]eff_models.HistoricalSnapshotWeek, error) {
			return nil, errors.New("db error")
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetTrends, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// ==================== Bottlenecks ====================

func TestHandler_GetBottlenecks_Success(t *testing.T) {
	bns := []eff_models.Bottleneck{{ID: "bn-001"}}
	svc := &mockSvc{
		getBottlenecksFn: func(ctx context.Context, tenantID string, tw eff_models.TimeWindow, ws int) []eff_models.Bottleneck {
			return bns
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetBottlenecks, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== Developer Profiles ====================

func TestHandler_GetDeveloperProfiles_Success(t *testing.T) {
	profiles := []eff_models.DeveloperProfile{{ID: "dev-1"}}
	svc := &mockSvc{
		getDeveloperProfilesFn: func(ctx context.Context, tenantID string) []eff_models.DeveloperProfile {
			return profiles
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetDeveloperProfiles, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
