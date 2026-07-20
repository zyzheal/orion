package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/problem/models"
	"orion/platform-svc-go/internal/problem/service"

	"github.com/gin-gonic/gin"
)

// --- mock Service (implements handler.Service) ---

type mockSvc struct {
	listProblemsFn      func(ctx context.Context, tenantID string, filter *models.ProblemFilter) ([]models.Problem, int, error)
	getProblemFn        func(ctx context.Context, tenantID, id string) (*models.Problem, error)
	createProblemFn     func(ctx context.Context, tenantID string, req *models.CreateProblemRequest) (*models.Problem, error)
	updateProblemFn     func(ctx context.Context, tenantID, id string, req *models.UpdateProblemRequest) (*models.Problem, error)
	deleteProblemFn     func(ctx context.Context, tenantID, id string) error
	getStatsFn          func(ctx context.Context, tenantID string) (*models.ProblemStats, error)
	linkIncidentFn      func(ctx context.Context, tenantID, problemID, incidentID string) (*models.Problem, error)
	getIncidentLinksFn  func(ctx context.Context, tenantID, problemID string) ([]string, error)
	linkChangeFn        func(ctx context.Context, tenantID, problemID, changeID string) (*models.Problem, error)
	getChangeLinksFn    func(ctx context.Context, tenantID, problemID string) ([]string, error)
	listKnownErrorsFn   func(ctx context.Context, tenantID string, filter *models.KnownErrorFilter) ([]models.KnownError, int, error)
	searchKnownErrorsFn func(ctx context.Context, tenantID, query string) ([]models.KnownError, int, error)
	getKnownErrorFn     func(ctx context.Context, tenantID, id string) (*models.KnownError, error)
	createKnownErrorFn  func(ctx context.Context, tenantID string, req *models.CreateKnownErrorRequest) (*models.KnownError, error)
	updateKnownErrorFn  func(ctx context.Context, tenantID, id string, req *models.UpdateKnownErrorRequest) (*models.KnownError, error)
	deleteKnownErrorFn  func(ctx context.Context, tenantID, id string) error
}

func (m *mockSvc) ListProblems(ctx context.Context, tenantID string, filter *models.ProblemFilter) ([]models.Problem, int, error) {
	if m.listProblemsFn != nil {
		return m.listProblemsFn(ctx, tenantID, filter)
	}
	return nil, 0, nil
}
func (m *mockSvc) GetProblem(ctx context.Context, tenantID, id string) (*models.Problem, error) {
	if m.getProblemFn != nil {
		return m.getProblemFn(ctx, tenantID, id)
	}
	return nil, nil
}
func (m *mockSvc) CreateProblem(ctx context.Context, tenantID string, req *models.CreateProblemRequest) (*models.Problem, error) {
	if m.createProblemFn != nil {
		return m.createProblemFn(ctx, tenantID, req)
	}
	return nil, nil
}
func (m *mockSvc) UpdateProblem(ctx context.Context, tenantID, id string, req *models.UpdateProblemRequest) (*models.Problem, error) {
	if m.updateProblemFn != nil {
		return m.updateProblemFn(ctx, tenantID, id, req)
	}
	return nil, nil
}
func (m *mockSvc) DeleteProblem(ctx context.Context, tenantID, id string) error {
	if m.deleteProblemFn != nil {
		return m.deleteProblemFn(ctx, tenantID, id)
	}
	return nil
}
func (m *mockSvc) GetStats(ctx context.Context, tenantID string) (*models.ProblemStats, error) {
	if m.getStatsFn != nil {
		return m.getStatsFn(ctx, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) LinkIncident(ctx context.Context, tenantID, problemID, incidentID string) (*models.Problem, error) {
	if m.linkIncidentFn != nil {
		return m.linkIncidentFn(ctx, tenantID, problemID, incidentID)
	}
	return nil, nil
}
func (m *mockSvc) GetIncidentLinks(ctx context.Context, tenantID, problemID string) ([]string, error) {
	if m.getIncidentLinksFn != nil {
		return m.getIncidentLinksFn(ctx, tenantID, problemID)
	}
	return nil, nil
}
func (m *mockSvc) LinkChange(ctx context.Context, tenantID, problemID, changeID string) (*models.Problem, error) {
	if m.linkChangeFn != nil {
		return m.linkChangeFn(ctx, tenantID, problemID, changeID)
	}
	return nil, nil
}
func (m *mockSvc) GetChangeLinks(ctx context.Context, tenantID, problemID string) ([]string, error) {
	if m.getChangeLinksFn != nil {
		return m.getChangeLinksFn(ctx, tenantID, problemID)
	}
	return nil, nil
}
func (m *mockSvc) ListKnownErrors(ctx context.Context, tenantID string, filter *models.KnownErrorFilter) ([]models.KnownError, int, error) {
	if m.listKnownErrorsFn != nil {
		return m.listKnownErrorsFn(ctx, tenantID, filter)
	}
	return nil, 0, nil
}
func (m *mockSvc) SearchKnownErrors(ctx context.Context, tenantID, query string) ([]models.KnownError, int, error) {
	if m.searchKnownErrorsFn != nil {
		return m.searchKnownErrorsFn(ctx, tenantID, query)
	}
	return nil, 0, nil
}
func (m *mockSvc) GetKnownError(ctx context.Context, tenantID, id string) (*models.KnownError, error) {
	if m.getKnownErrorFn != nil {
		return m.getKnownErrorFn(ctx, tenantID, id)
	}
	return nil, nil
}
func (m *mockSvc) CreateKnownError(ctx context.Context, tenantID string, req *models.CreateKnownErrorRequest) (*models.KnownError, error) {
	if m.createKnownErrorFn != nil {
		return m.createKnownErrorFn(ctx, tenantID, req)
	}
	return nil, nil
}
func (m *mockSvc) UpdateKnownError(ctx context.Context, tenantID, id string, req *models.UpdateKnownErrorRequest) (*models.KnownError, error) {
	if m.updateKnownErrorFn != nil {
		return m.updateKnownErrorFn(ctx, tenantID, id, req)
	}
	return nil, nil
}
func (m *mockSvc) DeleteKnownError(ctx context.Context, tenantID, id string) error {
	if m.deleteKnownErrorFn != nil {
		return m.deleteKnownErrorFn(ctx, tenantID, id)
	}
	return nil
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

// ==================== Problem CRUD ====================

func TestHandler_ListProblems_Success(t *testing.T) {
	ps := []models.Problem{{ID: "p1"}}
	h := newHandlerWithSvc(&mockSvc{
		listProblemsFn: func(ctx context.Context, tenantID string, filter *models.ProblemFilter) ([]models.Problem, int, error) {
			return ps, 1, nil
		},
	})
	w := performRequest(h, h.ListProblems, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetProblem_Success(t *testing.T) {
	p := &models.Problem{ID: "p1", Title: "slow db"}
	h := newHandlerWithSvc(&mockSvc{
		getProblemFn: func(ctx context.Context, tenantID, id string) (*models.Problem, error) { return p, nil },
	})
	w := performRequest(h, h.GetProblem, "GET", nil, map[string]string{"id": "p1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetProblem_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getProblemFn: func(ctx context.Context, tenantID, id string) (*models.Problem, error) {
			return nil, service.ErrNotFound
		},
	})
	w := performRequest(h, h.GetProblem, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_CreateProblem_Success(t *testing.T) {
	p := &models.Problem{ID: "p1", Title: "new problem"}
	h := newHandlerWithSvc(&mockSvc{
		createProblemFn: func(ctx context.Context, tenantID string, req *models.CreateProblemRequest) (*models.Problem, error) {
			return p, nil
		},
	})
	w := performRequest(h, h.CreateProblem, "POST", models.CreateProblemRequest{Title: "new problem"}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_CreateProblem_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.CreateProblem, "POST", models.CreateProblemRequest{}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_UpdateProblem_Success(t *testing.T) {
	p := &models.Problem{ID: "p1", Title: "updated"}
	h := newHandlerWithSvc(&mockSvc{
		updateProblemFn: func(ctx context.Context, tenantID, id string, req *models.UpdateProblemRequest) (*models.Problem, error) {
			return p, nil
		},
	})
	w := performRequest(h, h.UpdateProblem, "PUT", models.UpdateProblemRequest{}, map[string]string{"id": "p1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_DeleteProblem_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteProblemFn: func(ctx context.Context, tenantID, id string) error { return nil },
	})
	w := performRequest(h, h.DeleteProblem, "DELETE", nil, map[string]string{"id": "p1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_DeleteProblem_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteProblemFn: func(ctx context.Context, tenantID, id string) error { return service.ErrNotFound },
	})
	w := performRequest(h, h.DeleteProblem, "DELETE", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ==================== Stats ====================

func TestHandler_GetStats_Success(t *testing.T) {
	st := &models.ProblemStats{Total: 10}
	h := newHandlerWithSvc(&mockSvc{
		getStatsFn: func(ctx context.Context, tenantID string) (*models.ProblemStats, error) { return st, nil },
	})
	w := performRequest(h, h.GetStats, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== Status Transition ====================

func TestHandler_UpdateStatus_Success(t *testing.T) {
	p := &models.Problem{ID: "p1", Status: "triaged"}
	h := newHandlerWithSvc(&mockSvc{
		updateProblemFn: func(ctx context.Context, tenantID, id string, req *models.UpdateProblemRequest) (*models.Problem, error) {
			return p, nil
		},
	})
	w := performRequest(h, h.UpdateStatus, "PATCH", gin.H{"status": "triaged"}, map[string]string{"id": "p1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_UpdateStatus_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.UpdateStatus, "PATCH", gin.H{}, map[string]string{"id": "p1"}, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// ==================== Linking ====================

func TestHandler_LinkIncident_Success(t *testing.T) {
	p := &models.Problem{ID: "p1"}
	h := newHandlerWithSvc(&mockSvc{
		linkIncidentFn: func(ctx context.Context, tenantID, problemID, incidentID string) (*models.Problem, error) {
			return p, nil
		},
	})
	w := performRequest(h, h.LinkIncident, "POST", gin.H{"incidentId": "i1"}, map[string]string{"id": "p1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetIncidentLinks_Success(t *testing.T) {
	ids := []string{"i1", "i2"}
	h := newHandlerWithSvc(&mockSvc{
		getIncidentLinksFn: func(ctx context.Context, tenantID, problemID string) ([]string, error) { return ids, nil },
	})
	w := performRequest(h, h.GetIncidentLinks, "GET", nil, map[string]string{"id": "p1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== Known Errors ====================

func TestHandler_ListKnownErrors_Success(t *testing.T) {
	kes := []models.KnownError{{ID: "ke1"}}
	h := newHandlerWithSvc(&mockSvc{
		listKnownErrorsFn: func(ctx context.Context, tenantID string, filter *models.KnownErrorFilter) ([]models.KnownError, int, error) {
			return kes, 1, nil
		},
	})
	w := performRequest(h, h.ListKnownErrors, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_SearchKnownErrors_Success(t *testing.T) {
	kes := []models.KnownError{{ID: "ke1"}}
	h := newHandlerWithSvc(&mockSvc{
		searchKnownErrorsFn: func(ctx context.Context, tenantID, query string) ([]models.KnownError, int, error) {
			return kes, 1, nil
		},
	})
	w := performRequest(h, h.SearchKnownErrors, "GET", nil, nil, map[string]string{"q": "db"})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_CreateKnownError_Success(t *testing.T) {
	ke := &models.KnownError{ID: "ke1", ProblemID: "p1", Name: "err1"}
	h := newHandlerWithSvc(&mockSvc{
		createKnownErrorFn: func(ctx context.Context, tenantID string, req *models.CreateKnownErrorRequest) (*models.KnownError, error) {
			return ke, nil
		},
	})
	w := performRequest(h, h.CreateKnownError, "POST", models.CreateKnownErrorRequest{ProblemID: "p1", Title: "err1"}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_DeleteKnownError_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteKnownErrorFn: func(ctx context.Context, tenantID, id string) error { return nil },
	})
	w := performRequest(h, h.DeleteKnownError, "DELETE", nil, map[string]string{"id": "ke1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
