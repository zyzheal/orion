package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/diagnostic/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/diagnostic/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeHandlerService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

<<<<<<< Updated upstream
type fakeHandlerService struct{}

func (f *fakeHandlerService) AddPattern(ctx context.Context, tenantID string, req *models.CreatePatternRequest) (*models.Pattern, error) {
	return &models.Pattern{}, nil
}

func (f *fakeHandlerService) AddSymptomToSession(ctx context.Context, sessionID string, req *models.AddSymptomRequest) (*models.Session, error) {
	return &models.Session{}, nil
}

func (f *fakeHandlerService) CompleteSession(ctx context.Context, id string) (*models.SessionWithReport, error) {
	return &models.SessionWithReport{}, nil
}

func (f *fakeHandlerService) EstimateFixComplexity(ctx context.Context, sessionID string) (*models.ComplexityEstimate, error) {
	return &models.ComplexityEstimate{}, nil
}

func (f *fakeHandlerService) GetDiagnosticDetail(ctx context.Context, id string) (*models.Session, error) {
	return &models.Session{}, nil
}

func (f *fakeHandlerService) GetDiagnosticHistory(ctx context.Context, tenantID string, status, triggerType, triggerID *string) ([]models.Session, int, error) {
	return []models.Session{}, 0, nil
}

func (f *fakeHandlerService) GetKnowledgeBaseStats(ctx context.Context, tenantID string) (*models.KnowledgeBaseStats, error) {
	return &models.KnowledgeBaseStats{}, nil
}

func (f *fakeHandlerService) GetPattern(ctx context.Context, id string) (*models.Pattern, error) {
	return &models.Pattern{}, nil
}

func (f *fakeHandlerService) GetReport(ctx context.Context, id string) (*models.Report, error) {
	return &models.Report{}, nil
}

func (f *fakeHandlerService) GetReportBySession(ctx context.Context, sessionID string) (*models.Report, error) {
	return &models.Report{}, nil
}

func (f *fakeHandlerService) GetReportHistory(ctx context.Context, tenantID, sessionID *string) ([]models.Report, int, error) {
	return []models.Report{}, 0, nil
}

func (f *fakeHandlerService) GetStatus(ctx context.Context, tenantID string) (*struct{
	State    string `json:"state"`
	Sessions int    `json:"sessions"`
	Reports  int    `json:"reports"`
	Patterns int    `json:"patterns"`
}, error) {
	return &struct{
		State    string `json:"state"`
		Sessions int    `json:"sessions"`
		Reports  int    `json:"reports"`
		Patterns int    `json:"patterns"`
	}{}, nil
}

func (f *fakeHandlerService) RecordOutcome(ctx context.Context, tenantID string, req *models.RecordOutcomeRequest) (*models.Outcome, error) {
	return &models.Outcome{}, nil
}

func (f *fakeHandlerService) SearchPatterns(ctx context.Context, tenantID, category, keyword *string) ([]models.Pattern, int, error) {
	return []models.Pattern{}, 0, nil
}

func (f *fakeHandlerService) TriggerDiagnostic(ctx context.Context, tenantID string, req *models.CreateSessionRequest) (*models.TriggerResult, error) {
	return &models.TriggerResult{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)
=======
type fakediagnosticService struct{}

func (f *fakediagnosticService) AddPattern(ctx context.Context, tenantID string, req *models.CreatePatternRequest) ((*models.Pattern, error)) {
	return &models.Pattern{}, nil
}

func (f *fakediagnosticService) AddSymptomToSession(ctx context.Context, sessionID string, req *models.AddSymptomRequest) ((*models.Session, error)) {
	return &models.Session{}, nil
}

func (f *fakediagnosticService) CompleteSession(ctx context.Context, id string) ((*models.SessionWithReport, error)) {
	return &models.SessionWithReport{}, nil
}

func (f *fakediagnosticService) EstimateFixComplexity(ctx context.Context, sessionID string) ((*models.ComplexityEstimate, error)) {
	return &models.ComplexityEstimate{}, nil
}

func (f *fakediagnosticService) GetDiagnosticDetail(ctx context.Context, id string) ((*models.Session, error)) {
	return &models.Session{}, nil
}

func (f *fakediagnosticService) GetDiagnosticHistory(ctx context.Context, tenantID string, status, triggerType, triggerID *string) (([]models.Session, int, error)) {
	return []models.Session{}, 0, nil
}

func (f *fakediagnosticService) GetKnowledgeBaseStats(ctx context.Context, tenantID string) ((*models.KnowledgeBaseStats, error)) {
	return &models.KnowledgeBaseStats{}, nil
}

func (f *fakediagnosticService) GetPattern(ctx context.Context, id string) ((*models.Pattern, error)) {
	return &models.Pattern{}, nil
}

func (f *fakediagnosticService) GetReport(ctx context.Context, id string) ((*models.Report, error)) {
	return &models.Report{}, nil
}

func (f *fakediagnosticService) GetReportBySession(ctx context.Context, sessionID string) ((*models.Report, error)) {
	return &models.Report{}, nil
}

func (f *fakediagnosticService) GetReportHistory(ctx context.Context, tenantID, sessionID *string) (([]models.Report, int, error)) {
	return []models.Report{}, 0, nil
}

func (f *fakediagnosticService) GetStatus(ctx context.Context, tenantID string) ((*struct { State    string `json:"state"` Sessions int    `json:"sessions"` Reports  int    `json:"reports"` Patterns int    `json:"patterns"` }, error)) {
	return &struct { State    string `json:"state"` Sessions int    `json:"sessions"` Reports  int    `json:"reports"` Patterns int    `json:"patterns"` }{}, nil
}

func (f *fakediagnosticService) RecordOutcome(ctx context.Context, tenantID string, req *models.RecordOutcomeRequest) ((*models.Outcome, error)) {
	return &models.Outcome{}, nil
}

func (f *fakediagnosticService) SearchPatterns(ctx context.Context, tenantID, category, keyword *string) (([]models.Pattern, int, error)) {
	return []models.Pattern{}, 0, nil
}

func (f *fakediagnosticService) TriggerDiagnostic(ctx context.Context, tenantID string, req *models.CreateSessionRequest) ((*models.TriggerResult, error)) {
	return &models.TriggerResult{}, nil
}

var _ service.ServiceInterface = (*fakediagnosticService)(nil)
>>>>>>> Stashed changes


func TestHandler_DIAGNOSTIC_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DIAGNOSTIC_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_Trigger(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Trigger(c)
	if w.Code >= 500 {
		t.Fatalf("Trigger: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_ListSessions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSessions(c)
	if w.Code >= 500 {
		t.Fatalf("ListSessions: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_GetSession(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSession(c)
	if w.Code >= 500 {
		t.Fatalf("GetSession: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_AddSymptom(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddSymptom(c)
	if w.Code >= 500 {
		t.Fatalf("AddSymptom: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_CompleteSession(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CompleteSession(c)
	if w.Code >= 500 {
		t.Fatalf("CompleteSession: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_EstimateComplexity(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EstimateComplexity(c)
	if w.Code >= 500 {
		t.Fatalf("EstimateComplexity: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_ListReports(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListReports(c)
	if w.Code >= 500 {
		t.Fatalf("ListReports: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_GetReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetReport(c)
	if w.Code >= 500 {
		t.Fatalf("GetReport: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_AddPattern(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddPattern(c)
	if w.Code >= 500 {
		t.Fatalf("AddPattern: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_ListPatterns(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListPatterns(c)
	if w.Code >= 500 {
		t.Fatalf("ListPatterns: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_GetPattern(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetPattern(c)
	if w.Code >= 500 {
		t.Fatalf("GetPattern: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_RecordOutcome(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RecordOutcome(c)
	if w.Code >= 500 {
		t.Fatalf("RecordOutcome: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_GetStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetStatus: got %d", w.Code)
	}
}
