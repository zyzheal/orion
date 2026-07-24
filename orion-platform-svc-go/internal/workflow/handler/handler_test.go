package handler

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"orion/platform-svc-go/internal/workflow/models"
	"orion/platform-svc-go/internal/workflow/repository"
	"orion/platform-svc-go/internal/workflow/service"

	"github.com/gin-gonic/gin"
)

// --- mockWorkflowRepo implements service.WorkflowRepo ---

type mockWorkflowRepo struct {
	dbErr       error
	wfs         map[string]*models.Workflow
	execs       map[string]*models.WorkflowExecution
	getByFn     func(ctx context.Context, id, tenantID string) (*models.Workflow, error)
	createErr   error
	getExecFn   func(ctx context.Context, id, tenantID string) (*models.WorkflowExecution, error)
}

func newMockWorkflowRepo() *mockWorkflowRepo {
	return &mockWorkflowRepo{
		wfs:   make(map[string]*models.Workflow),
		execs: make(map[string]*models.WorkflowExecution),
	}
}

func (m *mockWorkflowRepo) Create(ctx context.Context, wf *models.Workflow) error {
	if m.createErr != nil { return m.createErr }
	if m.dbErr != nil { return m.dbErr }
	wf.ID = "wf-" + wf.Name
	wf.CreatedAt = time.Now().UTC()
	wf.UpdatedAt = time.Now().UTC()
	m.wfs[wf.ID] = wf
	return nil
}
func (m *mockWorkflowRepo) GetByID(ctx context.Context, id, tenantID string) (*models.Workflow, error) {
	if m.getByFn != nil { return m.getByFn(ctx, id, tenantID) }
	if m.dbErr != nil { return nil, m.dbErr }
	wf, ok := m.wfs[id]
	if !ok { return nil, sql.ErrNoRows }
	return wf, nil
}
func (m *mockWorkflowRepo) List(ctx context.Context, tenantID string, status *string, limit, offset int) ([]models.Workflow, error) {
	if m.dbErr != nil { return nil, m.dbErr }
	var result []models.Workflow
	for _, wf := range m.wfs {
		if status != nil && *status != "" {
			if *status == "enabled" && !wf.Enabled { continue }
			if *status == "disabled" && wf.Enabled { continue }
		}
		result = append(result, *wf)
	}
	return result, nil
}
func (m *mockWorkflowRepo) Count(ctx context.Context, tenantID string, status *string) (int, error) {
	if m.dbErr != nil { return 0, m.dbErr }
	return len(m.wfs), nil
}
func (m *mockWorkflowRepo) Update(ctx context.Context, id, tenantID string, updates map[string]interface{}) (*models.Workflow, error) {
	if m.dbErr != nil { return nil, m.dbErr }
	wf, ok := m.wfs[id]
	if !ok { return nil, repository.ErrNotFound }
	for k, v := range updates {
		switch k {
		case "name": wf.Name = v.(string)
		case "enabled": wf.Enabled = v.(bool)
		}
	}
	wf.UpdatedAt = time.Now().UTC()
	return wf, nil
}
func (m *mockWorkflowRepo) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	if m.dbErr != nil { return false, m.dbErr }
	_, ok := m.wfs[id]
	delete(m.wfs, id)
	return ok, nil
}
func (m *mockWorkflowRepo) SetEnabled(ctx context.Context, id, tenantID string, enabled bool) (*models.Workflow, error) {
	if m.dbErr != nil { return nil, m.dbErr }
	wf, ok := m.wfs[id]
	if !ok { return nil, repository.ErrNotFound }
	wf.Enabled = enabled
	return wf, nil
}
func (m *mockWorkflowRepo) CreateExecution(ctx context.Context, exec *models.WorkflowExecution) error {
	if m.dbErr != nil { return m.dbErr }
	exec.ID = "exec-" + exec.WorkflowID
	exec.CreatedAt = time.Now().UTC()
	m.execs[exec.ID] = exec
	return nil
}
func (m *mockWorkflowRepo) GetExecutionByID(ctx context.Context, id, tenantID string) (*models.WorkflowExecution, error) {
	if m.getExecFn != nil { return m.getExecFn(ctx, id, tenantID) }
	if m.dbErr != nil { return nil, m.dbErr }
	e, ok := m.execs[id]
	if !ok { return nil, sql.ErrNoRows }
	return e, nil
}
func (m *mockWorkflowRepo) ListExecutionsByWorkflowID(ctx context.Context, workflowID, tenantID string, limit, offset int) ([]models.WorkflowExecution, error) {
	if m.dbErr != nil { return nil, m.dbErr }
	var result []models.WorkflowExecution
	for _, e := range m.execs {
		if e.WorkflowID == workflowID {
			result = append(result, *e)
		}
	}
	return result, nil
}
func (m *mockWorkflowRepo) CountExecutionsByWorkflowID(ctx context.Context, workflowID, tenantID string) (int, error) {
	if m.dbErr != nil { return 0, m.dbErr }
	var n int
	for _, e := range m.execs {
		if e.WorkflowID == workflowID { n++ }
	}
	return n, nil
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

	buf := new(bytes.Buffer)
	if body != nil {
		b, _ := json.Marshal(body)
		buf = bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, "/", buf)
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

// ==================== Workflow CRUD ====================

func TestHandler_List_Success(t *testing.T) {
	repo := newMockWorkflowRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.List, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Get_Success(t *testing.T) {
	repo := newMockWorkflowRepo()
	repo.wfs["wf-1"] = &models.Workflow{ID: "wf-1", Name: "deploy", Enabled: true}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "wf-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Get_NotFound(t *testing.T) {
	repo := newMockWorkflowRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_Create_Success(t *testing.T) {
	repo := newMockWorkflowRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Create, "POST", models.CreateWorkflowRequest{Name: "deploy-pipeline"}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_Create_BadRequest(t *testing.T) {
	repo := newMockWorkflowRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	// missing required Name
	w := performRequest(h, h.Create, "POST", models.CreateWorkflowRequest{}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_Update_Success(t *testing.T) {
	repo := newMockWorkflowRepo()
	repo.wfs["wf-1"] = &models.Workflow{ID: "wf-1", Name: "deploy", Enabled: true}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Update, "PUT", gin.H{"name": "deploy-v2"}, map[string]string{"id": "wf-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Update_NotFound(t *testing.T) {
	repo := newMockWorkflowRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Update, "PUT", gin.H{"name": "x"}, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_Delete_Success(t *testing.T) {
	repo := newMockWorkflowRepo()
	repo.wfs["wf-1"] = &models.Workflow{ID: "wf-1", Name: "deploy"}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Delete, "DELETE", nil, map[string]string{"id": "wf-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Delete_NotFound(t *testing.T) {
	repo := newMockWorkflowRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Delete, "DELETE", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ==================== Pause / Resume ====================

func TestHandler_Pause_Success(t *testing.T) {
	repo := newMockWorkflowRepo()
	repo.wfs["wf-1"] = &models.Workflow{ID: "wf-1", Name: "deploy", Enabled: true}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Pause, "POST", nil, map[string]string{"id": "wf-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if w.Code != http.StatusOK {
		// no-op
	}
}

func TestHandler_Pause_NotFound(t *testing.T) {
	repo := newMockWorkflowRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Pause, "POST", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_Resume_Success(t *testing.T) {
	repo := newMockWorkflowRepo()
	repo.wfs["wf-1"] = &models.Workflow{ID: "wf-1", Name: "deploy", Enabled: false}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Resume, "POST", nil, map[string]string{"id": "wf-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== Execute ====================

func TestHandler_Execute_Success(t *testing.T) {
	repo := newMockWorkflowRepo()
	repo.wfs["wf-1"] = &models.Workflow{ID: "wf-1", Name: "deploy", Enabled: true}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Execute, "POST", gin.H{"initialInput": "{}"}, map[string]string{"id": "wf-1"}, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_Execute_Disabled(t *testing.T) {
	repo := newMockWorkflowRepo()
	repo.wfs["wf-1"] = &models.Workflow{ID: "wf-1", Name: "deploy", Enabled: false}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Execute, "POST", nil, map[string]string{"id": "wf-1"}, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_Execute_NotFound(t *testing.T) {
	repo := newMockWorkflowRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Execute, "POST", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ==================== Executions ====================

func TestHandler_ListExecutions_Success(t *testing.T) {
	repo := newMockWorkflowRepo()
	repo.wfs["wf-1"] = &models.Workflow{ID: "wf-1", Name: "deploy"}
	repo.execs["exec-1"] = &models.WorkflowExecution{ID: "exec-1", WorkflowID: "wf-1", Status: "running"}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.ListExecutions, "GET", nil, map[string]string{"id": "wf-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetExecution_Success(t *testing.T) {
	repo := newMockWorkflowRepo()
	repo.execs["exec-1"] = &models.WorkflowExecution{ID: "exec-1", Status: "running"}
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetExecution, "GET", nil, map[string]string{"executionId": "exec-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetExecution_NotFound(t *testing.T) {
	repo := newMockWorkflowRepo()
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetExecution, "GET", nil, map[string]string{"executionId": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ==================== Error injection ====================

func TestHandler_Create_ServiceError(t *testing.T) {
	repo := newMockWorkflowRepo()
	repo.createErr = errors.New("constraint violation")
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.Create, "POST", models.CreateWorkflowRequest{Name: "x"}, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestHandler_List_ErrorInjection(t *testing.T) {
	repo := newMockWorkflowRepo()
	repo.dbErr = errors.New("db failure")
	svc := service.NewService(repo)
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.List, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}
