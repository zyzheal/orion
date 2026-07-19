package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/test-selector/models"

	"github.com/gin-gonic/gin"
)

type mockSvc struct {
	listFilesFn      func(ctx context.Context, tenantID string) ([]string, error)
	getCoverageFn    func(ctx context.Context, tenantID string) (models.CoverageStats, error)
	listSuitesFn     func(ctx context.Context, tenantID string) ([]models.TestSuite, error)
	getSuiteFn       func(ctx context.Context, tenantID, id string) (*models.TestSuite, error)
	createSuiteFn    func(ctx context.Context, tenantID string, req models.CreateTestSuiteRequest) (*models.TestSuite, error)
	updateSuiteFn    func(ctx context.Context, tenantID, id string, req models.UpdateTestSuiteRequest) (*models.TestSuite, error)
	deleteSuiteFn    func(ctx context.Context, tenantID, id string) error
	impactFn         func(ctx context.Context, tenantID, file string) (*models.ImpactAnalysisResult, error)
	recommendFn      func(ctx context.Context, tenantID string, req models.RecommendationRequest) (*models.TestExecutionPlan, error)
	statsFn          func(ctx context.Context, tenantID string) (*models.TestSelectorStats, error)
	runSuiteFn       func(ctx context.Context, tenantID, id string) error
}

func (m *mockSvc) ListFiles(ctx context.Context, tenantID string) ([]string, error) {
	if m.listFilesFn != nil { return m.listFilesFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) GetCoverage(ctx context.Context, tenantID string) (models.CoverageStats, error) {
	if m.getCoverageFn != nil { return m.getCoverageFn(ctx, tenantID) }
	return models.CoverageStats{}, nil
}
func (m *mockSvc) ListTestSuites(ctx context.Context, tenantID string) ([]models.TestSuite, error) {
	if m.listSuitesFn != nil { return m.listSuitesFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) GetTestSuite(ctx context.Context, tenantID, id string) (*models.TestSuite, error) {
	if m.getSuiteFn != nil { return m.getSuiteFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) CreateTestSuite(ctx context.Context, tenantID string, req models.CreateTestSuiteRequest) (*models.TestSuite, error) {
	if m.createSuiteFn != nil { return m.createSuiteFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) UpdateTestSuite(ctx context.Context, tenantID, id string, req models.UpdateTestSuiteRequest) (*models.TestSuite, error) {
	if m.updateSuiteFn != nil { return m.updateSuiteFn(ctx, tenantID, id, req) }
	return nil, nil
}
func (m *mockSvc) DeleteTestSuite(ctx context.Context, tenantID, id string) error {
	if m.deleteSuiteFn != nil { return m.deleteSuiteFn(ctx, tenantID, id) }
	return nil
}
func (m *mockSvc) GetImpactAnalysis(ctx context.Context, tenantID, file string) (*models.ImpactAnalysisResult, error) {
	if m.impactFn != nil { return m.impactFn(ctx, tenantID, file) }
	return nil, nil
}
func (m *mockSvc) GetRecommendations(ctx context.Context, tenantID string, req models.RecommendationRequest) (*models.TestExecutionPlan, error) {
	if m.recommendFn != nil { return m.recommendFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) GetStats(ctx context.Context, tenantID string) (*models.TestSelectorStats, error) {
	if m.statsFn != nil { return m.statsFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) RunTestSuite(ctx context.Context, tenantID, id string) error {
	if m.runSuiteFn != nil { return m.runSuiteFn(ctx, tenantID, id) }
	return nil
}

func newHandlerWithSvc(svc Service) *Handler {
	return &Handler{svc: svc}
}

func performRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
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

func TestHandler_ListFiles_Success(t *testing.T) {
	files := []string{"a.go", "b.go"}
	h := newHandlerWithSvc(&mockSvc{
		listFilesFn: func(ctx context.Context, tenantID string) ([]string, error) { return files, nil },
	})
	w := performRequest(h, h.ListFiles, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_ListFiles_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFilesFn: func(ctx context.Context, tenantID string) ([]string, error) { return nil, errors.New("db down") },
	})
	w := performRequest(h, h.ListFiles, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

func TestHandler_GetTestSuite_Success(t *testing.T) {
	s := &models.TestSuite{ID: "s1", Name: "smoke"}
	h := newHandlerWithSvc(&mockSvc{
		getSuiteFn: func(ctx context.Context, tenantID, id string) (*models.TestSuite, error) { return s, nil },
	})
	w := performRequest(h, h.GetTestSuite, "GET", nil, map[string]string{"id": "s1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetTestSuite_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getSuiteFn: func(ctx context.Context, tenantID, id string) (*models.TestSuite, error) { return nil, errors.New("not found") },
	})
	w := performRequest(h, h.GetTestSuite, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound { t.Fatalf("expected 404, got %d", w.Code) }
}

func TestHandler_CreateTestSuite_Success(t *testing.T) {
	s := &models.TestSuite{ID: "s1", Name: "new-suite"}
	h := newHandlerWithSvc(&mockSvc{
		createSuiteFn: func(ctx context.Context, tenantID string, req models.CreateTestSuiteRequest) (*models.TestSuite, error) { return s, nil },
	})
	w := performRequest(h, h.CreateTestSuite, "POST", models.CreateTestSuiteRequest{Name: "new-suite", FilePath: "tests/smoke.go"}, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_DeleteTestSuite_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteSuiteFn: func(ctx context.Context, tenantID, id string) error { return nil },
	})
	w := performRequest(h, h.DeleteTestSuite, "DELETE", nil, map[string]string{"id": "s1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetCoverage_Success(t *testing.T) {
	cs := models.CoverageStats{"main.go": models.CoverageEntry{TestCount: 5, TestIDs: []string{"t1"}}}
	h := newHandlerWithSvc(&mockSvc{
		getCoverageFn: func(ctx context.Context, tenantID string) (models.CoverageStats, error) { return cs, nil },
	})
	w := performRequest(h, h.GetCoverage, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetStats_Success(t *testing.T) {
	s := &models.TestSelectorStats{TotalSuites: 10, TotalCases: 50}
	h := newHandlerWithSvc(&mockSvc{
		statsFn: func(ctx context.Context, tenantID string) (*models.TestSelectorStats, error) { return s, nil },
	})
	w := performRequest(h, h.GetStats, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_RunTestSuite_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		runSuiteFn: func(ctx context.Context, tenantID, id string) error { return nil },
	})
	w := performRequest(h, h.RunTestSuite, "PUT", nil, map[string]string{"id": "s1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetImpactAnalysis_Success(t *testing.T) {
	imp := &models.ImpactAnalysisResult{Impacts: []models.TestImpact{}}
	h := newHandlerWithSvc(&mockSvc{
		impactFn: func(ctx context.Context, tenantID, file string) (*models.ImpactAnalysisResult, error) { return imp, nil },
	})
	w := performRequest(h, h.GetImpactAnalysis, "GET", nil, nil, map[string]string{"file": "a.go"})
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetRecommendations_Success(t *testing.T) {
	p := &models.TestExecutionPlan{PlanID: "p1"}
	h := newHandlerWithSvc(&mockSvc{
		recommendFn: func(ctx context.Context, tenantID string, req models.RecommendationRequest) (*models.TestExecutionPlan, error) { return p, nil },
	})
	w := performRequest(h, h.GetRecommendations, "POST", models.RecommendationRequest{ChangedFiles: []models.ChangedFile{models.ChangedFile{Path: "a.go", ChangeType: models.ChangeModified}}}, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}
