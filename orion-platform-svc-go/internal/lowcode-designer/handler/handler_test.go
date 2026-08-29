package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/lowcode-designer/models"

	"github.com/gin-gonic/gin"
)

type errNotFoundType struct{}

func (errNotFoundType) Error() string { return "not found" }

var errNotFound = errNotFoundType{}

type mockDesignerSvc struct {
	forms     map[string]*models.FormDefinition
	fields    map[string]*models.FormField
	tmpls     map[string]*models.FormTemplate
	instances map[string]*models.FormInstance
	comps     map[string]*models.ComponentRegistry
}

func newMockDesignerSvc() *mockDesignerSvc {
	return &mockDesignerSvc{
		forms:     make(map[string]*models.FormDefinition),
		fields:    make(map[string]*models.FormField),
		tmpls:     make(map[string]*models.FormTemplate),
		instances: make(map[string]*models.FormInstance),
		comps:     make(map[string]*models.ComponentRegistry),
	}
}

func (m *mockDesignerSvc) CreateForm(ctx context.Context, req *models.CreateFormRequest, tenantID, operator string) (*models.FormDefinition, error) {
	f := &models.FormDefinition{ID: "fd-" + req.Name, Name: req.Name, Title: req.Title, Status: "draft", TenantID: tenantID}
	m.forms[f.ID] = f
	return f, nil
}

func (m *mockDesignerSvc) GetForm(ctx context.Context, id, tenantID string) (*models.FormDefinition, error) {
	f, ok := m.forms[id]
	if !ok {
		return nil, errNotFound
	}
	return f, nil
}

func (m *mockDesignerSvc) ListForms(ctx context.Context, tenantID, category, status string) ([]models.FormDefinition, error) {
	var items []models.FormDefinition
	for _, f := range m.forms {
		if category != "" && f.Name != category {
			continue
		}
		items = append(items, *f)
	}
	if items == nil {
		items = []models.FormDefinition{}
	}
	return items, nil
}

func (m *mockDesignerSvc) UpdateForm(ctx context.Context, id, tenantID, operator string, req *models.UpdateFormRequest) (*models.FormDefinition, error) {
	f, ok := m.forms[id]
	if !ok {
		return nil, errNotFound
	}
	if req.Name != nil {
		f.Name = *req.Name
	}
	return f, nil
}

func (m *mockDesignerSvc) DeleteForm(ctx context.Context, id, tenantID string) (bool, error) {
	if _, ok := m.forms[id]; !ok {
		return false, nil
	}
	delete(m.forms, id)
	return true, nil
}

func (m *mockDesignerSvc) CreateField(ctx context.Context, formID, tenantID string, req *models.CreateFieldRequest) (*models.FormField, error) {
	ff := &models.FormField{ID: "ff-" + req.Key, Key: req.Key, Label: req.Label, Type: req.Type, FormID: formID}
	m.fields[ff.ID] = ff
	return ff, nil
}

func (m *mockDesignerSvc) UpdateField(ctx context.Context, id, tenantID string, req *models.CreateFieldRequest) (*models.FormField, error) {
	ff, ok := m.fields[id]
	if !ok {
		return nil, errNotFound
	}
	if req.Label != "" {
		ff.Label = req.Label
	}
	return ff, nil
}

func (m *mockDesignerSvc) DeleteField(ctx context.Context, id, tenantID string) (bool, error) {
	if _, ok := m.fields[id]; !ok {
		return false, nil
	}
	delete(m.fields, id)
	return true, nil
}

func (m *mockDesignerSvc) GetFieldsByForm(ctx context.Context, formID, tenantID string) ([]models.FormField, error) {
	var items []models.FormField
	for _, ff := range m.fields {
		if ff.FormID == formID {
			items = append(items, *ff)
		}
	}
	if items == nil {
		items = []models.FormField{}
	}
	return items, nil
}

func (m *mockDesignerSvc) ListTemplates(ctx context.Context, tenantID, category string) ([]models.FormTemplate, error) {
	var items []models.FormTemplate
	for _, t := range m.tmpls {
		items = append(items, *t)
	}
	if items == nil {
		items = []models.FormTemplate{}
	}
	return items, nil
}

func (m *mockDesignerSvc) GetTemplate(ctx context.Context, id string) (*models.FormTemplate, error) {
	t, ok := m.tmpls[id]
	if !ok {
		return nil, errNotFound
	}
	return t, nil
}

func (m *mockDesignerSvc) CreateTemplate(ctx context.Context, tenantID, name, description, category string, schema map[string]interface{}) (*models.FormTemplate, error) {
	t := &models.FormTemplate{ID: "ft-" + name, Name: name, Category: category}
	m.tmpls[t.ID] = t
	return t, nil
}

func (m *mockDesignerSvc) SubmitInstance(ctx context.Context, formID, tenantID string, req *models.SubmitInstanceRequest) (*models.FormInstance, error) {
	inst := &models.FormInstance{ID: "fi-" + formID, FormID: formID, Status: "submitted", TenantID: tenantID}
	m.instances[inst.ID] = inst
	return inst, nil
}

func (m *mockDesignerSvc) ListInstances(ctx context.Context, tenantID, formID, status string) ([]models.FormInstance, error) {
	var items []models.FormInstance
	for _, inst := range m.instances {
		if status != "" && inst.Status != status {
			continue
		}
		items = append(items, *inst)
	}
	if items == nil {
		items = []models.FormInstance{}
	}
	return items, nil
}

func (m *mockDesignerSvc) GetInstance(ctx context.Context, id, tenantID string) (*models.FormInstance, error) {
	inst, ok := m.instances[id]
	if !ok {
		return nil, errNotFound
	}
	return inst, nil
}

func (m *mockDesignerSvc) ApproveInstance(ctx context.Context, id, tenantID string, req *models.ApproveInstanceRequest) (*models.FormInstance, error) {
	inst, ok := m.instances[id]
	if !ok {
		return nil, errNotFound
	}
	inst.Status = req.Action
	return inst, nil
}

func (m *mockDesignerSvc) ListComponents(ctx context.Context, tenantID, category string) ([]models.ComponentRegistry, error) {
	var items []models.ComponentRegistry
	for _, c := range m.comps {
		items = append(items, *c)
	}
	if items == nil {
		items = []models.ComponentRegistry{}
	}
	return items, nil
}

func (m *mockDesignerSvc) GetComponent(ctx context.Context, id string) (*models.ComponentRegistry, error) {
	c, ok := m.comps[id]
	if !ok {
		return nil, errNotFound
	}
	return c, nil
}

func (m *mockDesignerSvc) CreateComponent(ctx context.Context, tenantID, name, displayName, category, version string, propsSchema map[string]interface{}, defaultConfig map[string]interface{}, icon string) (*models.ComponentRegistry, error) {
	c := &models.ComponentRegistry{ID: "cr-" + name, Name: name, DisplayName: displayName, Category: category, Version: version}
	m.comps[c.ID] = c
	return c, nil
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
	c.Params = gin.Params{{Key: "id", Value: "item-1"}, {Key: "formId", Value: "form-1"}}
	c.Request = httptest.NewRequest(method, path, reqBody)
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

func TestDesigner_RegisterRoutes(t *testing.T) {
	h := NewHandler(newMockDesignerSvc())
	r := gin.New()
	rg := &r.RouterGroup
	h.RegisterRoutes(rg)
}

func TestDesigner_ListForms(t *testing.T) {
	svc := newMockDesignerSvc()
	svc.forms["f1"] = &models.FormDefinition{ID: "f1", Name: "login"}
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodGet, "/forms", nil)
	h.ListForms(c)
	if w.Code != 200 {
		t.Fatalf("ListForms status = %d, want 200", w.Code)
	}
}

func TestDesigner_CreateForm(t *testing.T) {
	svc := newMockDesignerSvc()
	h := NewHandler(svc)

	body := map[string]interface{}{
		"name":   "user-form",
		"title":  "User Registration",
		"fields": []interface{}{map[string]interface{}{"key": "email", "label": "Email", "type": "text"}},
	}
	c, w := makeCtx(http.MethodPost, "/forms", body)
	h.CreateForm(c)
	if w.Code != 201 {
		t.Fatalf("CreateForm status = %d, want 201", w.Code)
	}
}

func TestDesigner_GetForm(t *testing.T) {
	svc := newMockDesignerSvc()
	svc.forms["item-1"] = &models.FormDefinition{ID: "item-1", Name: "exist"}
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodGet, "/forms/:id", nil)
	h.GetForm(c)
	if w.Code != 200 {
		t.Fatalf("GetForm status = %d, want 200", w.Code)
	}
}

func TestDesigner_GetForm_NotFound(t *testing.T) {
	svc := newMockDesignerSvc()
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodGet, "/forms/:id", nil)
	h.GetForm(c)
	if w.Code != 404 {
		t.Fatalf("GetForm status = %d, want 404", w.Code)
	}
}

func TestDesigner_DeleteForm(t *testing.T) {
	svc := newMockDesignerSvc()
	svc.forms["item-1"] = &models.FormDefinition{ID: "item-1", Name: "del"}
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodDelete, "/forms/:id", nil)
	h.DeleteForm(c)
	if w.Code != 200 {
		t.Fatalf("DeleteForm status = %d, want 200", w.Code)
	}
}

func TestDesigner_CreateField(t *testing.T) {
	svc := newMockDesignerSvc()
	h := NewHandler(svc)

	body := map[string]interface{}{"key": "email", "label": "Email", "type": "text"}
	c, w := makeCtx(http.MethodPost, "/forms/:id/fields", body)
	h.CreateField(c)
	if w.Code != 201 {
		t.Fatalf("CreateField status = %d, want 201", w.Code)
	}
}

func TestDesigner_GetFieldsByForm(t *testing.T) {
	svc := newMockDesignerSvc()
	svc.fields["ff-email"] = &models.FormField{ID: "ff-email", FormID: "form-1", Key: "email"}
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodGet, "/forms/:id/fields", nil)
	h.GetFieldsByForm(c)
	if w.Code != 200 {
		t.Fatalf("GetFieldsByForm status = %d, want 200", w.Code)
	}
}

func TestDesigner_CreateTemplate(t *testing.T) {
	svc := newMockDesignerSvc()
	h := NewHandler(svc)

	body := map[string]interface{}{
		"name":     "login-tpl",
		"category": "auth",
		"schema":   map[string]interface{}{"fields": []interface{}{}},
	}
	c, w := makeCtx(http.MethodPost, "/templates", body)
	h.CreateTemplate(c)
	if w.Code != 201 {
		t.Fatalf("CreateTemplate status = %d, want 201", w.Code)
	}
}

func TestDesigner_GetTemplate(t *testing.T) {
	svc := newMockDesignerSvc()
	svc.tmpls["item-1"] = &models.FormTemplate{ID: "item-1", Name: "tpl"}
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodGet, "/templates/:id", nil)
	h.GetTemplate(c)
	if w.Code != 200 {
		t.Fatalf("GetTemplate status = %d, want 200", w.Code)
	}
}

func TestDesigner_SubmitInstance(t *testing.T) {
	svc := newMockDesignerSvc()
	h := NewHandler(svc)

	body := map[string]interface{}{
		"data":     map[string]interface{}{"key": "value"},
		"submitBy": "user-1",
	}
	c, w := makeCtx(http.MethodPost, "/forms/:id/instances", body)
	h.SubmitInstance(c)
	if w.Code != 201 {
		t.Fatalf("SubmitInstance status = %d, want 201", w.Code)
	}
}

func TestDesigner_ApproveInstance(t *testing.T) {
	svc := newMockDesignerSvc()
	svc.instances["item-1"] = &models.FormInstance{ID: "item-1", Status: "submitted"}
	h := NewHandler(svc)

	body := map[string]interface{}{"approver": "mgr", "action": "approve"}
	c, w := makeCtx(http.MethodPost, "/instances/:id/approve", body)
	h.ApproveInstance(c)
	if w.Code != 200 {
		t.Fatalf("ApproveInstance status = %d, want 200", w.Code)
	}
}

func TestDesigner_CreateComponent(t *testing.T) {
	svc := newMockDesignerSvc()
	h := NewHandler(svc)

	body := map[string]interface{}{
		"name":          "btn",
		"displayName":   "Button",
		"propsSchema":   map[string]interface{}{"label": "string"},
		"defaultConfig": map[string]interface{}{"label": "Click"},
		"icon":          "button",
	}
	c, w := makeCtx(http.MethodPost, "/components", body)
	h.CreateComponent(c)
	if w.Code != 201 {
		t.Fatalf("CreateComponent status = %d, want 201", w.Code)
	}
}

func TestDesigner_GetComponent_NotFound(t *testing.T) {
	svc := newMockDesignerSvc()
	h := NewHandler(svc)

	c, w := makeCtx(http.MethodGet, "/components/:id", nil)
	h.GetComponent(c)
	if w.Code != 404 {
		t.Fatalf("GetComponent status = %d, want 404", w.Code)
	}
}
