package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/audit/models"
	"orion/platform-svc-go/internal/audit/service"

	"github.com/gin-gonic/gin"
)

// --- mock service (implements Service interface) ---

type mockSvc struct {
	listFn            func(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogListResult, error)
	getFn             func(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, error)
	createFn          func(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLogEntry, error)
	verifySingleFn    func(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, bool, error)
	verifyChainFn     func(ctx context.Context, tenantID string) (*models.ChainVerifyResult, error)
	getActionsFn      func(ctx context.Context, tenantID string) ([]string, error)
	getResourceTypesFn func(ctx context.Context, tenantID string) ([]string, error)
	complianceReportFn func(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error)
	coverageStatsFn   func(ctx context.Context, tenantID string) (*models.AuditCoverageStats, error)
	chainInfoFn       func(ctx context.Context, tenantID string) (*models.ChainInfo, error)
	storageStatsFn    func(ctx context.Context, tenantID string) (*models.StorageStats, error)
	exportFn          func(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogExportResult, error)
}

func (m *mockSvc) List(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogListResult, error) {
	if m.listFn != nil { return m.listFn(ctx, tenantID, q) }
	return nil, nil
}
func (m *mockSvc) Get(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, error) {
	if m.getFn != nil { return m.getFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) Create(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLogEntry, error) {
	if m.createFn != nil { return m.createFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) VerifySingle(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, bool, error) {
	if m.verifySingleFn != nil { return m.verifySingleFn(ctx, tenantID, id) }
	return nil, false, nil
}
func (m *mockSvc) VerifyChain(ctx context.Context, tenantID string) (*models.ChainVerifyResult, error) {
	if m.verifyChainFn != nil { return m.verifyChainFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) GetActions(ctx context.Context, tenantID string) ([]string, error) {
	if m.getActionsFn != nil { return m.getActionsFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) GetResourceTypes(ctx context.Context, tenantID string) ([]string, error) {
	if m.getResourceTypesFn != nil { return m.getResourceTypesFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) ComplianceReport(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error) {
	if m.complianceReportFn != nil { return m.complianceReportFn(ctx, tenantID, framework) }
	return nil, nil
}
func (m *mockSvc) CoverageStats(ctx context.Context, tenantID string) (*models.AuditCoverageStats, error) {
	if m.coverageStatsFn != nil { return m.coverageStatsFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) ChainInfo(ctx context.Context, tenantID string) (*models.ChainInfo, error) {
	if m.chainInfoFn != nil { return m.chainInfoFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) StorageStats(ctx context.Context, tenantID string) (*models.StorageStats, error) {
	if m.storageStatsFn != nil { return m.storageStatsFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) Export(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogExportResult, error) {
	if m.exportFn != nil { return m.exportFn(ctx, tenantID, q) }
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
		listFn: func(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogListResult, error) { return result, nil },
	})
	w := performRequest(h, h.ListLogs, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_ListLogs_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogListResult, error) { return nil, errors.New("db down") },
	})
	w := performRequest(h, h.ListLogs, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

// ==================== GetLog ====================

func TestHandler_GetLog_Success(t *testing.T) {
	entry := makeLogEntry("l1")
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, error) { return entry, nil },
	})
	w := performRequest(h, h.GetLog, "GET", nil, map[string]string{"id": "l1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetLog_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, error) { return nil, service.ErrNotFound },
	})
	w := performRequest(h, h.GetLog, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound { t.Fatalf("expected 404, got %d", w.Code) }
}

// ==================== CreateLog ====================

func TestHandler_CreateLog_Success(t *testing.T) {
	entry := makeLogEntry("l1")
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLogEntry, error) { return entry, nil },
	})
	w := performRequest(h, h.CreateLog, "POST", models.AuditLogCreateRequest{Action: "CREATE"}, nil, nil)
	if w.Code != http.StatusCreated { t.Fatalf("expected 201, got %d", w.Code) }
}

func TestHandler_CreateLog_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.CreateLog, "POST", map[string]interface{}{"bad": "data"}, nil, nil)
	if w.Code != http.StatusBadRequest { t.Fatalf("expected 400, got %d", w.Code) }
}

func TestHandler_CreateLog_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLogEntry, error) { return nil, errors.New("db err") },
	})
	w := performRequest(h, h.CreateLog, "POST", models.AuditLogCreateRequest{Action: "CREATE"}, nil, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

// ==================== VerifySingle ====================

func TestHandler_VerifySingle_Success(t *testing.T) {
	entry := makeLogEntry("l1")
	h := newHandlerWithSvc(&mockSvc{
		verifySingleFn: func(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, bool, error) { return entry, true, nil },
	})
	w := performRequest(h, h.VerifySingle, "GET", nil, map[string]string{"id": "l1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_VerifySingle_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		verifySingleFn: func(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, bool, error) { return nil, false, service.ErrNotFound },
	})
	w := performRequest(h, h.VerifySingle, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound { t.Fatalf("expected 404, got %d", w.Code) }
}

// ==================== VerifyChain ====================

func TestHandler_VerifyChain_Success(t *testing.T) {
	result := &models.ChainVerifyResult{Valid: true, TotalVerified: 10}
	h := newHandlerWithSvc(&mockSvc{
		verifyChainFn: func(ctx context.Context, tenantID string) (*models.ChainVerifyResult, error) { return result, nil },
	})
	w := performRequest(h, h.VerifyChain, "POST", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_VerifyChain_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		verifyChainFn: func(ctx context.Context, tenantID string) (*models.ChainVerifyResult, error) { return nil, errors.New("chain err") },
	})
	w := performRequest(h, h.VerifyChain, "POST", nil, nil, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

// ==================== Actions ====================

func TestHandler_Actions_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getActionsFn: func(ctx context.Context, tenantID string) ([]string, error) { return []string{"CREATE"}, nil },
	})
	w := performRequest(h, h.Actions, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== ComplianceSOC2 ====================

func TestHandler_ComplianceSOC2_Success(t *testing.T) {
	report := &models.ComplianceReport{ReportType: "SOC2", Score: 90}
	h := newHandlerWithSvc(&mockSvc{
		complianceReportFn: func(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error) { return report, nil },
	})
	w := performRequest(h, h.ComplianceSOC2, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_ComplianceSOC2_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		complianceReportFn: func(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error) { return nil, errors.New("db err") },
	})
	w := performRequest(h, h.ComplianceSOC2, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

// ==================== ComplianceCoverage ====================

func TestHandler_ComplianceCoverage_Success(t *testing.T) {
	stats := &models.AuditCoverageStats{OverallCoveragePct: 80}
	h := newHandlerWithSvc(&mockSvc{
		coverageStatsFn: func(ctx context.Context, tenantID string) (*models.AuditCoverageStats, error) { return stats, nil },
	})
	w := performRequest(h, h.ComplianceCoverage, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== ChainGenesis ====================

func TestHandler_ChainGenesis_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.ChainGenesis, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== StorageFlush ====================

func TestHandler_StorageFlush_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.StorageFlush, "POST", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== ExportJSON ====================

func TestHandler_ExportJSON_Success(t *testing.T) {
	result := &models.AuditLogExportResult{Filename: "export.json", Content: "[]"}
	h := newHandlerWithSvc(&mockSvc{
		exportFn: func(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogExportResult, error) { return result, nil },
	})
	w := performRequest(h, h.ExportJSON, "POST", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_ExportJSON_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		exportFn: func(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogExportResult, error) { return nil, errors.New("db err") },
	})
	w := performRequest(h, h.ExportJSON, "POST", nil, nil, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}
