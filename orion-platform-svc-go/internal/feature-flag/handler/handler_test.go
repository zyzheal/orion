package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/feature-flag/models"
	"orion/platform-svc-go/internal/feature-flag/service"

	"github.com/gin-gonic/gin"
)

// --- mock Service (implements handler.Service) ---

type mockSvc struct {
	createFn         func(ctx context.Context, tenantID, createdBy string, req *models.CreateFlagRequest) (*models.FeatureFlag, error)
	getByIDFn        func(ctx context.Context, tenantID, id string) (*models.FeatureFlag, error)
	getByKeyFn       func(ctx context.Context, tenantID, key string) (*models.FeatureFlag, error)
	listFn           func(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.FeatureFlag, error)
	searchFn         func(ctx context.Context, tenantID, query string, offset, limit int) ([]models.FeatureFlag, error)
	updateFn         func(ctx context.Context, tenantID, id, updatedBy string, req *models.UpdateFlagRequest) (*models.FeatureFlag, error)
	deleteFn         func(ctx context.Context, tenantID, id string) error
	countFn          func(ctx context.Context, tenantID string) (int, error)
	setRolloutFn     func(ctx context.Context, tenantID, id, updatedBy string, pct int) (*models.FeatureFlag, error)
	recordToggleFn   func(ctx context.Context, flagID string, old, newVal bool, changedBy, reason string) error
	evaluateFlagFn   func(ctx context.Context, tenantID string, req *models.EvaluateFlagRequest) (*models.FlagEvaluationResult, error)
	evaluateFlagsFn  func(ctx context.Context, tenantID string, reqs []models.EvaluateFlagRequest) ([]models.FlagEvaluationResult, error)
	toggleHistoryFn  func(ctx context.Context, flagID string, limit int) ([]models.FlagToggleRecord, error)
}

func (m *mockSvc) Create(ctx context.Context, tenantID, createdBy string, req *models.CreateFlagRequest) (*models.FeatureFlag, error) {
	if m.createFn != nil { return m.createFn(ctx, tenantID, createdBy, req) }
	return nil, nil
}
func (m *mockSvc) GetByID(ctx context.Context, tenantID, id string) (*models.FeatureFlag, error) {
	if m.getByIDFn != nil { return m.getByIDFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) GetByKey(ctx context.Context, tenantID, key string) (*models.FeatureFlag, error) {
	if m.getByKeyFn != nil { return m.getByKeyFn(ctx, tenantID, key) }
	return nil, nil
}
func (m *mockSvc) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.FeatureFlag, error) {
	if m.listFn != nil { return m.listFn(ctx, tenantID, filter, offset, limit) }
	return nil, nil
}
func (m *mockSvc) Search(ctx context.Context, tenantID, query string, offset, limit int) ([]models.FeatureFlag, error) {
	if m.searchFn != nil { return m.searchFn(ctx, tenantID, query, offset, limit) }
	return nil, nil
}
func (m *mockSvc) Update(ctx context.Context, tenantID, id, updatedBy string, req *models.UpdateFlagRequest) (*models.FeatureFlag, error) {
	if m.updateFn != nil { return m.updateFn(ctx, tenantID, id, updatedBy, req) }
	return nil, nil
}
func (m *mockSvc) Delete(ctx context.Context, tenantID, id string) error {
	if m.deleteFn != nil { return m.deleteFn(ctx, tenantID, id) }
	return nil
}
func (m *mockSvc) Count(ctx context.Context, tenantID string) (int, error) {
	if m.countFn != nil { return m.countFn(ctx, tenantID) }
	return 0, nil
}
func (m *mockSvc) SetRolloutPercentage(ctx context.Context, tenantID, id, updatedBy string, pct int) (*models.FeatureFlag, error) {
	if m.setRolloutFn != nil { return m.setRolloutFn(ctx, tenantID, id, updatedBy, pct) }
	return nil, nil
}
func (m *mockSvc) RecordToggle(ctx context.Context, flagID string, old, newVal bool, changedBy, reason string) error {
	if m.recordToggleFn != nil { return m.recordToggleFn(ctx, flagID, old, newVal, changedBy, reason) }
	return nil
}
func (m *mockSvc) EvaluateFlag(ctx context.Context, tenantID string, req *models.EvaluateFlagRequest) (*models.FlagEvaluationResult, error) {
	if m.evaluateFlagFn != nil { return m.evaluateFlagFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) EvaluateFlags(ctx context.Context, tenantID string, reqs []models.EvaluateFlagRequest) ([]models.FlagEvaluationResult, error) {
	if m.evaluateFlagsFn != nil { return m.evaluateFlagsFn(ctx, tenantID, reqs) }
	return nil, nil
}
func (m *mockSvc) ListToggleHistory(ctx context.Context, flagID string, limit int) ([]models.FlagToggleRecord, error) {
	if m.toggleHistoryFn != nil { return m.toggleHistoryFn(ctx, flagID, limit) }
	return nil, nil
}

// --- helpers ---

func newHandlerWithSvc(svc Service) *Handler {
	return NewHandler(svc)
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

// ==================== Create ====================

func TestHandler_Create_Success(t *testing.T) {
	flag := &models.FeatureFlag{ID: "f1", Name: "dark-mode"}
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID, createdBy string, req *models.CreateFlagRequest) (*models.FeatureFlag, error) { return flag, nil },
	})
	w := performRequest(h, h.Create, "POST", models.CreateFlagRequest{Name: "dark-mode", Key: "dark_mode"}, nil, nil)
	if w.Code != http.StatusCreated { t.Fatalf("expected 201, got %d", w.Code) }
}

func TestHandler_Create_DuplicateKey(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID, createdBy string, req *models.CreateFlagRequest) (*models.FeatureFlag, error) { return nil, service.ErrDuplicateKey },
	})
	w := performRequest(h, h.Create, "POST", models.CreateFlagRequest{Name: "dark-mode", Key: "dark_mode"}, nil, nil)
	if w.Code != http.StatusConflict { t.Fatalf("expected 409, got %d", w.Code) }
}

func TestHandler_Create_Validation(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.Create, "POST", models.CreateFlagRequest{Key: "dark_mode"}, nil, nil)
	if w.Code != http.StatusBadRequest { t.Fatalf("expected 400, got %d", w.Code) }
}

// ==================== List ====================

func TestHandler_List_Success(t *testing.T) {
	flags := []models.FeatureFlag{{ID: "f1"}}
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.FeatureFlag, error) { return flags, nil },
	})
	w := performRequest(h, h.List, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_Search_Success(t *testing.T) {
	flags := []models.FeatureFlag{{ID: "f1"}}
	h := newHandlerWithSvc(&mockSvc{
		searchFn: func(ctx context.Context, tenantID, query string, offset, limit int) ([]models.FeatureFlag, error) { return flags, nil },
	})
	w := performRequest(h, h.Search, "GET", nil, nil, map[string]string{"q": "dark"})
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_Search_BadRequest_NoQuery(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.Search, "GET", nil, nil, nil)
	if w.Code != http.StatusBadRequest { t.Fatalf("expected 400, got %d", w.Code) }
}

// ==================== Get ====================

func TestHandler_Get_Success(t *testing.T) {
	flag := &models.FeatureFlag{ID: "f1", Name: "dark-mode"}
	h := newHandlerWithSvc(&mockSvc{
		getByIDFn: func(ctx context.Context, tenantID, id string) (*models.FeatureFlag, error) { return flag, nil },
	})
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "f1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_Get_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getByIDFn: func(ctx context.Context, tenantID, id string) (*models.FeatureFlag, error) { return nil, service.ErrFlagNotFound },
	})
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "nope"}, nil)
	if w.Code != http.StatusNotFound { t.Fatalf("expected 404, got %d", w.Code) }
}

// ==================== Update ====================

func TestHandler_Update_Success(t *testing.T) {
	flag := &models.FeatureFlag{ID: "f1", Name: "renamed"}
	h := newHandlerWithSvc(&mockSvc{
		updateFn: func(ctx context.Context, tenantID, id, updatedBy string, req *models.UpdateFlagRequest) (*models.FeatureFlag, error) { return flag, nil },
	})
	w := performRequest(h, h.Update, "PUT", models.UpdateFlagRequest{Name: strP("renamed")}, map[string]string{"id": "f1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== Delete ====================

func TestHandler_Delete_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteFn: func(ctx context.Context, tenantID, id string) error { return nil },
	})
	w := performRequest(h, h.Delete, "DELETE", nil, map[string]string{"id": "f1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== Count ====================

func TestHandler_Count_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		countFn: func(ctx context.Context, tenantID string) (int, error) { return 5, nil },
	})
	w := performRequest(h, h.Count, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== SetRollout ====================

func TestHandler_SetRollout_Success(t *testing.T) {
	flag := &models.FeatureFlag{ID: "f1", RolloutPct: 50}
	h := newHandlerWithSvc(&mockSvc{
		setRolloutFn: func(ctx context.Context, tenantID, id, updatedBy string, pct int) (*models.FeatureFlag, error) { return flag, nil },
	})
	w := performRequest(h, h.SetRollout, "PUT", models.SetRolloutRequest{Percentage: 50}, map[string]string{"id": "f1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== RecordToggle ====================

func TestHandler_RecordToggle_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getByIDFn:      func(ctx context.Context, tenantID, id string) (*models.FeatureFlag, error) { return &models.FeatureFlag{ID: id}, nil },
		recordToggleFn: func(ctx context.Context, flagID string, old, newVal bool, changedBy, reason string) error { return nil },
	})
	w := performRequest(h, h.RecordToggle, "POST", models.RecordToggleRequest{OldValue: false, NewValue: true}, map[string]string{"id": "f1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== Evaluate ====================

func TestHandler_Evaluate_Success(t *testing.T) {
	result := &models.FlagEvaluationResult{Key: "dark_mode", Enabled: true}
	h := newHandlerWithSvc(&mockSvc{
		evaluateFlagFn: func(ctx context.Context, tenantID string, req *models.EvaluateFlagRequest) (*models.FlagEvaluationResult, error) { return result, nil },
	})
	w := performRequest(h, h.Evaluate, "POST", models.EvaluateFlagRequest{FlagKey: "dark_mode"}, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_EvaluateBatch_Success(t *testing.T) {
	results := []models.FlagEvaluationResult{{Key: "a"}}
	h := newHandlerWithSvc(&mockSvc{
		evaluateFlagsFn: func(ctx context.Context, tenantID string, reqs []models.EvaluateFlagRequest) ([]models.FlagEvaluationResult, error) { return results, nil },
	})
	w := performRequest(h, h.EvaluateBatch, "POST", []models.EvaluateFlagRequest{{FlagKey: "a"}}, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== ToggleHistory ====================

func TestHandler_ToggleHistory_Success(t *testing.T) {
	records := []models.FlagToggleRecord{{FlagID: "f1"}}
	h := newHandlerWithSvc(&mockSvc{
		getByIDFn:       func(ctx context.Context, tenantID, id string) (*models.FeatureFlag, error) { return &models.FeatureFlag{ID: id}, nil },
		toggleHistoryFn: func(ctx context.Context, flagID string, limit int) ([]models.FlagToggleRecord, error) { return records, nil },
	})
	w := performRequest(h, h.ToggleHistory, "GET", nil, map[string]string{"id": "f1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== Create Error ====================

func TestHandler_Create_DBError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID, createdBy string, req *models.CreateFlagRequest) (*models.FeatureFlag, error) { return nil, errors.New("db error") },
	})
	w := performRequest(h, h.Create, "POST", models.CreateFlagRequest{Name: "x", Key: "x"}, nil, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

// helper

func strP(s string) *string {
	return &s
}
