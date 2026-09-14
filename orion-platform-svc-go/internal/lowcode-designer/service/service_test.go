package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/lowcode-designer/models"
)

var errNotFound = errors.New("not found")

// --- Fake Repository ---

type fakeDesignerRepo struct {
	forms     map[string]*models.FormDefinition
	fields    map[string]*models.FormField
	tmpls     map[string]*models.FormTemplate
	instances map[string]*models.FormInstance
	comps     map[string]*models.ComponentRegistry

	// The hooks below let a test force the one failure the service must not
	// swallow. Without them an error-path test could only assert err != nil,
	// which sqlmock's no-expectation error satisfies just as well.
	createFieldErr      error
	listFieldsErr       error
	updateInstanceCalls int
	lastFieldAttrs      map[string]interface{}
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
	if f.createFieldErr != nil {
		return f.createFieldErr
	}
	f.fields[ff.ID] = ff
	return nil
}

func (f *fakeDesignerRepo) UpdateField(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.FormField, error) {
	ff, ok := f.fields[id]
	if !ok || ff.TenantID != tenantID {
		return nil, errNotFound
	}
	// Recorded so a test can assert which attributes the service actually sent:
	// an omitted attribute must not reach the write path at all.
	f.lastFieldAttrs = attrs
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
	if f.listFieldsErr != nil {
		return nil, f.listFieldsErr
	}
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

func (f *fakeDesignerRepo) GetTemplate(ctx context.Context, id, tenantID string) (*models.FormTemplate, error) {
	t, ok := f.tmpls[id]
	if !ok {
		return nil, errNotFound
	}
	if t.TenantID != tenantID {
		return nil, errNotFound
	}
	return t, nil
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
	if inst.TenantID != tenantID {
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
	f.updateInstanceCalls++
	inst, ok := f.instances[id]
	if !ok || inst.TenantID != tenantID {
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

func (f *fakeDesignerRepo) GetComponent(ctx context.Context, id, tenantID string) (*models.ComponentRegistry, error) {
	c, ok := f.comps[id]
	if !ok {
		return nil, errNotFound
	}
	if c.TenantID != tenantID {
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
		Name:   "old",
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
		Name:   "del",
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
		Name:   "f",
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

func TestApproveInstanceRejectsAnUnknownAction(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)
	inst, _ := svc.SubmitInstance(context.Background(), "form-1", "t1", &models.SubmitInstanceRequest{
		Data: map[string]interface{}{"x": 1}, SubmitBy: "user-1",
	})

	got, err := svc.ApproveInstance(context.Background(), inst.ID, "t1",
		&models.ApproveInstanceRequest{Approver: "manager", Action: "escalate"})
	if err == nil {
		t.Fatalf("ApproveInstance accepted an action the workflow does not know")
	}
	if !errors.Is(err, ErrInvalidAction) {
		t.Fatalf("error %q is not ErrInvalidAction", err)
	}
	if got != nil {
		t.Fatalf("ApproveInstance returned %v for an invalid action", got)
	}
	if repo.updateInstanceCalls != 0 {
		t.Fatalf("an invalid action still wrote the instance %d times", repo.updateInstanceCalls)
	}
}

// A field insert failure must reach the caller. Before the error was propagated,
// POST /forms answered 201 for a form whose fields never landed.
func TestCreateFormReportsAFieldInsertFailure(t *testing.T) {
	repo := newFakeDesignerRepo()
	repo.createFieldErr = errors.New("duplicate key value violates unique constraint")
	svc := NewService(repo)

	req := &models.CreateFormRequest{
		Name:   "burst",
		Fields: []models.FormField{{Key: "email", Label: "Email", Type: "text"}},
	}
	got, err := svc.CreateForm(context.Background(), req, "t1", "admin")
	if err == nil {
		t.Fatalf("CreateForm succeeded although the field insert failed")
	}
	if !errors.Is(err, repo.createFieldErr) {
		t.Fatalf("error %q does not wrap the repository failure", err)
	}
	if !strings.Contains(err.Error(), `field "email"`) {
		t.Fatalf("error %q does not name the field that failed", err)
	}
	if got != nil {
		t.Fatalf("CreateForm returned %v for a failed insert", got)
	}
}

// A failed field lookup must not look like an empty form: folding the error
// into zero reset the sort position to one and collided with an existing row.
func TestCreateFieldReportsAFieldLookupFailure(t *testing.T) {
	repo := newFakeDesignerRepo()
	repo.listFieldsErr = errors.New("relation form_field does not exist")
	svc := NewService(repo)

	got, err := svc.CreateField(context.Background(), "form-1", "t1", &models.CreateFieldRequest{
		Key: "email", Label: "Email", Type: "text",
	})
	if err == nil {
		t.Fatalf("CreateField succeeded although the lookup failed")
	}
	if !errors.Is(err, repo.listFieldsErr) {
		t.Fatalf("error %q does not wrap the repository failure", err)
	}
	if !strings.Contains(err.Error(), "counting fields of form form-1") {
		t.Fatalf("error %q does not name the failing lookup", err)
	}
	if got != nil {
		t.Fatalf("CreateField returned %v for a failed lookup", got)
	}
}

func TestCreateFieldDefaultsVisibleToTrue(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)
	fd, _ := svc.CreateForm(context.Background(), &models.CreateFormRequest{
		Name: "f", Fields: []models.FormField{{Key: "x", Label: "x", Type: "text"}},
	}, "t1", "admin")

	field, err := svc.CreateField(context.Background(), fd.ID, "t1", &models.CreateFieldRequest{
		Key: "email", Label: "Email", Type: "text",
	})
	if err != nil {
		t.Fatalf("CreateField: %v", err)
	}
	// form_field.visible is NOT NULL DEFAULT 1 and the INSERT names the column,
	// so the default never applies: every created field came back hidden.
	if !field.Visible {
		t.Fatalf("a created field defaulted to invisible: %+v", field)
	}
	hidden := false
	field2, err := svc.CreateField(context.Background(), fd.ID, "t1", &models.CreateFieldRequest{
		Key: "opt", Label: "Optional", Type: "text", Visible: &hidden,
	})
	if err != nil {
		t.Fatalf("CreateField: %v", err)
	}
	if field2.Visible {
		t.Fatalf("an explicit false was ignored: %+v", field2)
	}
}

// PUT /fields/:id must not write the zero value of an attribute the caller left
// out: that is what cleared placeholder, visibility and sort position at once.
func TestUpdateFieldLeavesOmittedAttributesAlone(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)
	fd, _ := svc.CreateForm(context.Background(), &models.CreateFormRequest{
		Name: "f", Fields: []models.FormField{{Key: "x", Label: "x", Type: "text"}},
	}, "t1", "admin")
	field, _ := svc.CreateField(context.Background(), fd.ID, "t1", &models.CreateFieldRequest{
		Key: "email", Label: "Email", Type: "text", Placeholder: "you@x",
	})

	label := "E-mail"
	updated, err := svc.UpdateField(context.Background(), field.ID, "t1",
		&models.UpdateFieldRequest{Label: &label})
	if err != nil {
		t.Fatalf("UpdateField: %v", err)
	}
	if updated.Label != "E-mail" {
		t.Fatalf("Label = %q, want E-mail", updated.Label)
	}
	if got := len(repo.lastFieldAttrs); got != 1 {
		t.Fatalf("the service sent %d attributes for one changed field: %v", got, repo.lastFieldAttrs)
	}
	for _, key := range []string{"placeholder", "required", "visible", "disabled", "sortable_index"} {
		if _, ok := repo.lastFieldAttrs[key]; ok {
			t.Errorf("the omitted attribute %q reached the write path: %v", key, repo.lastFieldAttrs)
		}
	}
	// The read-back must still show the values the request did not touch.
	reloaded, err := svc.GetFieldsByForm(context.Background(), fd.ID, "t1")
	if err != nil {
		t.Fatalf("GetFieldsByForm: %v", err)
	}
	if len(reloaded) != 2 {
		t.Fatalf("the form lost a field: %+v", reloaded)
	}
	// The placeholder is the attribute the previous code cleared: it put the
	// zero value of every attribute the request did not send into the SET clause.
	for i := range reloaded {
		if reloaded[i].Key == "email" && reloaded[i].Placeholder != "you@x" {
			t.Fatalf("the omitted placeholder was cleared to %q", reloaded[i].Placeholder)
		}
	}
}

func TestUpdateFieldWrapsEveryAttributeItIsGiven(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)
	fd, _ := svc.CreateForm(context.Background(), &models.CreateFormRequest{
		Name: "f", Fields: []models.FormField{{Key: "x", Label: "x", Type: "text"}},
	}, "t1", "admin")
	field, _ := svc.CreateField(context.Background(), fd.ID, "t1", &models.CreateFieldRequest{
		Key: "email", Label: "Email", Type: "text",
	})

	label, typ, parent := "E-mail", "select", "section"
	required, visible, disabled := false, false, false
	sortIdx := 9
	_, err := svc.UpdateField(context.Background(), field.ID, "t1", &models.UpdateFieldRequest{
		Label: &label, Type: &typ, Required: &required, Visible: &visible,
		Disabled: &disabled, SortableIndex: &sortIdx, ParentKey: &parent,
		Options: []interface{}{"a", "b"}, Rules: []interface{}{map[string]interface{}{"min": 1}},
		Meta: map[string]interface{}{"hint": 1}, LayoutConfig: map[string]interface{}{"col": 2},
		DefaultVal: map[string]interface{}{"hex": "#000"},
	})
	if err != nil {
		t.Fatalf("UpdateField: %v", err)
	}
	want := map[string]bool{
		"label": true, "type": true, "required": true, "visible": true,
		"disabled": true, "sortable_index": true, "parent_key": true,
		"options": true, "rules": true, "meta": true, "layout_config": true,
		"default_val": true,
	}
	if len(repo.lastFieldAttrs) != len(want) {
		t.Fatalf("the service sent %d attributes, want %d: %v", len(repo.lastFieldAttrs), len(want), repo.lastFieldAttrs)
	}
	for key := range want {
		if _, ok := repo.lastFieldAttrs[key]; !ok {
			t.Errorf("attribute %q was not forwarded: %v", key, repo.lastFieldAttrs)
		}
	}
	// Identity and the form link are never updatable.
	for _, key := range []string{"id", "tenant_id", "form_id", "key", "created_at", "updated_at"} {
		if _, ok := repo.lastFieldAttrs[key]; ok {
			t.Errorf("attribute %q reached the write path: %v", key, repo.lastFieldAttrs)
		}
	}
}

func TestGetTemplateFiltersByTenant(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)
	repo.tmpls["ft-1"] = &models.FormTemplate{ID: "ft-1", TenantID: "t1", Name: "tpl"}

	if _, err := svc.GetTemplate(context.Background(), "ft-1", "t-other"); !errors.Is(err, errNotFound) {
		t.Fatalf("another tenant's template was returned: err = %v", err)
	}
	got, err := svc.GetTemplate(context.Background(), "ft-1", "t1")
	if err != nil {
		t.Fatalf("GetTemplate: %v", err)
	}
	if got.Name != "tpl" {
		t.Fatalf("unexpected template: %+v", got)
	}
}

func TestGetComponentFiltersByTenant(t *testing.T) {
	repo := newFakeDesignerRepo()
	svc := NewService(repo)
	repo.comps["cr-1"] = &models.ComponentRegistry{ID: "cr-1", TenantID: "t1", Name: "btn"}

	got, err := svc.GetComponent(context.Background(), "cr-1", "t-other")
	if err == nil {
		t.Fatalf("another tenant's component was returned: %+v", got)
	}
	if !errors.Is(err, errNotFound) {
		t.Fatalf("error %v is not the tenant boundary", err)
	}
	got, err = svc.GetComponent(context.Background(), "cr-1", "t1")
	if err != nil {
		t.Fatalf("GetComponent: %v", err)
	}
	if got.Name != "btn" {
		t.Fatalf("unexpected component: %+v", got)
	}
}

func TestSubmitInstanceNoLongerTouchesTheTemplateUsageCount(t *testing.T) {
	// The deleted UpdateTemplateUsage call passed a form id to a method that
	// keyed form_template by template id, so it always updated zero rows and
	// silently discarded the result. 396 has no template_id column anywhere, so
	// the attribution is unimplementable and the method is gone.
	repo := newFakeDesignerRepo()
	svc := NewService(repo)
	repo.tmpls["ft-1"] = &models.FormTemplate{ID: "ft-1", TenantID: "t1", Name: "tpl", UsageCount: 0}

	if _, err := svc.SubmitInstance(context.Background(), "form-1", "t1",
		&models.SubmitInstanceRequest{Data: map[string]interface{}{"x": 1}, SubmitBy: "u-1"}); err != nil {
		t.Fatalf("SubmitInstance: %v", err)
	}
	if repo.tmpls["ft-1"].UsageCount != 0 {
		t.Fatalf("the usage count changed without a template_id link: %d", repo.tmpls["ft-1"].UsageCount)
	}
}

func TestNewIDFitsThePrimaryKeyAndDoesNotCollide(t *testing.T) {
	// The primary keys are VARCHAR(36) and uuid.New().String() is exactly 36.
	// The previous implementation capped its entropy at 32 bits per second, so a
	// burst of creations in one second collided.
	seen := make(map[string]bool, 4096)
	for i := 0; i < 4096; i++ {
		id := newID()
		if len(id) != 36 {
			t.Fatalf("id %q is %d characters, the key column allows 36", id, len(id))
		}
		if seen[id] {
			t.Fatalf("newID produced a duplicate: %s", id)
		}
		seen[id] = true
	}
}
