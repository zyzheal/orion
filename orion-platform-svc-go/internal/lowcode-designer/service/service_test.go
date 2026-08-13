package service

import (
	"context"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/lowcode-designer/models"
)

var errNotFound = errors.New("not found")

// --- Fake Repository ---

type fakeDesignerRepo struct {
	forms    map[string]*models.FormDefinition
	fields   map[string]*models.FormField
	tmpls    map[string]*models.FormTemplate
	instances map[string]*models.FormInstance
	comps    map[string]*models.ComponentRegistry
}

func newFakeDesignerRepo() *fakeDesignerRepo {
	return &fakeDesignerRepo{
		forms:     make(map[string]*models.FormDefinition),
		fields:    make(map[string]*models.FormField),
		tmpls:     make(map[string]*models.FormTemplate),
		instances: make(map[string]*models.FormInstance),
		comps:     make(map[string]*models.ComponentRegistry),
	}
}

func (f *fakeDesignerRepo) CreateForm(ctx context.Context, fd *models.FormDefinition) error {
	f.forms[fd.ID] = fd
	return nil
}

func (f *fakeDesignerRepo) GetForm(ctx context.Context, id, tenantID string) (*models.FormDefinition, error) {
	fd, ok := f.forms[id]
	if !ok {
		return nil, errNotFound
	}
	if fd.TenantID != tenantID {
		return nil, errNotFound
	}
	return fd, nil
}

func (f *fakeDesignerRepo) ListForms(ctx context.Context, tenantID, category, status string) ([]models.FormDefinition, error) {
	var items []models.FormDefinition
	for _, fd := range f.forms {
		if fd.TenantID != tenantID {
			continue
		}
		if category != "" && fd.Category != category {
			continue
		}
		if status != "" && fd.Status != status {
			continue
		}
		items = append(items, *fd)
	}
	return items, nil
}

func (f *fakeDesignerRepo) UpdateForm(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FormDefinition, error) {
	fd, ok := f.forms[id]
	if !ok || fd.TenantID != tenantID {
		return nil, errNotFound
	}
	if v, ok := attrs["name"]; ok {
		fd.Name = v.(string)
	}
	if v, ok := attrs["title"]; ok {
		fd.Title = v.(string)
	}
	if v, ok := attrs["description"]; ok {
		fd.Description = v.(string)
	}
	if v, ok := attrs["category"]; ok {
		fd.Category = v.(string)
	}
	if v, ok := attrs["module_name"]; ok {
		fd.ModuleName = v.(string)
	}
	if v, ok := attrs["fields"]; ok {
		fd.FieldsJSON = v.(string)
	}
	if v, ok := attrs["updated_by"]; ok {
		fd.UpdatedBy = v.(string)
	}
	return fd, nil
}

func (f *fakeDesignerRepo) DeleteForm(ctx context.Context, id, tenantID string) (bool, error) {
	fd, ok := f.forms[id]
	if !ok || fd.TenantID != tenantID {
		return false, nil
	}
	delete(f.forms, id)
	return true, nil
}

func (f *fakeDesignerRepo) CreateField(ctx context.Context, ff *models.FormField) error {
	f.fields[ff.ID] = ff
	return nil
}

func (f *fakeDesignerRepo) UpdateField(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FormField, error) {
	ff, ok := f.fields[id]
	if !ok || ff.TenantID != tenantID {
		return nil, errNotFound
	}
	if v, ok := attrs["label"]; ok {
		ff.Label = v.(string)
	}
	if v, ok := attrs["type"]; ok {
		ff.Type = v.(string)
	}
	if v, ok := attrs["required"]; ok {
		ff.Required = v.(bool)
	}
	if v, ok := attrs["visible"]; ok {
		ff.Visible = v.(bool)
	}
	if v, ok := attrs["sortable_index"]; ok {
		ff.SortableIndex = v.(int)
	}
	return ff, nil
}

func (f *fakeDesignerRepo) DeleteField(ctx context.Context, id, tenantID string) (bool, error) {
	ff, ok := f.fields[id]
	if !ok || ff.TenantID != tenantID {
		return false, nil
	}
	delete(f.fields, id)
	return true, nil
}

func (f *fakeDesignerRepo) GetFieldsByForm(ctx context.Context, formID, tenantID string) ([]models.FormField, error) {
	var items []models.FormField
	for _, ff := range f.fields {
		if ff.FormID == formID && ff.TenantID == tenantID {
			items = append(items, *ff)
		}
	}
	return items, nil
}

func (f *fakeDesignerRepo) CreateTemplate(ctx context.Context, t *models.FormTemplate) error {
	f.tmpls[t.ID] = t
	return nil
}

func (f *fakeDesignerRepo) ListTemplates(ctx context.Context, tenantID, category string) ([]models.FormTemplate, error) {
	var items []models.FormTemplate
	for _, t := range f.tmpls {
		if t.TenantID != tenantID {
			continue
		}
		if category != "" && t.Category != category {
			continue
		}
		items = append(items, *t)
	}
	return items, nil
}

func (f *fakeDesignerRepo) GetTemplate(ctx context.Context, id string) (*models.FormTemplate, error) {
	t, ok := f.tmpls[id]
	if !ok {
		return nil, errNotFound
	}
	return t, nil
}

func (f *fakeDesignerRepo) UpdateTemplateUsage(ctx context.Context, id string) error {
	return nil
}

func (f *fakeDesignerRepo) CreateInstance(ctx context.Context, inst *models.FormInstance) error {
	f.instances[inst.ID] = inst
	return nil
}

func (f *fakeDesignerRepo) GetInstance(ctx context.Context, id, tenantID string) (*models.FormInstance, error) {
	inst, ok := f.instances[id]
	if !ok {
		return nil, errNotFound
	}
	return inst, nil
}

func (f *fakeDesignerRepo) ListInstances(ctx context.Context, tenantID, formID, status string) ([]models.FormInstance, error) {
	var items []models.FormInstance
	for _, inst := range f.instances {
		if inst.TenantID != tenantID {
			continue
		}
		if formID != "" && inst.FormID != formID {
			continue
		}
		if status != "" && inst.Status != status {
			continue
		}
		items = append(items, *inst)
	}
	return items, nil
}

func (f *fakeDesignerRepo) UpdateInstance(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FormInstance, error) {
	inst, ok := f.instances[id]
	if !ok {
		return nil, errNotFound
	}
	if v, ok := attrs["status"]; ok {
		inst.Status = v.(string)
	}
	if v, ok := attrs["approved_by"]; ok {
		inst.ApprovedBy = v.(string)
	}
	return inst, nil
}

func (f *fakeDesignerRepo) CreateComponent(ctx context.Context, c *models.ComponentRegistry) error {
	f.comps[c.ID] = c
	return nil
}

func (f *fakeDesignerRepo) ListComponents(ctx context.Context, tenantID, category string) ([]models.ComponentRegistry, error) {
	var items []models.ComponentRegistry
	for _, c := range f.comps {
		if c.TenantID != tenantID {
			continue
		}
		if category != "" && c.Category != category {
			continue
		}
		items = append(items, *c)
	}
	return items, nil
}

func (f *fakeDesignerRepo) GetComponent(ctx context.Context, id string) (*models.ComponentRegistry, error) {
	c, ok := f.comps[id]
	if !ok {
		return nil, errNotFound
	}
	return c, nil
}

// --- Tests ---

func TestCreateForm_createsFormWithFields(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)

	req := &models.CreateFormRequest{
		Name:     "user-form",
		Title:    "User Registration",
		Category: "auth",
		Fields: []models.FormField{
			{Key: "email", Label: "Email", Type: "text", Required: true},
		},
	}
	form, err := svc.CreateForm(context.Background(), req, "t1", "admin")
	if err != nil {
		t.Fatalf("CreateForm error: %v", err)
	}
	if form.Name != "user-form" {
		t.Errorf("Name = %q, want user-form", form.Name)
	}
	if form.Version != 1 {
		t.Errorf("Version = %d, want 1", form.Version)
	}
	if form.Status != "draft" {
		t.Errorf("Status = %q, want draft", form.Status)
	}

	// Verify field was created
	fields, _ := repo.GetFieldsByForm(context.Background(), form.ID, "t1")
	if len(fields) != 1 {
		t.Errorf("fields count = %d, want 1", len(fields))
	}
	if len(fields) > 0 && fields[0].Key != "email" {
		t.Errorf("field key = %q, want email", fields[0].Key)
	}
}

func TestGetForm_returnsForm(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)

	req := &models.CreateFormRequest{Name: "g", Fields: []models.FormField{{Key: "x", Label: "x", Type: "text"}}}
	fd, _ := svc.CreateForm(context.Background(), req, "t1", "admin")

	got, err := svc.GetForm(context.Background(), fd.ID, "t1")
	if err != nil {
		t.Fatalf("GetForm error: %v", err)
	}
	if got.ID != fd.ID {
		t.Errorf("ID mismatch")
	}
}

func TestGetForm_notFound(t *testing.T) {
	svc := NewService(newFakeDesignerRepo())
	_, err := svc.GetForm(context.Background(), "ghost", "t1")
	if !errors.Is(err, errNotFound) {
		t.Errorf("GetForm error = %v, want ErrNotFound", err)
	}
}

func TestListForms_filtersByCategoryAndStatus(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)

	svc.CreateForm(context.Background(), &models.CreateFormRequest{
		Name: "a", Category: "auth",
		Fields: []models.FormField{{Key: "x", Label: "x", Type: "text"}},
	}, "t1", "admin")
	svc.CreateForm(context.Background(), &models.CreateFormRequest{
		Name: "b", Category: "billing",
		Fields: []models.FormField{{Key: "x", Label: "x", Type: "text"}},
	}, "t1", "admin")

	all, _ := svc.ListForms(context.Background(), "t1", "", "")
	if len(all) != 2 {
		t.Errorf("ListForms() = %d, want 2", len(all))
	}

	filtered, _ := svc.ListForms(context.Background(), "t1", "auth", "")
	if len(filtered) != 1 {
		t.Errorf("ListForms(category=auth) = %d, want 1", len(filtered))
	}
}

func TestUpdateForm_updatesFields(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)

	fd, _ := svc.CreateForm(context.Background(), &models.CreateFormRequest{
		Name: "old",
		Fields: []models.FormField{{Key: "x", Label: "x", Type: "text"}},
	}, "t1", "admin")

	newTitle := "New Title"
	updated, err := svc.UpdateForm(context.Background(), fd.ID, "t1", "editor", &models.UpdateFormRequest{
		Title: &newTitle,
	})
	if err != nil {
		t.Fatalf("UpdateForm error: %v", err)
	}
	if updated.Title != "New Title" {
		t.Errorf("Title = %q, want New Title", updated.Title)
	}
}

func TestDeleteForm(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)

	fd, _ := svc.CreateForm(context.Background(), &models.CreateFormRequest{
		Name: "del",
		Fields: []models.FormField{{Key: "x", Label: "x", Type: "text"}},
	}, "t1", "admin")

	deleted, _ := svc.DeleteForm(context.Background(), fd.ID, "t1")
	if !deleted {
		t.Error("DeleteForm should return true")
	}

	_, err := svc.GetForm(context.Background(), fd.ID, "t1")
	if !errors.Is(err, errNotFound) {
		t.Error("GetForm after delete should error")
	}
}

func TestCreateField_setsSortableIndex(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)

	fd, _ := svc.CreateForm(context.Background(), &models.CreateFormRequest{
		Name: "f",
		Fields: []models.FormField{{Key: "x", Label: "x", Type: "text"}},
	}, "t1", "admin")

	field, err := svc.CreateField(context.Background(), fd.ID, "t1", &models.CreateFieldRequest{
		Key:   "new-field",
		Label: "New",
		Type:  "text",
	})
	if err != nil {
		t.Fatalf("CreateField error: %v", err)
	}
	if field.SortableIndex != 1 {
		t.Errorf("SortableIndex = %d, want 1 (max+1)", field.SortableIndex)
	}
}

func TestGetFieldsByForm_returnsEmptySlice(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)

	fields, err := svc.GetFieldsByForm(context.Background(), "empty-form", "t1")
	if err != nil {
		t.Fatalf("GetFieldsByForm error: %v", err)
	}
	if len(fields) != 0 {
		t.Errorf("fields = %d, want 0", len(fields))
	}
}

func TestSubmitInstance_createsInstance(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)

	inst, err := svc.SubmitInstance(context.Background(), "form-1", "t1", &models.SubmitInstanceRequest{
		Data:     map[string]interface{}{"key": "value"},
		SubmitBy: "user-1",
	})
	if err != nil {
		t.Fatalf("SubmitInstance error: %v", err)
	}
	if inst.Status != "submitted" {
		t.Errorf("Status = %q, want submitted", inst.Status)
	}
	if inst.SubmittedBy != "user-1" {
		t.Errorf("SubmittedBy = %q, want user-1", inst.SubmittedBy)
	}
}

func TestApproveInstance(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)

	inst, _ := svc.SubmitInstance(context.Background(), "form-1", "t1", &models.SubmitInstanceRequest{
		Data:     map[string]interface{}{"x": 1},
		SubmitBy: "user-1",
	})

	approved, err := svc.ApproveInstance(context.Background(), inst.ID, "t1", &models.ApproveInstanceRequest{
		Approver: "manager",
		Action:   "approve",
	})
	if err != nil {
		t.Fatalf("ApproveInstance error: %v", err)
	}
	if approved.Status != "approved" {
		t.Errorf("Status = %q, want approved", approved.Status)
	}
	if approved.ApprovedBy != "manager" {
		t.Errorf("ApprovedBy = %q, want manager", approved.ApprovedBy)
	}
}

func TestApproveInstance_reject(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)

	inst, _ := svc.SubmitInstance(context.Background(), "form-1", "t1", &models.SubmitInstanceRequest{
		Data:     map[string]interface{}{"x": 1},
		SubmitBy: "user-1",
	})

	rejected, err := svc.ApproveInstance(context.Background(), inst.ID, "t1", &models.ApproveInstanceRequest{
		Approver: "manager",
		Action:   "reject",
	})
	if err != nil {
		t.Fatalf("ApproveInstance error: %v", err)
	}
	if rejected.Status != "rejected" {
		t.Errorf("Status = %q, want rejected", rejected.Status)
	}
}

func TestCreateComponent(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)

	c, err := svc.CreateComponent(context.Background(), "t1", "btn", "Button", "ui", "1.0.0",
		map[string]interface{}{"label": "string"},
		map[string]interface{}{"label": "Click"},
		"button",
	)
	if err != nil {
		t.Fatalf("CreateComponent error: %v", err)
	}
	if c.DisplayName != "Button" {
		t.Errorf("DisplayName = %q, want Button", c.DisplayName)
	}
	if c.Version != "1.0.0" {
		t.Errorf("Version = %q, want 1.0.0", c.Version)
	}
}

func TestCreateTemplate(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)

	tmpl, err := svc.CreateTemplate(context.Background(), "t1", "login-form", "Login template", "auth",
		map[string]interface{}{"fields": []interface{}{"email", "password"}},
	)
	if err != nil {
		t.Fatalf("CreateTemplate error: %v", err)
	}
	if tmpl.Name != "login-form" {
		t.Errorf("Name = %q, want login-form", tmpl.Name)
	}
	if tmpl.FormSchemaData == nil {
		t.Error("FormSchemaData should not be nil")
	}
}

func TestListTemplates_filtered(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)

	svc.CreateTemplate(context.Background(), "t1", "a", "", "auth", nil)
	svc.CreateTemplate(context.Background(), "t1", "b", "", "billing", nil)

	all, _ := svc.ListTemplates(context.Background(), "t1", "")
	if len(all) != 2 {
		t.Errorf("ListTemplates = %d, want 2", len(all))
	}

	filtered, _ := svc.ListTemplates(context.Background(), "t1", "auth")
	if len(filtered) != 1 {
		t.Errorf("ListTemplates(auth) = %d, want 1", len(filtered))
	}
}