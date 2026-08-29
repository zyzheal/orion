package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/workflow-webhook/handler"
	"orion/platform-svc-go/internal/workflow-webhook/models"
	"orion/platform-svc-go/internal/workflow-webhook/service"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// Fake repository
// ---------------------------------------------------------------------------

var testTrigger = &models.WebhookTrigger{
	ID:              "trigger-1",
	TenantID:        "tenant-1",
	WorkflowID:      "wf-1",
	Name:            "test-webhook",
	WebhookPath:     "test-path",
	WebhookSecret:   "",
	TriggerStrategy: models.StrategyAsync,
	Enabled:         true,
}

type fakeWebhookRepo struct {
	triggers    map[string]*models.WebhookTrigger
	logs        map[string][]models.WebhookTriggerLog
	errGet      error
	errCount    error
	errCreate   error
	errUpdate   error
	errDelete   error
	errList     error
	errListLogs error
}

func newFakeWebhookRepo() *fakeWebhookRepo {
	return &fakeWebhookRepo{
		triggers: map[string]*models.WebhookTrigger{
			"trigger-1": testTrigger,
		},
		logs: map[string][]models.WebhookTriggerLog{},
	}
}

func (r *fakeWebhookRepo) Count(_ context.Context, tenantID string) (int, error) {
	if r.errCount != nil {
		return 0, r.errCount
	}
	return 1, nil
}

func (r *fakeWebhookRepo) Create(_ context.Context, t *models.WebhookTrigger) error {
	if r.errCreate != nil {
		return r.errCreate
	}
	r.triggers[t.ID] = t
	return nil
}

func (r *fakeWebhookRepo) CreateLog(_ context.Context, log *models.WebhookTriggerLog) error {
	r.logs[log.TriggerID] = append(r.logs[log.TriggerID], *log)
	return nil
}

func (r *fakeWebhookRepo) Delete(_ context.Context, tenantID, id string) error {
	if r.errDelete != nil {
		return r.errDelete
	}
	if _, ok := r.triggers[id]; !ok {
		return fmtWebhookNotFound(id)
	}
	delete(r.triggers, id)
	return nil
}

func (r *fakeWebhookRepo) FindByWebhookPath(_ context.Context, webhookPath string) (*models.WebhookTrigger, error) {
	for _, t := range r.triggers {
		if t.WebhookPath == webhookPath {
			return t, nil
		}
	}
	return nil, nil
}

func (r *fakeWebhookRepo) GetByID(_ context.Context, tenantID, id string) (*models.WebhookTrigger, error) {
	if r.errGet != nil {
		return nil, r.errGet
	}
	if t, ok := r.triggers[id]; ok {
		return t, nil
	}
	return nil, fmtWebhookNotFound(id)
}

func (r *fakeWebhookRepo) List(_ context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.WebhookTrigger, error) {
	if r.errList != nil {
		return nil, r.errList
	}
	var items []models.WebhookTrigger
	for _, t := range r.triggers {
		items = append(items, *t)
	}
	return items, nil
}

func (r *fakeWebhookRepo) ListLogs(_ context.Context, triggerID string, offset, limit int) ([]models.WebhookTriggerLog, error) {
	if r.errListLogs != nil {
		return nil, r.errListLogs
	}
	logs, _ := r.logs[triggerID]
	return logs, nil
}

func (r *fakeWebhookRepo) Update(_ context.Context, t *models.WebhookTrigger) error {
	if r.errUpdate != nil {
		return r.errUpdate
	}
	r.triggers[t.ID] = t
	return nil
}

// fmtWebhookNotFound wraps service.ErrWebhookNotFound so handler.IsNotFound matches.
func fmtWebhookNotFound(id string) error {
	return errors.Join(service.ErrWebhookNotFound, fmt.Errorf("trigger %s", id))
}

var _ service.RepositoryInterface = (*fakeWebhookRepo)(nil)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

func makeCtx(method string, path string, body interface{}, params map[string]string, headers map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, path, buf)
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	if headers != nil {
		for k, v := range headers {
			c.Request.Header.Set(k, v)
		}
	}
	return c, w
}

func newHandler() *handler.Handler {
	repo := newFakeWebhookRepo()
	svc := service.NewService(repo)
	return handler.NewHandler(svc, nil)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestWorkflowWebhook_Handler_NewHandler(t *testing.T) {
	h := newHandler()
	if h == nil {
		t.Fatal("NewHandler returned nil")
	}
}

func TestWorkflowWebhook_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestWorkflowWebhook_Handler_List(t *testing.T) {
	h := newHandler()
	c, w := makeCtx(http.MethodGet, "/api/v1/workflow-webhooks", nil, nil, nil)
	h.List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_Count(t *testing.T) {
	h := newHandler()
	c, w := makeCtx(http.MethodGet, "/api/v1/workflow-webhooks/count", nil, nil, nil)
	h.Count(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Count: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_Get(t *testing.T) {
	h := newHandler()
	c, w := makeCtx(http.MethodGet, "/api/v1/workflow-webhooks/trigger-1", nil, map[string]string{"id": "trigger-1"}, nil)
	h.Get(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_Create(t *testing.T) {
	h := newHandler()
	c, w := makeCtx(http.MethodPost, "/api/v1/workflow-webhooks", models.CreateWebhookTriggerRequest{
		Name:        "new-webhook",
		WorkflowID:  "wf-2",
		WebhookPath: "new-path",
		Enabled:     true,
	}, nil, nil)
	h.Create(c)
	if w.Code != http.StatusCreated && w.Code != http.StatusOK {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_Create_InvalidBody(t *testing.T) {
	h := newHandler()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/workflow-webhooks", bytes.NewBufferString(`{"bad": true}`))
	h.Create(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("Create invalid body: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_Update(t *testing.T) {
	h := newHandler()
	newName := "renamed-webhook"
	c, w := makeCtx(http.MethodPut, "/api/v1/workflow-webhooks/trigger-1", models.UpdateWebhookTriggerRequest{
		Name: &newName,
	}, map[string]string{"id": "trigger-1"}, nil)
	h.Update(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_Delete(t *testing.T) {
	h := newHandler()
	c, w := makeCtx(http.MethodDelete, "/api/v1/workflow-webhooks/trigger-1", nil, map[string]string{"id": "trigger-1"}, nil)
	h.Delete(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Delete: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_RotateSecret(t *testing.T) {
	h := newHandler()
	c, w := makeCtx(http.MethodPost, "/api/v1/workflow-webhooks/trigger-1/rotate-secret", nil, map[string]string{"id": "trigger-1"}, nil)
	h.RotateSecret(c)
	if w.Code != http.StatusOK {
		t.Fatalf("RotateSecret: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_ListLogs(t *testing.T) {
	h := newHandler()
	c, w := makeCtx(http.MethodGet, "/api/v1/workflow-webhooks/trigger-1/logs", nil, map[string]string{"id": "trigger-1"}, nil)
	h.ListLogs(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListLogs: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_HandleWebhook_Success(t *testing.T) {
	h := newHandler()
	c, w := makeCtx(http.MethodPost, "/api/v1/webhooks/test-path",
		map[string]string{"key": "value"},
		map[string]string{"webhookPath": "test-path"},
		nil)
	h.HandleWebhook(c)
	if w.Code >= 500 {
		t.Fatalf("HandleWebhook success: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_HandleWebhook_EmptyPath(t *testing.T) {
	h := newHandler()
	c, w := makeCtx(http.MethodPost, "/api/v1/webhooks/",
		nil,
		map[string]string{"webhookPath": ""},
		nil)
	h.HandleWebhook(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("HandleWebhook empty path: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_MissingTenantID(t *testing.T) {
	h := newHandler()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/workflow-webhooks", nil)
	h.List(c)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("MissingTenantID: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_Get_NotFound(t *testing.T) {
	h := newHandler()
	c, w := makeCtx(http.MethodGet, "/api/v1/workflow-webhooks/nonexistent", nil, map[string]string{"id": "nonexistent"}, nil)
	h.Get(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("Get NotFound: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_Update_NotFound(t *testing.T) {
	h := newHandler()
	newName := "renamed"
	c, w := makeCtx(http.MethodPut, "/api/v1/workflow-webhooks/nonexistent", models.UpdateWebhookTriggerRequest{
		Name: &newName,
	}, map[string]string{"id": "nonexistent"}, nil)
	h.Update(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("Update NotFound: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_Delete_NotFound(t *testing.T) {
	h := newHandler()
	c, w := makeCtx(http.MethodDelete, "/api/v1/workflow-webhooks/nonexistent", nil, map[string]string{"id": "nonexistent"}, nil)
	h.Delete(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("Delete NotFound: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_RotateSecret_NotFound(t *testing.T) {
	h := newHandler()
	c, w := makeCtx(http.MethodPost, "/api/v1/workflow-webhooks/nonexistent/rotate-secret", nil, map[string]string{"id": "nonexistent"}, nil)
	h.RotateSecret(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("RotateSecret NotFound: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_ListLogs_NotFound(t *testing.T) {
	h := newHandler()
	c, w := makeCtx(http.MethodGet, "/api/v1/workflow-webhooks/nonexistent/logs", nil, map[string]string{"id": "nonexistent"}, nil)
	h.ListLogs(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("ListLogs NotFound: got %d", w.Code)
	}
}

func TestWorkflowWebhook_Handler_List_Pagination(t *testing.T) {
	h := newHandler()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/workflow-webhooks?page=2&pageSize=50", nil)
	h.List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("List pagination: got %d", w.Code)
	}
}
