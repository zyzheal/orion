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

	"orion/platform-svc-go/internal/ai-decisions/models"
	"orion/platform-svc-go/internal/ai-decisions/service"

	"github.com/gin-gonic/gin"
)

// --- mock service (implements Service interface) ---

type mockSvc struct {
	listFn           func(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.AIDecision, int64, error)
	createFn         func(ctx context.Context, tenantID, userID string, req *models.RecordDecisionRequest) (*models.AIDecision, error)
	getFn            func(ctx context.Context, id, tenantID string) (*models.AIDecision, error)
	deleteFn         func(ctx context.Context, id, tenantID string) (bool, error)
	getExplanationFn func(ctx context.Context, id, tenantID string) (*service.ExplanationResult, error)
	submitFeedbackFn func(ctx context.Context, tenantID, userID, decisionID string, req *models.SubmitFeedbackRequest) (*models.AIDecision, error)
	getTracesFn      func(ctx context.Context, decisionID, tenantID string) ([]models.DecisionTrace, error)
	getStatsFn       func(ctx context.Context, tenantID string, dateRange *models.DateRange) (*models.DecisionStats, error)
	analyzeFn        func(ctx context.Context, tenantID string, req *models.AnalyzeDecisionsRequest) (*models.AnalyzeDecisionsResult, error)
}

func (m *mockSvc) ListDecisions(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.AIDecision, int64, error) {
	if m.listFn != nil { return m.listFn(ctx, tenantID, q) }
	return nil, 0, nil
}
func (m *mockSvc) RecordDecision(ctx context.Context, tenantID, userID string, req *models.RecordDecisionRequest) (*models.AIDecision, error) {
	if m.createFn != nil { return m.createFn(ctx, tenantID, userID, req) }
	return nil, nil
}
func (m *mockSvc) GetDecision(ctx context.Context, id, tenantID string) (*models.AIDecision, error) {
	if m.getFn != nil { return m.getFn(ctx, id, tenantID) }
	return nil, nil
}
func (m *mockSvc) DeleteDecision(ctx context.Context, id, tenantID string) (bool, error) {
	if m.deleteFn != nil { return m.deleteFn(ctx, id, tenantID) }
	return false, nil
}
func (m *mockSvc) GetExplanation(ctx context.Context, id, tenantID string) (*service.ExplanationResult, error) {
	if m.getExplanationFn != nil { return m.getExplanationFn(ctx, id, tenantID) }
	return nil, nil
}
func (m *mockSvc) SubmitFeedback(ctx context.Context, tenantID, userID, decisionID string, req *models.SubmitFeedbackRequest) (*models.AIDecision, error) {
	if m.submitFeedbackFn != nil { return m.submitFeedbackFn(ctx, tenantID, userID, decisionID, req) }
	return nil, nil
}
func (m *mockSvc) GetTraces(ctx context.Context, decisionID, tenantID string) ([]models.DecisionTrace, error) {
	if m.getTracesFn != nil { return m.getTracesFn(ctx, decisionID, tenantID) }
	return nil, nil
}
func (m *mockSvc) GetStats(ctx context.Context, tenantID string, dateRange *models.DateRange) (*models.DecisionStats, error) {
	if m.getStatsFn != nil { return m.getStatsFn(ctx, tenantID, dateRange) }
	return nil, nil
}
func (m *mockSvc) AnalyzeDecisions(ctx context.Context, tenantID string, req *models.AnalyzeDecisionsRequest) (*models.AnalyzeDecisionsResult, error) {
	if m.analyzeFn != nil { return m.analyzeFn(ctx, tenantID, req) }
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

func makeDecision(id string) *models.AIDecision {
	return &models.AIDecision{
		ID:         id,
		Type:       "recommendation",
		Status:     "pending",
		Confidence: 0.85,
	}
}

func makeTrace(id, action string, step int) models.DecisionTrace {
	return models.DecisionTrace{
		ID:        id,
		DecisionID: "d1",
		Action:    action,
		Step:      step,
		Timestamp: time.Now().Unix(),
	}
}

func makeStats() *models.DecisionStats {
	return &models.DecisionStats{Total: 10, AvgConfidence: 0.8}
}

func makeAnalyzeResult() *models.AnalyzeDecisionsResult {
	return &models.AnalyzeDecisionsResult{
		AnalysisType: "pattern",
		Insights:     []models.AnalysisInsight{{Type: "pattern", Title: "test"}},
		Recommendations: []string{"recommendation 1"},
	}
}

// ==================== List ====================

func TestHandler_List_Success(t *testing.T) {
	decisions := []models.AIDecision{*makeDecision("d1")}
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.AIDecision, int64, error) { return decisions, 1, nil },
	})
	w := performRequest(h, h.List, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_List_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(ctx context.Context, tenantID string, q *models.ListQuery) ([]models.AIDecision, int64, error) { return nil, 0, errors.New("db down") },
	})
	w := performRequest(h, h.List, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

// ==================== Create ====================

func TestHandler_Create_Success(t *testing.T) {
	d := makeDecision("d1")
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID, userID string, req *models.RecordDecisionRequest) (*models.AIDecision, error) { return d, nil },
	})
	w := performRequest(h, h.Create, "POST", models.RecordDecisionRequest{
		Type: "recommendation",
		Input:  map[string]interface{}{"key": "val"},
		Output: map[string]interface{}{"result": "ok"},
		Confidence: 0.9,
		Reasoning:  models.DecisionReasoning{Summary: "test"},
	}, nil, nil)
	if w.Code != http.StatusCreated { t.Fatalf("expected 201, got %d", w.Code) }
}

func TestHandler_Create_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.Create, "POST", map[string]interface{}{"bad": "data"}, nil, nil)
	if w.Code != http.StatusBadRequest { t.Fatalf("expected 400, got %d", w.Code) }
}

func TestHandler_Create_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID, userID string, req *models.RecordDecisionRequest) (*models.AIDecision, error) { return nil, errors.New("db err") },
	})
	w := performRequest(h, h.Create, "POST", models.RecordDecisionRequest{
		Type: "recommendation",
		Input:  map[string]interface{}{"key": "val"},
		Output: map[string]interface{}{"result": "ok"},
		Confidence: 0.9,
		Reasoning:  models.DecisionReasoning{Summary: "test"},
	}, nil, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

// ==================== Get ====================

func TestHandler_Get_Success(t *testing.T) {
	d := makeDecision("d1")
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(ctx context.Context, id, tenantID string) (*models.AIDecision, error) { return d, nil },
	})
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_Get_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(ctx context.Context, id, tenantID string) (*models.AIDecision, error) { return nil, service.ErrDecisionNotFound },
	})
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound { t.Fatalf("expected 404, got %d", w.Code) }
}

// ==================== Delete ====================

func TestHandler_Delete_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteFn: func(ctx context.Context, id, tenantID string) (bool, error) { return true, nil },
	})
	w := performRequest(h, h.Delete, "DELETE", nil, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_Delete_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteFn: func(ctx context.Context, id, tenantID string) (bool, error) { return false, nil },
	})
	w := performRequest(h, h.Delete, "DELETE", nil, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusNotFound { t.Fatalf("expected 404, got %d", w.Code) }
}

// ==================== GetExplanation ====================

func TestHandler_GetExplanation_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getExplanationFn: func(ctx context.Context, id, tenantID string) (*service.ExplanationResult, error) { return &service.ExplanationResult{Explanation: "test"}, nil },
	})
	w := performRequest(h, h.GetExplanation, "GET", nil, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetExplanation_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getExplanationFn: func(ctx context.Context, id, tenantID string) (*service.ExplanationResult, error) { return nil, service.ErrDecisionNotFound },
	})
	w := performRequest(h, h.GetExplanation, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound { t.Fatalf("expected 404, got %d", w.Code) }
}

// ==================== SubmitFeedback ====================

func TestHandler_SubmitFeedback_Success(t *testing.T) {
	d := makeDecision("d1")
	h := newHandlerWithSvc(&mockSvc{
		submitFeedbackFn: func(ctx context.Context, tenantID, userID, decisionID string, req *models.SubmitFeedbackRequest) (*models.AIDecision, error) { return d, nil },
	})
	w := performRequest(h, h.SubmitFeedback, "POST", models.SubmitFeedbackRequest{Type: "positive"}, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_SubmitFeedback_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.SubmitFeedback, "POST", map[string]interface{}{"bad": "data"}, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusBadRequest { t.Fatalf("expected 400, got %d", w.Code) }
}

// ==================== GetTraces ====================

func TestHandler_GetTraces_Success(t *testing.T) {
	traces := []models.DecisionTrace{makeTrace("t1", "inference", 1)}
	h := newHandlerWithSvc(&mockSvc{
		getTracesFn: func(ctx context.Context, decisionID, tenantID string) ([]models.DecisionTrace, error) { return traces, nil },
	})
	w := performRequest(h, h.GetTraces, "GET", nil, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetTraces_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getTracesFn: func(ctx context.Context, decisionID, tenantID string) ([]models.DecisionTrace, error) { return nil, service.ErrDecisionNotFound },
	})
	w := performRequest(h, h.GetTraces, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound { t.Fatalf("expected 404, got %d", w.Code) }
}

// ==================== GetStats ====================

func TestHandler_GetStats_Success(t *testing.T) {
	stats := makeStats()
	h := newHandlerWithSvc(&mockSvc{
		getStatsFn: func(ctx context.Context, tenantID string, dateRange *models.DateRange) (*models.DecisionStats, error) { return stats, nil },
	})
	w := performRequest(h, h.GetStats, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetStats_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getStatsFn: func(ctx context.Context, tenantID string, dateRange *models.DateRange) (*models.DecisionStats, error) { return nil, errors.New("db down") },
	})
	w := performRequest(h, h.GetStats, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

// ==================== AnalyzeDecisions ====================

func TestHandler_AnalyzeDecisions_Success(t *testing.T) {
	result := makeAnalyzeResult()
	h := newHandlerWithSvc(&mockSvc{
		analyzeFn: func(ctx context.Context, tenantID string, req *models.AnalyzeDecisionsRequest) (*models.AnalyzeDecisionsResult, error) { return result, nil },
	})
	w := performRequest(h, h.AnalyzeDecisions, "POST", models.AnalyzeDecisionsRequest{AnalysisType: "pattern"}, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_AnalyzeDecisions_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.AnalyzeDecisions, "POST", models.AnalyzeDecisionsRequest{}, nil, nil)
	if w.Code != http.StatusBadRequest { t.Fatalf("expected 400, got %d", w.Code) }
}
