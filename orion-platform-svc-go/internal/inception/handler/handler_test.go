package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/inception/models"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// mockSvc implements Service using function fields
// ---------------------------------------------------------------------------

type mockSvc struct {
	healthFn       func(ctx context.Context) (string, error)
	statusFn       func(ctx context.Context, tenantID string) (bool, string, error)
	createAuditFn  func(ctx context.Context, tenantID string, req *models.CreateAuditRequest) (*models.SQLAuditHistory, error)
	listDBsFn      func(ctx context.Context, tenantID string) ([]string, error)
	listAuditsFn   func(ctx context.Context, tenantID string, offset, limit int) ([]models.SQLAuditHistory, error)
	countAuditsFn  func(ctx context.Context, tenantID string) (int, error)
}

func (m *mockSvc) Health(ctx context.Context) (string, error) {
	if m.healthFn != nil {
		return m.healthFn(ctx)
	}
	return "ok", nil
}
func (m *mockSvc) Status(ctx context.Context, tenantID string) (bool, string, error) {
	if m.statusFn != nil {
		return m.statusFn(ctx, tenantID)
	}
	return true, "configured", nil
}
func (m *mockSvc) CreateAudit(ctx context.Context, tenantID string, req *models.CreateAuditRequest) (*models.SQLAuditHistory, error) {
	if m.createAuditFn != nil {
		return m.createAuditFn(ctx, tenantID, req)
	}
	return &models.SQLAuditHistory{ID: "audit-1"}, nil
}
func (m *mockSvc) ListDatabases(ctx context.Context, tenantID string) ([]string, error) {
	if m.listDBsFn != nil {
		return m.listDBsFn(ctx, tenantID)
	}
	return []string{"db1"}, nil
}
func (m *mockSvc) ListAudits(ctx context.Context, tenantID string, offset, limit int) ([]models.SQLAuditHistory, error) {
	if m.listAuditsFn != nil {
		return m.listAuditsFn(ctx, tenantID, offset, limit)
	}
	return nil, nil
}
func (m *mockSvc) CountAudits(ctx context.Context, tenantID string) (int, error) {
	if m.countAuditsFn != nil {
		return m.countAuditsFn(ctx, tenantID)
	}
	return 0, nil
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func newHandlerWithSvc(svc Service) *Handler {
	return &Handler{svc: svc}
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

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

func TestHandler_Health_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		healthFn: func(ctx context.Context) (string, error) { return "ok", nil },
	})
	w := performRequest(h, h.Health, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Health_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		healthFn: func(ctx context.Context) (string, error) { return "", errors.New("health check failed") },
	})
	w := performRequest(h, h.Health, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

func TestHandler_Status_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		statusFn: func(ctx context.Context, tenantID string) (bool, string, error) {
			return true, "configured", nil
		},
	})
	w := performRequest(h, h.Status, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Status_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		statusFn: func(ctx context.Context, tenantID string) (bool, string, error) {
			return false, "", errors.New("db error")
		},
	})
	w := performRequest(h, h.Status, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

func TestHandler_Audit_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createAuditFn: func(ctx context.Context, tenantID string, req *models.CreateAuditRequest) (*models.SQLAuditHistory, error) {
			return &models.SQLAuditHistory{ID: "audit-1"}, nil
		},
	})
	w := performRequest(h, h.Audit, "POST", models.AuditRequest{
		SQL: "SELECT 1",
	}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
}

func TestHandler_Audit_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.Audit, "POST", gin.H{"database": "test"}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandler_Audit_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createAuditFn: func(ctx context.Context, tenantID string, req *models.CreateAuditRequest) (*models.SQLAuditHistory, error) {
			return nil, errors.New("blacklist error")
		},
	})
	w := performRequest(h, h.Audit, "POST", models.AuditRequest{
		SQL: "DROP TABLE users",
	}, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

func TestHandler_Parse_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createAuditFn: func(ctx context.Context, tenantID string, req *models.CreateAuditRequest) (*models.SQLAuditHistory, error) {
			return &models.SQLAuditHistory{ID: "audit-2"}, nil
		},
	})
	w := performRequest(h, h.Parse, "POST", models.ParseRequest{
		SQL: "SELECT 1",
	}, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Parse_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.Parse, "POST", gin.H{}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

func TestHandler_Execute_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createAuditFn: func(ctx context.Context, tenantID string, req *models.CreateAuditRequest) (*models.SQLAuditHistory, error) {
			return &models.SQLAuditHistory{ID: "audit-3"}, nil
		},
	})
	w := performRequest(h, h.Execute, "POST", models.ExecuteRequest{
		SQL: "SELECT 1",
	}, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// ListDatabases
// ---------------------------------------------------------------------------

func TestHandler_ListDatabases_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listDBsFn: func(ctx context.Context, tenantID string) ([]string, error) {
			return []string{"prod", "staging"}, nil
		},
	})
	w := performRequest(h, h.ListDatabases, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ListDatabases_Error(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listDBsFn: func(ctx context.Context, tenantID string) ([]string, error) {
			return nil, errors.New("db error")
		},
	})
	w := performRequest(h, h.ListDatabases, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

func TestHandler_History_Success(t *testing.T) {
	audits := []models.SQLAuditHistory{{ID: "a1"}, {ID: "a2"}}
	h := newHandlerWithSvc(&mockSvc{
		listAuditsFn: func(ctx context.Context, tenantID string, offset, limit int) ([]models.SQLAuditHistory, error) {
			return audits, nil
		},
		countAuditsFn: func(ctx context.Context, tenantID string) (int, error) {
			return 2, nil
		},
	})
	w := performRequest(h, h.History, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_History_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listAuditsFn: func(ctx context.Context, tenantID string, offset, limit int) ([]models.SQLAuditHistory, error) {
			return nil, errors.New("db error")
		},
	})
	w := performRequest(h, h.History, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}
