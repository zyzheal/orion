package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/pipeline-graph/models"
	"orion/platform-svc-go/internal/pipeline-graph/repository"
	"orion/platform-svc-go/internal/pipeline-graph/service"

	"github.com/gin-gonic/gin"
)

// --- mock repository (implements service.PipelineGraphRepo) ---

type mockPipelineGraphRepo struct {
	pipeline *repository.PipelineDefinition
	err      error
}

func (m *mockPipelineGraphRepo) GetPipelineByID(_ context.Context, _ string) (*repository.PipelineDefinition, error) {
	return m.pipeline, m.err
}

// --- helpers ---

func newHandlerWithSvc(svc *service.Service) *Handler {
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

// ==================== ParseYaml ====================

func TestHandler_ParseYaml_Success(t *testing.T) {
	repo := &mockPipelineGraphRepo{}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.ParseYaml, "POST", models.YamlParseRequest{
		YamlDefinition: `apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
      type: build
      steps:
        - name: compile
          uses: actions/go@v1`,
	}, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ParseYaml_BadRequest(t *testing.T) {
	repo := &mockPipelineGraphRepo{}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.ParseYaml, "POST", "invalid json", nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// ==================== ToYaml ====================

func TestHandler_ToYaml_Success(t *testing.T) {
	repo := &mockPipelineGraphRepo{}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.ToYaml, "POST", models.YamlToJsonRequest{
		Graph: models.GraphData{
			Nodes: []models.GraphNode{{ID: "build", Name: "build", Type: "stage"}},
			Edges: []models.GraphEdge{},
		},
	}, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ToYaml_BadRequest(t *testing.T) {
	repo := &mockPipelineGraphRepo{}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.ToYaml, "POST", "invalid json", nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// ==================== Validate ====================

func TestHandler_Validate_Valid(t *testing.T) {
	repo := &mockPipelineGraphRepo{}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.Validate, "POST", models.ValidateRequest{
		YamlDefinition: `apiVersion: v1
kind: Pipeline
metadata:
  name: test
spec:
  stages:
    - name: build
      type: build
      steps:
        - name: compile
          uses: actions/go@v1`,
	}, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Validate_Invalid(t *testing.T) {
	repo := &mockPipelineGraphRepo{}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.Validate, "POST", models.ValidateRequest{
		YamlDefinition: "not yaml{}",
	}, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// ==================== GetGraph ====================

func TestHandler_GetGraph_Success(t *testing.T) {
	repo := &mockPipelineGraphRepo{
		pipeline: &repository.PipelineDefinition{
			ID:          "p1",
			Name:        "deploy-pipeline",
			YamlContent: `apiVersion: v1
kind: Pipeline
metadata:
  name: deploy
spec:
  stages:
    - name: deploy
      type: deploy
      steps:
        - name: release
          uses: kubectl@v1`,
		},
	}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.GetGraph, "GET", nil, map[string]string{"id": "p1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetGraph_NotFound(t *testing.T) {
	repo := &mockPipelineGraphRepo{
		err: service.ErrPipelineNotFound,
	}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.GetGraph, "GET", nil, map[string]string{"id": "nonexistent"}, nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestHandler_GetGraph_InternalError(t *testing.T) {
	repo := &mockPipelineGraphRepo{
		err: errors.New("db connection failed"),
	}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)

	w := performRequest(h, h.GetGraph, "GET", nil, map[string]string{"id": "p1"}, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}
