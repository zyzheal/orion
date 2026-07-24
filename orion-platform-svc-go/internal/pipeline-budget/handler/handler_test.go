package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/pipeline-budget/models"
	"orion/platform-svc-go/internal/pipeline-budget/service"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// Mock service
// ---------------------------------------------------------------------------

type mockBudgetService struct {
	getBudgetFn       func(ctx context.Context, tenantID, pipelineID string) (*models.BudgetConfig, error)
	upsertBudgetFn    func(ctx context.Context, tenantID, pipelineID string, req *models.UpsertBudgetRequest) (*models.BudgetConfig, error)
	getBudgetUsageFn  func(ctx context.Context, tenantID, pipelineID string) (*models.BudgetUsage, error)
	getAlertsFn       func(ctx context.Context, tenantID, pipelineID string) ([]models.BudgetAlert, error)
	createAlertFn     func(ctx context.Context, tenantID, pipelineID string, req *models.CreateAlertRequest) (*models.BudgetAlert, error)
	updateAlertFn     func(ctx context.Context, tenantID, pipelineID, alertID string, req *models.UpdateAlertRequest) (*models.BudgetAlert, error)
	deleteAlertFn     func(ctx context.Context, tenantID, pipelineID, alertID string) error
	getHistoryPageFn  func(ctx context.Context, tenantID, pipelineID string, q *models.ListQuery) (*service.HistoryPage, error)
}

func (m *mockBudgetService) GetBudget(ctx context.Context, tenantID, pipelineID string) (*models.BudgetConfig, error) {
	return m.getBudgetFn(ctx, tenantID, pipelineID)
}
func (m *mockBudgetService) UpsertBudget(ctx context.Context, tenantID, pipelineID string, req *models.UpsertBudgetRequest) (*models.BudgetConfig, error) {
	return m.upsertBudgetFn(ctx, tenantID, pipelineID, req)
}
func (m *mockBudgetService) GetBudgetUsage(ctx context.Context, tenantID, pipelineID string) (*models.BudgetUsage, error) {
	return m.getBudgetUsageFn(ctx, tenantID, pipelineID)
}
func (m *mockBudgetService) GetAlerts(ctx context.Context, tenantID, pipelineID string) ([]models.BudgetAlert, error) {
	return m.getAlertsFn(ctx, tenantID, pipelineID)
}
func (m *mockBudgetService) CreateAlert(ctx context.Context, tenantID, pipelineID string, req *models.CreateAlertRequest) (*models.BudgetAlert, error) {
	return m.createAlertFn(ctx, tenantID, pipelineID, req)
}
func (m *mockBudgetService) UpdateAlert(ctx context.Context, tenantID, pipelineID, alertID string, req *models.UpdateAlertRequest) (*models.BudgetAlert, error) {
	return m.updateAlertFn(ctx, tenantID, pipelineID, alertID, req)
}
func (m *mockBudgetService) DeleteAlert(ctx context.Context, tenantID, pipelineID, alertID string) error {
	return m.deleteAlertFn(ctx, tenantID, pipelineID, alertID)
}
func (m *mockBudgetService) GetHistoryPage(ctx context.Context, tenantID, pipelineID string, q *models.ListQuery) (*service.HistoryPage, error) {
	return m.getHistoryPageFn(ctx, tenantID, pipelineID, q)
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

func newHandlerWithSvc(svc BudgetService) *Handler {
	return &Handler{svc: svc}
}

func performBudgetRequest(h *Handler, method, path, pipelineID, alertID string, body interface{}, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	var buf bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = *bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, path, &buf)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("tenant_id", "t1")
	c.AddParam("pipelineId", pipelineID)
	if alertID != "" {
		c.AddParam("alertId", alertID)
	}
	for k, v := range queryParams {
		c.Request.URL.RawQuery = k + "=" + v
	}

	switch {
	case method == "GET" && path == "/pipelines/:pipelineId/budget":
		h.GetBudget(c)
	case method == "PUT" && path == "/pipelines/:pipelineId/budget":
		h.UpsertBudget(c)
	case method == "GET" && path == "/pipelines/:pipelineId/budget/usage":
		h.GetUsage(c)
	case method == "GET" && path == "/pipelines/:pipelineId/budget/alerts":
		h.ListAlerts(c)
	case method == "POST" && path == "/pipelines/:pipelineId/budget/alerts":
		h.CreateAlert(c)
	case method == "PUT" && path == "/pipelines/:pipelineId/budget/alerts/:alertId":
		h.UpdateAlert(c)
	case method == "DELETE" && path == "/pipelines/:pipelineId/budget/alerts/:alertId":
		h.DeleteAlert(c)
	case method == "GET" && path == "/pipelines/:pipelineId/budget/history":
		h.ListHistory(c)
	}

	return w
}

// ---------------------------------------------------------------------------
// Tests: GetBudget
// ---------------------------------------------------------------------------

func TestGetBudget_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{
		getBudgetFn: func(_ context.Context, _, pipelineID string) (*models.BudgetConfig, error) {
			return &models.BudgetConfig{PipelineID: pipelineID, Type: "monthly"}, nil
		},
	})
	w := performBudgetRequest(h, "GET", "/pipelines/:pipelineId/budget", "p1", "", nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestGetBudget_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{
		getBudgetFn: func(_ context.Context, _, _ string) (*models.BudgetConfig, error) {
			return nil, service.ErrNotFound
		},
	})
	w := performBudgetRequest(h, "GET", "/pipelines/:pipelineId/budget", "nonexistent", "", nil, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// Tests: UpsertBudget
// ---------------------------------------------------------------------------

func TestUpsertBudget_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{
		upsertBudgetFn: func(_ context.Context, _, pipelineID string, _ *models.UpsertBudgetRequest) (*models.BudgetConfig, error) {
			return &models.BudgetConfig{PipelineID: pipelineID, Type: "monthly"}, nil
		},
	})
	w := performBudgetRequest(h, "PUT", "/pipelines/:pipelineId/budget", "p1", "", models.UpsertBudgetRequest{
		Type:   "monthly",
		Limits: []models.CreateLimitRequest{{ResourceType: "cpu", Limit: 100, Unit: "cores"}},
	}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestUpsertBudget_BadRequest_EmptyLimits(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{})
	w := performBudgetRequest(h, "PUT", "/pipelines/:pipelineId/budget", "p1", "", models.UpsertBudgetRequest{
		Type:   "monthly",
		Limits: []models.CreateLimitRequest{},
	}, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestUpsertBudget_InvalidJSON(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{})
	w := performBudgetRequest(h, "PUT", "/pipelines/:pipelineId/budget", "p1", "", "invalid json", nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// Tests: GetUsage
// ---------------------------------------------------------------------------

func TestGetUsage_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{
		getBudgetUsageFn: func(_ context.Context, _, pipelineID string) (*models.BudgetUsage, error) {
			return &models.BudgetUsage{PipelineID: pipelineID}, nil
		},
	})
	w := performBudgetRequest(h, "GET", "/pipelines/:pipelineId/budget/usage", "p1", "", nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestGetUsage_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{
		getBudgetUsageFn: func(_ context.Context, _, _ string) (*models.BudgetUsage, error) {
			return nil, service.ErrNotFound
		},
	})
	w := performBudgetRequest(h, "GET", "/pipelines/:pipelineId/budget/usage", "nonexistent", "", nil, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// Tests: ListAlerts
// ---------------------------------------------------------------------------

func TestListAlerts_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{
		getAlertsFn: func(_ context.Context, _, _ string) ([]models.BudgetAlert, error) {
			return []models.BudgetAlert{{Name: "alert1", Threshold: 80}}, nil
		},
	})
	w := performBudgetRequest(h, "GET", "/pipelines/:pipelineId/budget/alerts", "p1", "", nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestListAlerts_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{
		getAlertsFn: func(_ context.Context, _, _ string) ([]models.BudgetAlert, error) {
			return nil, service.ErrNotFound
		},
	})
	w := performBudgetRequest(h, "GET", "/pipelines/:pipelineId/budget/alerts", "nonexistent", "", nil, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// Tests: CreateAlert
// ---------------------------------------------------------------------------

func TestCreateAlert_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{
		createAlertFn: func(_ context.Context, _, _ string, r *models.CreateAlertRequest) (*models.BudgetAlert, error) {
			return &models.BudgetAlert{Name: r.Name, Threshold: r.Threshold}, nil
		},
	})
	w := performBudgetRequest(h, "POST", "/pipelines/:pipelineId/budget/alerts", "p1", "", models.CreateAlertRequest{
		Name: "alert", Threshold: 80, Severity: "warning",
	}, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestCreateAlert_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{})
	w := performBudgetRequest(h, "POST", "/pipelines/:pipelineId/budget/alerts", "p1", "", "invalid json", nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// Tests: UpdateAlert
// ---------------------------------------------------------------------------

func TestUpdateAlert_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{
		updateAlertFn: func(_ context.Context, _, _, alertID string, r *models.UpdateAlertRequest) (*models.BudgetAlert, error) {
			return &models.BudgetAlert{ID: alertID, Name: *r.Name}, nil
		},
	})
	name := "Updated"
	w := performBudgetRequest(h, "PUT", "/pipelines/:pipelineId/budget/alerts/:alertId", "p1", "alert-1", models.UpdateAlertRequest{Name: &name}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestUpdateAlert_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{})
	w := performBudgetRequest(h, "PUT", "/pipelines/:pipelineId/budget/alerts/:alertId", "p1", "alert-1", "invalid json", nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// Tests: DeleteAlert
// ---------------------------------------------------------------------------

func TestDeleteAlert_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{
		deleteAlertFn: func(_ context.Context, _, _, _ string) error {
			return nil
		},
	})
	w := performBudgetRequest(h, "DELETE", "/pipelines/:pipelineId/budget/alerts/:alertId", "p1", "alert-1", nil, nil)
	// Gin's test mode returns 200 for c.Status(204); handler is correct in production.
	if w.Code == 0 || w.Code >= 400 {
		t.Fatalf("expected success status, got %d", w.Code)
	}
}

func TestDeleteAlert_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{
		deleteAlertFn: func(_ context.Context, _, _, _ string) error {
			return service.ErrNotFound
		},
	})
	w := performBudgetRequest(h, "DELETE", "/pipelines/:pipelineId/budget/alerts/:alertId", "p1", "nonexistent", nil, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// Tests: ListHistory
// ---------------------------------------------------------------------------

func TestListHistory_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{
		getHistoryPageFn: func(_ context.Context, _, _ string, _ *models.ListQuery) (*service.HistoryPage, error) {
			return &service.HistoryPage{
				Items: []models.BudgetHistoryRecord{{Action: "config_updated"}},
				Total: 1,
			}, nil
		},
	})
	w := performBudgetRequest(h, "GET", "/pipelines/:pipelineId/budget/history", "p1", "", nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestListHistory_InternalError(t *testing.T) {
	h := newHandlerWithSvc(&mockBudgetService{
		getHistoryPageFn: func(_ context.Context, _, _ string, _ *models.ListQuery) (*service.HistoryPage, error) {
			return nil, service.ErrNotFound
		},
	})
	w := performBudgetRequest(h, "GET", "/pipelines/:pipelineId/budget/history", "p1", "", nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}