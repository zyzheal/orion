package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/workflow-dependency/models"
	"orion/platform-svc-go/internal/workflow-dependency/service"

	"github.com/gin-gonic/gin"
)

// --- mock service (implements Service interface) ---

type mockSvc struct {
	getGraphFn          func(ctx context.Context, tenantID string) (*models.DependencyGraph, error)
	checkDefinitionFn   func(ctx context.Context, definitionID string, tenantID string) (*models.DependencyCheck, error)
	getVisualizationFn  func(ctx context.Context, tenantID string) (*models.VisualizationData, error)
}

func (m *mockSvc) GetGraph(ctx context.Context, tenantID string) (*models.DependencyGraph, error) {
	if m.getGraphFn != nil { return m.getGraphFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) CheckDefinition(ctx context.Context, definitionID string, tenantID string) (*models.DependencyCheck, error) {
	if m.checkDefinitionFn != nil { return m.checkDefinitionFn(ctx, definitionID, tenantID) }
	return nil, nil
}
func (m *mockSvc) GetVisualization(ctx context.Context, tenantID string) (*models.VisualizationData, error) {
	if m.getVisualizationFn != nil { return m.getVisualizationFn(ctx, tenantID) }
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

// ==================== GetGraph ====================

func TestHandler_GetGraph_Success(t *testing.T) {
	graph := &models.DependencyGraph{TotalEdges: 1,
		IsSafe: true, Cycles: []models.Cycle{}}
	h := newHandlerWithSvc(&mockSvc{
		getGraphFn: func(ctx context.Context, tenantID string) (*models.DependencyGraph, error) { return graph, nil },
	})
	w := performRequest(h, h.GetGraph, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetGraph_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getGraphFn: func(ctx context.Context, tenantID string) (*models.DependencyGraph, error) { return nil, errors.New("db down") },
	})
	w := performRequest(h, h.GetGraph, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

// ==================== CheckDefinition ====================

func TestHandler_CheckDefinition_Success(t *testing.T) {
	check := &models.DependencyCheck{IsSafe: true}
	h := newHandlerWithSvc(&mockSvc{
		checkDefinitionFn: func(ctx context.Context, definitionID string, tenantID string) (*models.DependencyCheck, error) { return check, nil },
	})
	w := performRequest(h, h.CheckDefinition, "GET", nil, map[string]string{"definitionId": "wf1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_CheckDefinition_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		checkDefinitionFn: func(ctx context.Context, definitionID string, tenantID string) (*models.DependencyCheck, error) { return nil, service.ErrWorkflowNotFound },
	})
	w := performRequest(h, h.CheckDefinition, "GET", nil, map[string]string{"definitionId": "x"}, nil)
	if w.Code != http.StatusNotFound { t.Fatalf("expected 404, got %d", w.Code) }
}

func TestHandler_CheckDefinition_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		checkDefinitionFn: func(ctx context.Context, definitionID string, tenantID string) (*models.DependencyCheck, error) { return nil, errors.New("db err") },
	})
	w := performRequest(h, h.CheckDefinition, "GET", nil, map[string]string{"definitionId": "wf1"}, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

// ==================== GetVisualization ====================

func TestHandler_GetVisualization_Success(t *testing.T) {
	viz := &models.VisualizationData{}
	h := newHandlerWithSvc(&mockSvc{
		getVisualizationFn: func(ctx context.Context, tenantID string) (*models.VisualizationData, error) { return viz, nil },
	})
	w := performRequest(h, h.GetVisualization, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetVisualization_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getVisualizationFn: func(ctx context.Context, tenantID string) (*models.VisualizationData, error) { return nil, errors.New("db down") },
	})
	w := performRequest(h, h.GetVisualization, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}
