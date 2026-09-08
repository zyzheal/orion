package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/audit/models"
	"orion/platform-svc-go/internal/audit/service"

	"github.com/gin-gonic/gin"
)

// --- mock service (implements Service interface) ---

type mockSvc struct {
	listFn             func(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogListResult, error)
	getFn              func(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, error)
	createFn           func(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLogEntry, error)
	verifySingleFn     func(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, bool, error)
	verifyChainFn      func(ctx context.Context, tenantID string) (*models.ChainVerifyResult, error)
	getActionsFn       func(ctx context.Context, tenantID string) ([]string, error)
	getResourceTypesFn func(ctx context.Context, tenantID string) ([]string, error)
	complianceReportFn     func(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error)
	coverageStatsFn        func(ctx context.Context, tenantID string) (*models.AuditCoverageStats, error)
	dashboardOverviewFn    func(ctx context.Context, tenantID string) (*models.ComplianceDashboardOverview, error)
	riskMatrixFn           func(ctx context.Context, tenantID string) (*models.ComplianceRiskMatrix, error)
	scoreTrendFn           func(ctx context.Context, tenantID string, days int) (*models.ComplianceScoreTrend, error)
	chainInfoFn            func(ctx context.Context, tenantID string) (*models.ChainInfo, error)
	storageStatsFn         func(ctx context.Context, tenantID string) (*models.StorageStats, error)
	exportFn               func(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogExportResult, error)
}

func (m *mockSvc) List(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogListResult, error) {
	if m.listFn != nil {
		return m.listFn(ctx, tenantID, q)
	}
	return nil, nil
}
func (m *mockSvc) Get(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, error) {
	if m.getFn != nil {
		return m.getFn(ctx, tenantID, id)
	}
	return nil, nil
}
func (m *mockSvc) Create(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLogEntry, error) {
	if m.createFn != nil {
		return m.createFn(ctx, tenantID, req)
	}
	return nil, nil
}
func (m *mockSvc) VerifySingle(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, bool, error) {
	if m.verifySingleFn != nil {
		return m.verifySingleFn(ctx, tenantID, id)
	}
	return nil, false, nil
}
func (m *mockSvc) VerifyChain(ctx context.Context, tenantID string) (*models.ChainVerifyResult, error) {
	if m.verifyChainFn != nil {
		return m.verifyChainFn(ctx, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) GetActions(ctx context.Context, tenantID string) ([]string, error) {
	if m.getActionsFn != nil {
		return m.getActionsFn(ctx, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) GetResourceTypes(ctx context.Context, tenantID string) ([]string, error) {
	if m.getResourceTypesFn != nil {
		return m.getResourceTypesFn(ctx, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) ComplianceReport(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error) {
	if m.complianceReportFn != nil {
		return m.complianceReportFn(ctx, tenantID, framework)
	}
	return nil, nil
}
func (m *mockSvc) CoverageStats(ctx context.Context, tenantID string) (*models.AuditCoverageStats, error) {
	if m.coverageStatsFn != nil {
		return m.coverageStatsFn(ctx, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) ChainInfo(ctx context.Context, tenantID string) (*models.ChainInfo, error) {
	if m.chainInfoFn != nil {
		return m.chainInfoFn(ctx, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) StorageStats(ctx context.Context, tenantID string) (*models.StorageStats, error) {
	if m.storageStatsFn != nil {
		return m.storageStatsFn(ctx, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) Export(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogExportResult, error) {
	if m.exportFn != nil {
		return m.exportFn(ctx, tenantID, q)
	}
	return nil, nil
}
func (m *mockSvc) DashboardOverview(ctx context.Context, tenantID string) (*models.ComplianceDashboardOverview, error) {
	if m.dashboardOverviewFn != nil {
		return m.dashboardOverviewFn(ctx, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) RiskMatrix(ctx context.Context, tenantID string) (*models.ComplianceRiskMatrix, error) {
	if m.riskMatrixFn != nil {
		return m.riskMatrixFn(ctx, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) ScoreTrend(ctx context.Context, tenantID string, days int) (*models.ComplianceScoreTrend, error) {
	if m.scoreTrendFn != nil {
		return m.scoreTrendFn(ctx, tenantID, days)
	}
	return nil, nil
}

func newHandlerWithSvc(svc Service) *Handler {
	return &Handler{svc: svc}
}

func performRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")

	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, "/", buf)
	c.Params = gin.Params{}
	for k, v := range pathParams {
		c.Params = append(c.Params, gin.Param{Key: k, Value: v})
	}
	for k, v := range queryParams {
		q := c.Request.URL.Query()
		q.Add(k, v)
		c.Request.URL.RawQuery = q.Encode()
	}

	handlerFn(c)
	return w
}

func makeLogEntry(id string) *models.AuditLogEntry {
	return &models.AuditLogEntry{ID: id, Action: "CREATE", UserID: "user-1"}
}

func makeListResult() *models.AuditLogListResult {
	return &models.AuditLogListResult{
		Entries: []models.AuditLogEntry{{ID: "l1", Action: "CREATE"}},
		Total:   1,
	}
}

// ==================== ListLogs ====================

func TestHandler_ListLogs_Success(t *testing.T) {
	result := makeListResult()
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogListResult, error) {
			return result, nil
		},
	})
	w := performRequest(h, h.ListLogs, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ListLogs_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogListResult, error) {
			return nil, errors.New("db down")
		},
	})
	w := performRequest(h, h.ListLogs, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// ==================== GetLog ====================

func TestHandler_GetLog_Success(t *testing.T) {
	entry := makeLogEntry("l1")
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, error) { return entry, nil },
	})
	w := performRequest(h, h.GetLog, "GET", nil, map[string]string{"id": "l1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetLog_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, error) {
			return nil, service.ErrNotFound
		},
	})
	w := performRequest(h, h.GetLog, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ==================== CreateLog ====================

func TestHandler_CreateLog_Success(t *testing.T) {
	entry := makeLogEntry("l1")
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLogEntry, error) {
			return entry, nil
		},
	})
	w := performRequest(h, h.CreateLog, "POST", models.AuditLogCreateRequest{Action: "CREATE"}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_CreateLog_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.CreateLog, "POST", map[string]interface{}{"bad": "data"}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_CreateLog_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLogEntry, error) {
			return nil, errors.New("db err")
		},
	})
	w := performRequest(h, h.CreateLog, "POST", models.AuditLogCreateRequest{Action: "CREATE"}, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// ==================== VerifySingle ====================

func TestHandler_VerifySingle_Success(t *testing.T) {
	entry := makeLogEntry("l1")
	h := newHandlerWithSvc(&mockSvc{
		verifySingleFn: func(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, bool, error) {
			return entry, true, nil
		},
	})
	w := performRequest(h, h.VerifySingle, "GET", nil, map[string]string{"id": "l1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_VerifySingle_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		verifySingleFn: func(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, bool, error) {
			return nil, false, service.ErrNotFound
		},
	})
	w := performRequest(h, h.VerifySingle, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ==================== VerifyChain ====================

func TestHandler_VerifyChain_Success(t *testing.T) {
	result := &models.ChainVerifyResult{Valid: true, TotalVerified: 10}
	h := newHandlerWithSvc(&mockSvc{
		verifyChainFn: func(ctx context.Context, tenantID string) (*models.ChainVerifyResult, error) { return result, nil },
	})
	w := performRequest(h, h.VerifyChain, "POST", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_VerifyChain_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		verifyChainFn: func(ctx context.Context, tenantID string) (*models.ChainVerifyResult, error) {
			return nil, errors.New("chain err")
		},
	})
	w := performRequest(h, h.VerifyChain, "POST", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// ==================== Actions ====================

func TestHandler_Actions_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getActionsFn: func(ctx context.Context, tenantID string) ([]string, error) { return []string{"CREATE"}, nil },
	})
	w := performRequest(h, h.Actions, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== ComplianceSOC2 ====================

func TestHandler_ComplianceSOC2_Success(t *testing.T) {
	report := &models.ComplianceReport{ReportType: "SOC2", Score: 90}
	h := newHandlerWithSvc(&mockSvc{
		complianceReportFn: func(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error) {
			return report, nil
		},
	})
	w := performRequest(h, h.ComplianceSOC2, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ComplianceSOC2_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		complianceReportFn: func(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error) {
			return nil, errors.New("db err")
		},
	})
	w := performRequest(h, h.ComplianceSOC2, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// ==================== Phase 304: CompliancePCIDSS / MLPS2 / PDPA / List ====================

func TestHandler_CompliancePCIDSS_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		complianceReportFn: func(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error) {
			if framework != "PCI-DSS" {
				t.Errorf("handler called service with framework=%q, want PCI-DSS", framework)
			}
			return &models.ComplianceReport{ReportType: "PCI-DSS", TotalControls: 36}, nil
		},
	})
	w := performRequest(h, h.CompliancePCIDSS, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_CompliancePCIDSS_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		complianceReportFn: func(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error) {
			return nil, errors.New("boom")
		},
	})
	w := performRequest(h, h.CompliancePCIDSS, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestHandler_ComplianceMLPS2_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		complianceReportFn: func(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error) {
			if framework != "MLPS2" {
				t.Errorf("handler called service with framework=%q, want MLPS2", framework)
			}
			return &models.ComplianceReport{ReportType: "MLPS2", TotalControls: 21}, nil
		},
	})
	w := performRequest(h, h.ComplianceMLPS2, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_CompliancePDPA_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		complianceReportFn: func(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error) {
			if framework != "PDPA" {
				t.Errorf("handler called service with framework=%q, want PDPA", framework)
			}
			return &models.ComplianceReport{ReportType: "PDPA", TotalControls: 12}, nil
		},
	})
	w := performRequest(h, h.CompliancePDPA, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ComplianceList_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.ComplianceList, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	body := w.Body.String()
	for _, fw := range []string{"SOC2", "ISO27001", "PCI-DSS", "MLPS2", "PDPA"} {
		if !strings.Contains(body, fw) {
			t.Errorf("ComplianceList response missing %s (body: %s)", fw, body)
		}
	}
	if !strings.Contains(body, `"count":5`) {
		t.Errorf("ComplianceList response missing count=5 (body: %s)", body)
	}
}

// ==================== ComplianceCoverage ====================

func TestHandler_ComplianceCoverage_Success(t *testing.T) {
	stats := &models.AuditCoverageStats{OverallCoveragePct: 80}
	h := newHandlerWithSvc(&mockSvc{
		coverageStatsFn: func(ctx context.Context, tenantID string) (*models.AuditCoverageStats, error) { return stats, nil },
	})
	w := performRequest(h, h.ComplianceCoverage, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== ChainGenesis ====================

func TestHandler_ChainGenesis_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.ChainGenesis, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== StorageFlush ====================

func TestHandler_StorageFlush_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.StorageFlush, "POST", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== ExportJSON ====================

func TestHandler_ExportJSON_Success(t *testing.T) {
	result := &models.AuditLogExportResult{Filename: "export.json", Content: "[]"}
	h := newHandlerWithSvc(&mockSvc{
		exportFn: func(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogExportResult, error) {
			return result, nil
		},
	})
	w := performRequest(h, h.ExportJSON, "POST", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ExportJSON_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		exportFn: func(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogExportResult, error) {
			return nil, errors.New("db err")
		},
	})
	w := performRequest(h, h.ExportJSON, "POST", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// ==================== Phase 305: Compliance Dashboard / RiskMap / Trend ====================

func TestHandler_ComplianceDashboard_Success(t *testing.T) {
	ov := &models.ComplianceDashboardOverview{
		FrameworkScores: []models.FrameworkScore{
			{Framework: "SOC2", Score: 90, Rating: "compliant", TotalControls: 6, PassedControls: 5},
		},
		OverallScore:  90,
		OverallRating: "compliant",
		AssessedAt:    "2026-08-26T00:00:00Z",
	}
	h := newHandlerWithSvc(&mockSvc{
		dashboardOverviewFn: func(ctx context.Context, tenantID string) (*models.ComplianceDashboardOverview, error) {
			if tenantID != "tenant-1" {
				t.Errorf("tenantID = %q, want tenant-1", tenantID)
			}
			return ov, nil
		},
	})
	w := performRequest(h, h.ComplianceDashboard, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, `"overallRating":"compliant"`) {
		t.Errorf("response missing overallRating=compliant (body: %s)", body)
	}
	if !strings.Contains(body, `"SOC2"`) {
		t.Errorf("response missing SOC2 (body: %s)", body)
	}
}

func TestHandler_ComplianceDashboard_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		dashboardOverviewFn: func(ctx context.Context, tenantID string) (*models.ComplianceDashboardOverview, error) {
			return nil, errors.New("boom")
		},
	})
	w := performRequest(h, h.ComplianceDashboard, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestHandler_ComplianceRiskMap_Success(t *testing.T) {
	mx := &models.ComplianceRiskMatrix{
		FrameworkRows:   []models.FrameworkRiskRow{{Framework: "SOC2", High: 3, TotalFindings: 3}},
		SeverityBuckets: []string{"low", "medium", "high", "critical"},
		TotalFindings:   3,
	}
	h := newHandlerWithSvc(&mockSvc{
		riskMatrixFn: func(ctx context.Context, tenantID string) (*models.ComplianceRiskMatrix, error) { return mx, nil },
	})
	w := performRequest(h, h.ComplianceRiskMap, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, `"totalFindings":3`) {
		t.Errorf("response missing totalFindings=3 (body: %s)", body)
	}
}

func TestHandler_ComplianceRiskMap_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		riskMatrixFn: func(ctx context.Context, tenantID string) (*models.ComplianceRiskMatrix, error) {
			return nil, errors.New("boom")
		},
	})
	w := performRequest(h, h.ComplianceRiskMap, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestHandler_ComplianceTrend_DefaultDays(t *testing.T) {
	var capturedDays int
	trend := &models.ComplianceScoreTrend{Days: 30, Overall: []models.TrendPoint{{Date: "2026-08-26", Score: 0}}}
	h := newHandlerWithSvc(&mockSvc{
		scoreTrendFn: func(ctx context.Context, tenantID string, days int) (*models.ComplianceScoreTrend, error) {
			capturedDays = days
			return trend, nil
		},
	})
	w := performRequest(h, h.ComplianceTrend, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", w.Code, w.Body.String())
	}
	if capturedDays != 30 {
		t.Errorf("service was called with days=%d, want default 30", capturedDays)
	}
}

func TestHandler_ComplianceTrend_ExplicitDays(t *testing.T) {
	var capturedDays int
	h := newHandlerWithSvc(&mockSvc{
		scoreTrendFn: func(ctx context.Context, tenantID string, days int) (*models.ComplianceScoreTrend, error) {
			capturedDays = days
			return &models.ComplianceScoreTrend{Days: days}, nil
		},
	})
	w := performRequest(h, h.ComplianceTrend, "GET", nil, nil, map[string]string{"days": "7"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if capturedDays != 7 {
		t.Errorf("service was called with days=%d, want 7", capturedDays)
	}
}

func TestHandler_ComplianceTrend_BadDaysUsesDefault(t *testing.T) {
	var capturedDays int
	h := newHandlerWithSvc(&mockSvc{
		scoreTrendFn: func(ctx context.Context, tenantID string, days int) (*models.ComplianceScoreTrend, error) {
			capturedDays = days
			return &models.ComplianceScoreTrend{Days: days}, nil
		},
	})
	w := performRequest(h, h.ComplianceTrend, "GET", nil, nil, map[string]string{"days": "abc"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if capturedDays != 30 {
		t.Errorf("service was called with days=%d, want fallback 30 for invalid param", capturedDays)
	}
}

func TestHandler_ComplianceTrend_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		scoreTrendFn: func(ctx context.Context, tenantID string, days int) (*models.ComplianceScoreTrend, error) {
			return nil, errors.New("boom")
		},
	})
	w := performRequest(h, h.ComplianceTrend, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}
