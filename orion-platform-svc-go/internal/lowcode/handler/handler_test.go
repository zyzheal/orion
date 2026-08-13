package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/lowcode/models"
	"orion/platform-svc-go/internal/lowcode/service"

	"github.com/gin-gonic/gin"
)

// --- Mock Service ---

type mockSvc struct {
	flows     map[string]*models.LowcodeFlow
	templates map[string]*models.LowcodeTemplate
}

func newMockSvc() *mockSvc {
	return &mockSvc{
		flows:     make(map[string]*models.LowcodeFlow),
		templates: make(map[string]*models.LowcodeTemplate),
	}
}

func (m *mockSvc) ListFlows(ctx context.Context, tenantID string, filter *models.ListFlowFilters, page, pageSize int) ([]models.LowcodeFlow, int, error) {
	var items []models.LowcodeFlow
	for _, f := range m.flows {
		items = append(items, *f)
	}
	return items, len(items), nil
}

func (m *mockSvc) GetFlow(ctx context.Context, tenantID, id string) (*models.LowcodeFlow, error) {
	f, ok := m.flows[id]
	if !ok {
		return nil, service.ErrFlowNotFound
	}
	return f, nil
}

func (m *mockSvc) CreateFlow(ctx context.Context, tenantID, userID string, req *models.CreateFlowRequest) (*models.LowcodeFlow, error) {
	f := &models.LowcodeFlow{
		ID:     "flow-" + tenantID + req.Name,
		Name:   req.Name,
		Version: req.Version,
	}
	if f.Version == "" {
		f.Version = "1.0.0"
	}
	m.flows[f.ID] = f
	return f, nil
}

func (m *mockSvc) UpdateFlow(ctx context.Context, tenantID, id string, req *models.UpdateFlowRequest) (*models.LowcodeFlow, error) {
	f, ok := m.flows[id]
	if !ok {
		return nil, service.ErrFlowNotFound
	}
	if req.Name != nil {
		f.Name = *req.Name
	}
	return f, nil
}

func (m *mockSvc) DeleteFlow(ctx context.Context, tenantID, id string) error {
	if _, ok := m.flows[id]; !ok {
		return service.ErrFlowNotFound
	}
	delete(m.flows, id)
	return nil
}

func (m *mockSvc) PublishFlow(ctx context.Context, tenantID, id string) (*models.LowcodeFlow, error) {
	f, ok := m.flows[id]
	if !ok {
		return nil, service.ErrFlowNotFound
	}
	f.Enabled = true
	return f, nil
}

func (m *mockSvc) ExecuteFlow(ctx context.Context, tenantID, userID, flowID string, input string) (*models.LowcodeInstance, error) {
	f, ok := m.flows[flowID]
	if !ok {
		return nil, service.ErrFlowNotFound
	}
	if !f.Enabled {
		return nil, service.ErrFlowNotEnabled
	}
	return &models.LowcodeInstance{ID: "inst-" + flowID, WorkflowID: flowID, Status: "success"}, nil
}

func (m *mockSvc) CreateVersion(ctx context.Context, tenantID, userID, workflowID string) (*models.VersionSnapshot, error) {
	_, ok := m.flows[workflowID]
	if !ok {
		return nil, service.ErrFlowNotFound
	}
	return &models.VersionSnapshot{ID: "snap-" + workflowID, WorkflowID: workflowID, Version: "1.0.0"}, nil
}

func (m *mockSvc) ListVersions(ctx context.Context, tenantID, workflowID string) ([]models.VersionSnapshot, error) {
	_, ok := m.flows[workflowID]
	if !ok {
		return nil, service.ErrFlowNotFound
	}
	return []models.VersionSnapshot{}, nil
}

func (m *mockSvc) ImportWorkflow(ctx context.Context, tenantID, userID string, req *models.ImportWorkflowRequest) (*models.LowcodeFlow, error) {
	return &models.LowcodeFlow{ID: "imp-" + req.Name, Name: req.Name, Version: "1.0.0"}, nil
}

func (m *mockSvc) ExportWorkflow(ctx context.Context, tenantID, id string) (*models.ExportResponse, error) {
	f, ok := m.flows[id]
	if !ok {
		return nil, service.ErrFlowNotFound
	}
	return &models.ExportResponse{Name: f.Name, Version: f.Version}, nil
}

func (m *mockSvc) ListTemplates(ctx context.Context) ([]models.LowcodeTemplate, error) {
	var items []models.LowcodeTemplate
	for _, t := range m.templates {
		items = append(items, *t)
	}
	return items, nil
}

func (m *mockSvc) CreateTemplate(ctx context.Context, userID string, req *models.CreateTemplateRequest) (*models.LowcodeTemplate, error) {
	t := &models.LowcodeTemplate{ID: "tmpl-" + req.Name, Name: req.Name, Tags: req.Tags}
	m.templates[t.ID] = t
	return t, nil
}

func (m *mockSvc) ApplyTemplate(ctx context.Context, tenantID, userID, templateID string, req *models.ApplyTemplateRequest) (*models.LowcodeFlow, error) {
	if _, ok := m.templates[templateID]; !ok {
		return nil, service.ErrTemplateNotFound
	}
	return &models.LowcodeFlow{ID: "flow-from-tmpl", Name: req.WorkflowName, Version: "1.0.0"}, nil
}

func makeCtx(method, path string, body interface{}) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")

	var reqBody *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewReader(b)
	} else {
		reqBody = bytes.NewReader([]byte{})
	}
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, reqBody)
	c.Request.Header.Set("Content-Type", "application/json")
	// Set path param
	if path == "/lowcode/flows/:id" || path == "/lowcode/flows/:id/publish" ||
		path == "/lowcode/flows/:id/execute" || path == "/lowcode/workflows/:id/versions" ||
		path == "/lowcode/workflows/:id/export" || path == "/lowcode/templates/:id/apply" {
		c.Params = gin.Params{{Key: "id", Value: "flow-1"}}
	}
	return c, w
}

func TestHandler_RegisterRoutes(t *testing.T) {
	h := NewHandler(newMockSvc())
	r := gin.New()
	rg := &r.RouterGroup
	h.RegisterRoutes(rg)
}

func TestHandler_ListFlows(t *testing.T) {
	svc := newMockSvc()
	svc.flows["f1"] = &models.LowcodeFlow{ID: "f1", Name: "test-flow", Version: "1.0.0"}
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodGet, "/lowcode/flows", nil)
	h.ListFlows(c)
	if w.Code != 200 {
		t.Fatalf("ListFlows status = %d, want 200", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	items := data["data"].([]interface{})
	if len(items) != 1 {
		t.Errorf("items = %d, want 1", len(items))
	}
}

func TestHandler_CreateFlow(t *testing.T) {
	svc := newMockSvc()
	h := NewHandler(svc)

	body := map[string]interface{}{"name": "new-flow"}
	c, w := makeCtx(http.MethodPost, "/lowcode/flows", body)
	h.CreateFlow(c)
	if w.Code != 201 {
		t.Fatalf("CreateFlow status = %d, want 201", w.Code)
	}
}

func TestHandler_GetFlow(t *testing.T) {
	svc := newMockSvc()
	svc.flows["flow-1"] = &models.LowcodeFlow{ID: "flow-1", Name: "existing", Version: "1.0.0"}
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodGet, "/lowcode/flows/:id", nil)
	h.GetFlow(c)
	if w.Code != 200 {
		t.Fatalf("GetFlow status = %d, want 200", w.Code)
	}
}

func TestHandler_GetFlow_NotFound(t *testing.T) {
	svc := newMockSvc()
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodGet, "/lowcode/flows/:id", nil)
	h.GetFlow(c)
	if w.Code != 404 {
		t.Fatalf("GetFlow status = %d, want 404", w.Code)
	}
}

func TestHandler_DeleteFlow(t *testing.T) {
	svc := newMockSvc()
	svc.flows["flow-1"] = &models.LowcodeFlow{ID: "flow-1", Name: "del-me"}
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodDelete, "/lowcode/flows/:id", nil)
	h.DeleteFlow(c)
	if w.Code != 200 {
		t.Fatalf("DeleteFlow status = %d, want 200", w.Code)
	}
}

func TestHandler_PublishFlow(t *testing.T) {
	svc := newMockSvc()
	svc.flows["flow-1"] = &models.LowcodeFlow{ID: "flow-1", Name: "publish-me", Version: "1.0.0"}
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodPost, "/lowcode/flows/:id/publish", nil)
	h.PublishFlow(c)
	if w.Code != 200 {
		t.Fatalf("PublishFlow status = %d, want 200", w.Code)
	}
}

func TestHandler_ExecuteFlow(t *testing.T) {
	svc := newMockSvc()
	svc.flows["flow-1"] = &models.LowcodeFlow{ID: "flow-1", Enabled: true}
	h := NewHandler(svc)

	body := map[string]interface{}{"input": `{}`}
	c, w := makeCtx(http.MethodPost, "/lowcode/flows/:id/execute", body)
	h.ExecuteFlow(c)
	if w.Code != 201 {
		t.Fatalf("ExecuteFlow status = %d, want 201", w.Code)
	}
}

func TestHandler_ExecuteFlow_NotEnabled(t *testing.T) {
	svc := newMockSvc()
	svc.flows["flow-1"] = &models.LowcodeFlow{ID: "flow-1", Enabled: false}
	h := NewHandler(svc)

	body := map[string]interface{}{"input": `{}`}
	c, w := makeCtx(http.MethodPost, "/lowcode/flows/:id/execute", body)
	h.ExecuteFlow(c)
	if w.Code != 400 {
		t.Fatalf("ExecuteFlow status = %d, want 400", w.Code)
	}
}

func TestHandler_CreateVersion(t *testing.T) {
	svc := newMockSvc()
	svc.flows["flow-1"] = &models.LowcodeFlow{ID: "flow-1", Version: "1.0.0"}
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodPost, "/lowcode/workflows/:id/versions", nil)
	h.CreateVersion(c)
	if w.Code != 201 {
		t.Fatalf("CreateVersion status = %d, want 201", w.Code)
	}
}

func TestHandler_ImportWorkflow(t *testing.T) {
	svc := newMockSvc()
	h := NewHandler(svc)

	body := map[string]interface{}{
		"name": "imported",
		"current_definition": map[string]interface{}{
			"nodes": `[]`, "edges": `[]`,
		},
	}
	c, w := makeCtx(http.MethodPost, "/lowcode/workflows/import", body)
	h.ImportWorkflow(c)
	if w.Code != 201 {
		t.Fatalf("ImportWorkflow status = %d, want 201", w.Code)
	}
}

func TestHandler_ExportWorkflow(t *testing.T) {
	svc := newMockSvc()
	svc.flows["flow-1"] = &models.LowcodeFlow{ID: "flow-1", Name: "export-me", Version: "1.0.0"}
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodPost, "/lowcode/workflows/:id/export", nil)
	h.ExportWorkflow(c)
	if w.Code != 200 {
		t.Fatalf("ExportWorkflow status = %d, want 200", w.Code)
	}
}

func TestHandler_CreateTemplate(t *testing.T) {
	svc := newMockSvc()
	h := NewHandler(svc)

	body := map[string]interface{}{"name": "login-form", "tags": "auth,login"}
	c, w := makeCtx(http.MethodPost, "/lowcode/templates", body)
	h.CreateTemplate(c)
	if w.Code != 201 {
		t.Fatalf("CreateTemplate status = %d, want 201", w.Code)
	}
}

func TestHandler_ListTemplates(t *testing.T) {
	svc := newMockSvc()
	svc.templates["t1"] = &models.LowcodeTemplate{ID: "t1", Name: "tpl"}
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodGet, "/lowcode/templates", nil)
	h.ListTemplates(c)
	if w.Code != 200 {
		t.Fatalf("ListTemplates status = %d, want 200", w.Code)
	}
}

func TestHandler_ApplyTemplate(t *testing.T) {
	svc := newMockSvc()
	svc.templates["flow-1"] = &models.LowcodeTemplate{ID: "flow-1", Name: "tpl"}
	h := NewHandler(svc)

	body := map[string]interface{}{"workflow_name": "new-from-tmpl"}
	c, w := makeCtx(http.MethodPost, "/lowcode/templates/:id/apply", body)
	h.ApplyTemplate(c)
	if w.Code != 201 {
		t.Fatalf("ApplyTemplate status = %d, want 201", w.Code)
	}
}