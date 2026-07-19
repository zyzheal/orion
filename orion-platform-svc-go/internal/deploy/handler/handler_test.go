package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/deploy/models"

	"github.com/gin-gonic/gin"
)

// --- mock service (implements Service interface) ---

type mockSvc struct {
	createFn                  func(ctx context.Context, tenantID string, req models.CreateDeploymentRequest) (*models.Deployment, error)
	getFn                     func(ctx context.Context, tenantID, id string) (*models.Deployment, error)
	listFn                    func(ctx context.Context, tenantID string, limit, offset int) ([]models.Deployment, error)
	getLatestFn               func(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error)
	metricsFn                 func(ctx context.Context, tenantID string) (*models.DeploymentMetrics, error)
	rollbackFn                func(ctx context.Context, tenantID, id string, targetVersion, reason string) (*models.Rollback, error)
	getRollbackHistoryFn      func(ctx context.Context, tenantID, id string) ([]models.Rollback, error)
	cancelFn                  func(ctx context.Context, tenantID, id string) error
	getAuditTrailFn           func(ctx context.Context, deploymentID string) ([]models.AuditEntry, error)
	getReleaseNotesFn         func(ctx context.Context, deploymentID string) (*models.ReleaseNote, error)
	generateReleaseNotesFn    func(ctx context.Context, tenantID, deploymentID, content string) (*models.ReleaseNote, error)
	getReleaseNotesByTenantFn func(ctx context.Context, tenantID string) ([]models.ReleaseNote, error)
	linkGitCommitFn           func(ctx context.Context, deploymentID, commitSHA, branch string) error
	getDeploymentChangelogFn  func(ctx context.Context, deploymentID string) ([]models.GitChangelogEntry, error)
}

func (m *mockSvc) Create(ctx context.Context, tenantID string, req models.CreateDeploymentRequest) (*models.Deployment, error) {
	if m.createFn != nil { return m.createFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) Get(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	if m.getFn != nil { return m.getFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) List(ctx context.Context, tenantID string, limit, offset int) ([]models.Deployment, error) {
	if m.listFn != nil { return m.listFn(ctx, tenantID, limit, offset) }
	return nil, nil
}
func (m *mockSvc) GetLatest(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error) {
	if m.getLatestFn != nil { return m.getLatestFn(ctx, tenantID, appName, environment) }
	return nil, nil
}
func (m *mockSvc) Metrics(ctx context.Context, tenantID string) (*models.DeploymentMetrics, error) {
	if m.metricsFn != nil { return m.metricsFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) Rollback(ctx context.Context, tenantID, id string, targetVersion, reason string) (*models.Rollback, error) {
	if m.rollbackFn != nil { return m.rollbackFn(ctx, tenantID, id, targetVersion, reason) }
	return nil, nil
}
func (m *mockSvc) GetRollbackHistory(ctx context.Context, tenantID, id string) ([]models.Rollback, error) {
	if m.getRollbackHistoryFn != nil { return m.getRollbackHistoryFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) Cancel(ctx context.Context, tenantID, id string) error {
	if m.cancelFn != nil { return m.cancelFn(ctx, tenantID, id) }
	return nil
}
func (m *mockSvc) GetAuditTrail(ctx context.Context, deploymentID string) ([]models.AuditEntry, error) {
	if m.getAuditTrailFn != nil { return m.getAuditTrailFn(ctx, deploymentID) }
	return nil, nil
}
func (m *mockSvc) GetReleaseNotes(ctx context.Context, deploymentID string) (*models.ReleaseNote, error) {
	if m.getReleaseNotesFn != nil { return m.getReleaseNotesFn(ctx, deploymentID) }
	return nil, nil
}
func (m *mockSvc) GenerateReleaseNotes(ctx context.Context, tenantID, deploymentID, content string) (*models.ReleaseNote, error) {
	if m.generateReleaseNotesFn != nil { return m.generateReleaseNotesFn(ctx, tenantID, deploymentID, content) }
	return nil, nil
}
func (m *mockSvc) GetReleaseNotesByTenant(ctx context.Context, tenantID string) ([]models.ReleaseNote, error) {
	if m.getReleaseNotesByTenantFn != nil { return m.getReleaseNotesByTenantFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) LinkGitCommit(ctx context.Context, deploymentID, commitSHA, branch string) error {
	if m.linkGitCommitFn != nil { return m.linkGitCommitFn(ctx, deploymentID, commitSHA, branch) }
	return nil
}
func (m *mockSvc) GetDeploymentChangelog(ctx context.Context, deploymentID string) ([]models.GitChangelogEntry, error) {
	if m.getDeploymentChangelogFn != nil { return m.getDeploymentChangelogFn(ctx, deploymentID) }
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

func makeDeployment(id string) *models.Deployment {
	return &models.Deployment{ID: id, AppName: "app", Environment: "prod", Status: "pending", Version: "v1"}
}

// ==================== Create ====================

func TestHandler_Create_Success(t *testing.T) {
	d := makeDeployment("d1")
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID string, req models.CreateDeploymentRequest) (*models.Deployment, error) { return d, nil },
	})
	w := performRequest(h, h.Create, "POST", models.CreateDeploymentRequest{AppName: "app", Environment: "prod"}, nil, nil)
	if w.Code != http.StatusCreated { t.Fatalf("expected 201, got %d", w.Code) }
}

func TestHandler_Create_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.Create, "POST", models.CreateDeploymentRequest{AppName: "app"}, nil, nil)
	if w.Code != http.StatusBadRequest { t.Fatalf("expected 400, got %d", w.Code) }
}

func TestHandler_Create_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID string, req models.CreateDeploymentRequest) (*models.Deployment, error) { return nil, errors.New("db err") },
	})
	w := performRequest(h, h.Create, "POST", models.CreateDeploymentRequest{AppName: "app", Environment: "prod"}, nil, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

// ==================== Get ====================

func TestHandler_Get_Success(t *testing.T) {
	d := makeDeployment("d1")
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(ctx context.Context, tenantID, id string) (*models.Deployment, error) { return d, nil },
	})
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_Get_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getFn: func(ctx context.Context, tenantID, id string) (*models.Deployment, error) { return nil, errors.New("not found") },
	})
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound { t.Fatalf("expected 404, got %d", w.Code) }
}

// ==================== List ====================

func TestHandler_List_Success(t *testing.T) {
	d := []models.Deployment{*makeDeployment("d1")}
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(ctx context.Context, tenantID string, limit, offset int) ([]models.Deployment, error) { return d, nil },
	})
	w := performRequest(h, h.List, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_List_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(ctx context.Context, tenantID string, limit, offset int) ([]models.Deployment, error) { return nil, errors.New("db down") },
	})
	w := performRequest(h, h.List, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

// ==================== GetLatest ====================

func TestHandler_GetLatest_Success(t *testing.T) {
	d := makeDeployment("d1")
	h := newHandlerWithSvc(&mockSvc{
		getLatestFn: func(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error) { return d, nil },
	})
	w := performRequest(h, h.GetLatest, "GET", nil, map[string]string{"appName": "app", "environment": "prod"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetLatest_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getLatestFn: func(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error) { return nil, errors.New("not found") },
	})
	w := performRequest(h, h.GetLatest, "GET", nil, map[string]string{"appName": "app", "environment": "prod"}, nil)
	if w.Code != http.StatusNotFound { t.Fatalf("expected 404, got %d", w.Code) }
}

// ==================== GetMetrics ====================

func TestHandler_GetMetrics_Success(t *testing.T) {
	m := &models.DeploymentMetrics{Total: 5}
	h := newHandlerWithSvc(&mockSvc{
		metricsFn: func(ctx context.Context, tenantID string) (*models.DeploymentMetrics, error) { return m, nil },
	})
	w := performRequest(h, h.GetMetrics, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== Rollback ====================

func TestHandler_Rollback_Success(t *testing.T) {
	rb := &models.Rollback{ID: "rb1", ToVersion: "v0"}
	h := newHandlerWithSvc(&mockSvc{
		rollbackFn: func(ctx context.Context, tenantID, id string, targetVersion, reason string) (*models.Rollback, error) { return rb, nil },
	})
	w := performRequest(h, h.Rollback, "POST", models.RollbackRequest{TargetVersion: "v0", Reason: "bug"}, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusCreated { t.Fatalf("expected 201, got %d", w.Code) }
}

func TestHandler_Rollback_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	// Send raw JSON with invalid content-type to trigger parsing
	buf := bytes.NewBufferString(`not json at all`)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")
	c.Params = gin.Params{}
	c.Params = append(c.Params, gin.Param{Key: "id", Value: "d1"})
	c.Request = httptest.NewRequest("POST", "/", buf)
	c.Request.Header.Set("Content-Type", "application/json")
	h.Rollback(c)
	if w.Code != http.StatusBadRequest { t.Fatalf("expected 400, got %d", w.Code) }
}

func TestHandler_Rollback_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		rollbackFn: func(ctx context.Context, tenantID, id string, targetVersion, reason string) (*models.Rollback, error) { return nil, errors.New("db err") },
	})
	w := performRequest(h, h.Rollback, "POST", models.RollbackRequest{TargetVersion: "v0", Reason: "bug"}, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

// ==================== Cancel ====================

func TestHandler_Cancel_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		cancelFn: func(ctx context.Context, tenantID, id string) error { return nil },
	})
	w := performRequest(h, h.Cancel, "POST", nil, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_Cancel_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		cancelFn: func(ctx context.Context, tenantID, id string) error { return errors.New("db err") },
	})
	w := performRequest(h, h.Cancel, "POST", nil, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusInternalServerError { t.Fatalf("expected 500, got %d", w.Code) }
}

// ==================== GetAuditTrail ====================

func TestHandler_GetAuditTrail_Success(t *testing.T) {
	entries := []models.AuditEntry{{ID: 1, DeploymentID: "d1", Action: "create"}}
	h := newHandlerWithSvc(&mockSvc{
		getAuditTrailFn: func(ctx context.Context, deploymentID string) ([]models.AuditEntry, error) { return entries, nil },
	})
	w := performRequest(h, h.GetAuditTrail, "GET", nil, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== GetReleaseNotes ====================

func TestHandler_GetReleaseNotes_Success(t *testing.T) {
	note := &models.ReleaseNote{ID: "n1", DeploymentID: "d1", Content: "changelog"}
	h := newHandlerWithSvc(&mockSvc{
		getReleaseNotesFn: func(ctx context.Context, deploymentID string) (*models.ReleaseNote, error) { return note, nil },
	})
	w := performRequest(h, h.GetReleaseNotes, "GET", nil, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetReleaseNotes_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getReleaseNotesFn: func(ctx context.Context, deploymentID string) (*models.ReleaseNote, error) { return nil, errors.New("not found") },
	})
	w := performRequest(h, h.GetReleaseNotes, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound { t.Fatalf("expected 404, got %d", w.Code) }
}

// ==================== LinkGitCommit ====================

func TestHandler_LinkGitCommit_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		linkGitCommitFn: func(ctx context.Context, deploymentID, commitSHA, branch string) error { return nil },
	})
	w := performRequest(h, h.LinkGitCommit, "POST", models.LinkGitCommitRequest{CommitSHA: "abc123"}, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusCreated { t.Fatalf("expected 201, got %d", w.Code) }
}

func TestHandler_LinkGitCommit_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.LinkGitCommit, "POST", map[string]interface{}{"bad": "data"}, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusBadRequest { t.Fatalf("expected 400, got %d", w.Code) }
}

// ==================== GetDeploymentChangelog ====================

func TestHandler_GetDeploymentChangelog_Success(t *testing.T) {
	entries := []models.GitChangelogEntry{{CommitSHA: "abc", Message: "fix"}}
	h := newHandlerWithSvc(&mockSvc{
		getDeploymentChangelogFn: func(ctx context.Context, deploymentID string) ([]models.GitChangelogEntry, error) { return entries, nil },
	})
	w := performRequest(h, h.GetChangelog, "GET", nil, map[string]string{"id": "d1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}
