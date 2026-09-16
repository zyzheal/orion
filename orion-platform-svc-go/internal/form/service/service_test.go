package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/form/models"

	"go.uber.org/zap"
)

// fakeRepo is an in-memory RepositoryInterface that applies the real column
// rules of internal/form/repository. It stores whatever the engine handed it
// rather than what the engine asked for, which is what makes a CreateForm test
// able to catch a dropped field.
type fakeRepo struct {
	forms         map[string]*models.FormDefinition
	formFields    map[string][]models.FormField
	submissions   map[string]*models.FormSubmission
	submissionLog []submissionCall
	createErr     error
	submissionErr error
}

type submissionCall struct {
	tenantID    string
	formID      string
	submittedBy string
	dataJSON    string
	status      string
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		forms:       map[string]*models.FormDefinition{},
		formFields:  map[string][]models.FormField{},
		submissions: map[string]*models.FormSubmission{},
	}
}

// Compile-time proof that the fake covers the whole interface. Adding a method
// to RepositoryInterface must break this test instead of silently compiling.
var _ RepositoryInterface = (*fakeRepo)(nil)

func (r *fakeRepo) CreateForm(ctx context.Context, tenantID string, req models.CreateFormRequest, layoutJSON, fieldsJSON string) (*models.FormDefinition, error) {
	if r.createErr != nil {
		return nil, r.createErr
	}
	now := time.Now().UTC()
	form := &models.FormDefinition{
		ID:          "form-1",
		TenantID:    tenantID,
		Name:        req.Name,
		Code:        req.Code,
		Category:    req.Category,
		Description: req.Description,
		Layout:      layoutJSON,
		Fields:      fieldsJSON,
		Status:      "draft",
		Version:     1,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	r.forms[form.ID] = form
	return form, nil
}

func (r *fakeRepo) GetFormByID(ctx context.Context, tenantID, id string) (*models.FormDefinition, error) {
	form, ok := r.forms[id]
	if !ok || form.TenantID != tenantID {
		return nil, sentinel.NotFound
	}
	return form, nil
}

func (r *fakeRepo) GetFormByCode(ctx context.Context, tenantID, code string) (*models.FormDefinition, error) {
	for _, form := range r.forms {
		if form.TenantID == tenantID && form.Code == code && form.Status == "active" {
			return form, nil
		}
	}
	return nil, sentinel.NotFound
}

func (r *fakeRepo) ListForms(ctx context.Context, tenantID, category string) ([]models.FormDefinition, error) {
	out := make([]models.FormDefinition, 0)
	for _, form := range r.forms {
		if form.TenantID != tenantID {
			continue
		}
		if category != "" && form.Category != category {
			continue
		}
		out = append(out, *form)
	}
	return out, nil
}

func (r *fakeRepo) UpdateForm(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.FormDefinition, error) {
	form, ok := r.forms[id]
	if !ok || form.TenantID != tenantID {
		return nil, sentinel.NotFound
	}
	if v, ok := updates["name"]; ok {
		form.Name = v.(string)
	}
	if v, ok := updates["category"]; ok {
		form.Category = v.(string)
	}
	if v, ok := updates["description"]; ok {
		form.Description = v.(string)
	}
	if v, ok := updates["status"]; ok {
		form.Status = v.(string)
	}
	if v, ok := updates["layout"]; ok {
		form.Layout = v.(string)
	}
	if v, ok := updates["fields"]; ok {
		form.Fields = v.(string)
	}
	return form, nil
}

func (r *fakeRepo) DeleteForm(ctx context.Context, tenantID, id string) error {
	if _, ok := r.forms[id]; !ok {
		return sentinel.NotFound
	}
	delete(r.forms, id)
	return nil
}

func (r *fakeRepo) CreateFormField(ctx context.Context, tenantID string, formID string, field models.FormField) error {
	if _, ok := r.forms[formID]; !ok {
		return sentinel.NotFound
	}
	field.ID = "field-row-1"
	field.FormID = formID
	r.formFields[formID] = append(r.formFields[formID], field)
	return nil
}

func (r *fakeRepo) ListFieldsByFormID(ctx context.Context, tenantID, formID string) ([]models.FormField, error) {
	return r.formFields[formID], nil
}

func (r *fakeRepo) UpdateFormField(ctx context.Context, tenantID string, formID string, updates map[string]interface{}) (*models.FormField, error) {
	return nil, sentinel.NotFound
}

func (r *fakeRepo) DeleteFormField(ctx context.Context, tenantID, formID, fieldID string) error {
	return sentinel.NotFound
}

func (r *fakeRepo) CreateSubmission(ctx context.Context, tenantID, formID, submittedBy string, dataJSON, status string) (*models.FormSubmission, error) {
	if r.submissionErr != nil {
		return nil, r.submissionErr
	}
	now := time.Now().UTC()
	sub := &models.FormSubmission{
		ID:          "sub-1",
		TenantID:    tenantID,
		FormID:      formID,
		Data:        dataJSON,
		SubmittedBy: submittedBy,
		Status:      status,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	r.submissions[sub.ID] = sub
	r.submissionLog = append(r.submissionLog, submissionCall{
		tenantID: tenantID, formID: formID, submittedBy: submittedBy,
		dataJSON: dataJSON, status: status,
	})
	return sub, nil
}

func (r *fakeRepo) GetSubmission(ctx context.Context, tenantID, id string) (*models.FormSubmission, error) {
	sub, ok := r.submissions[id]
	if !ok || sub.TenantID != tenantID {
		return nil, sentinel.NotFound
	}
	return sub, nil
}

func (r *fakeRepo) ListSubmissions(ctx context.Context, tenantID, formID string) ([]models.FormSubmission, error) {
	out := make([]models.FormSubmission, 0)
	for _, sub := range r.submissions {
		if sub.TenantID == tenantID && sub.FormID == formID {
			out = append(out, *sub)
		}
	}
	return out, nil
}

func (r *fakeRepo) UpdateSubmissionStatus(ctx context.Context, tenantID, id, status string) (*models.FormSubmission, error) {
	sub, ok := r.submissions[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	sub.Status = status
	return sub, nil
}

// newEngine wires a real engine to a fake repository. zap.NewNop(), never nil:
// the engine logs unconditionally and a nil *zap.Logger panics.
func newEngine(repo *fakeRepo) *FormEngine {
	return NewFormEngine(repo, zap.NewNop())
}

func mustForm(t *testing.T, repo *fakeRepo) *models.FormDefinition {
	t.Helper()
	form, err := repo.GetFormByID(context.Background(), "t1", "form-1")
	if err != nil {
		t.Fatalf("created form not retrievable: %v", err)
	}
	return form
}

// TestCreateFormPersistsFieldsAndDescription is the regression for POST /forms
// writing "{}" to forms.fields and "" to forms.description on every request.
// Both columns are asserted against the engine's own input, so a mutant that
// drops either field fails here and not at submission time.
func TestCreateFormPersistsFieldsAndDescription(t *testing.T) {
	repo := newFakeRepo()
	e := newEngine(repo)

	fields := `[{"field_id":"name","label":"Name","type":"text","required":true},` +
		`{"field_id":"age","label":"Age","type":"number","required":false}]`
	req := &models.CreateFormRequest{
		Name:        "Employee Onboarding",
		Code:        "hr-onboarding",
		Category:    "hr",
		Description: "collected at first login",
		Layout:      map[string]interface{}{"columns": 2},
		Fields:      mustFieldSlice(t, fields),
	}

	form, err := e.CreateForm(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("CreateForm: %v", err)
	}
	if form == nil {
		t.Fatal("CreateForm returned (nil, nil)")
	}

	if got, want := form.Description, "collected at first login"; got != want {
		t.Errorf("Description = %q, want %q: the engine hardcoded it to empty", got, want)
	}
	if got, want := form.Fields, `[{"field_id":"name","label":"Name","required":true,"type":"text"},`+
		`{"field_id":"age","label":"Age","required":false,"type":"number"}]`; got != want {
		t.Errorf("Fields = %q\nwant %q\nthe nil-fields mutant writes %q", got, want, "{}")
	}
	if got, want := form.Layout, `{"columns":2}`; got != want {
		t.Errorf("Layout = %q, want %q", got, want)
	}
	if form.TenantID != "t1" {
		t.Errorf("TenantID = %q, want %q", form.TenantID, "t1")
	}
	if form.Code != "hr-onboarding" || form.Name != "Employee Onboarding" || form.Category != "hr" {
		t.Errorf("header fields dropped: %+v", form)
	}
}

// TestCreateFormSerializesEmptyFieldsAsAnEmptyArray pins the shape invariant
// of forms.fields: it is a JSON array, never an object. marshalJSON returns "{}"
// for an empty or nil slice, which is exactly what the old path wrote.
func TestCreateFormSerializesEmptyFieldsAsAnEmptyArray(t *testing.T) {
	repo := newFakeRepo()
	e := newEngine(repo)

	form, err := e.CreateForm(context.Background(), "t1", &models.CreateFormRequest{
		Name:     "Empty Form",
		Code:     "empty",
		Category: "misc",
		Fields:   []map[string]interface{}{},
	})
	if err != nil {
		t.Fatalf("CreateForm: %v", err)
	}
	if got, want := form.Fields, "[]"; got != want {
		t.Errorf("empty fields serialized as %q, want %q", got, want)
	}
	if got, want := form.Layout, "{}"; got != want {
		t.Errorf("nil layout serialized as %q, want %q", got, want)
	}
	// The invariant that matters: an empty-but-well-shaped form still validates.
	if err := e.ValidateSubmission(map[string]interface{}{}, form); err != nil {
		t.Errorf("ValidateSubmission on %q failed: %v", form.Fields, err)
	}
}

// TestCreateFormSerializesNilFieldsAsAnEmptyArray covers the nil case, which is
// the only one that separates marshalFieldSlice from json.Marshal.
//
// json.Marshal of an empty but non-nil slice is "[]" -- identical to the guard's
// output -- so the empty-slice arm above would pass with the guard deleted.
// json.Marshal of a nil slice is "null", and a "null" forms.fields column breaks
// ValidateSubmission and SubmissionDraft, both of which unmarshal it into
// []FormFieldRaw. The mutation run caught this: that mutant survived until this
// arm existed.
func TestCreateFormSerializesNilFieldsAsAnEmptyArray(t *testing.T) {
	repo := newFakeRepo()
	e := newEngine(repo)

	var fields []map[string]interface{}
	form, err := e.CreateForm(context.Background(), "t1", &models.CreateFormRequest{
		Name:     "Nil Form",
		Code:     "nil-fields",
		Category: "misc",
		Fields:   fields,
	})
	if err != nil {
		t.Fatalf("CreateForm: %v", err)
	}
	if got, want := form.Fields, "[]"; got != want {
		t.Errorf("nil fields serialized as %q, want %q", got, want)
	}
	if err := e.ValidateSubmission(map[string]interface{}{}, form); err != nil {
		t.Errorf("ValidateSubmission on %q failed: %v", form.Fields, err)
	}
}

// TestCreateFormPropagatesRepositoryError pins the failure contract: a
// non-nil error comes with a nil response.
func TestCreateFormPropagatesRepositoryError(t *testing.T) {
	repo := newFakeRepo()
	repo.createErr = errors.New("duplicate code")
	e := newEngine(repo)

	form, err := e.CreateForm(context.Background(), "t1", &models.CreateFormRequest{
		Name: "X", Code: "x", Category: "c",
		Fields: []map[string]interface{}{{"field_id": "a", "name": "a"}},
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if form != nil {
		t.Errorf("expected nil form on error, got %+v", form)
	}
	if got, want := err.Error(), "duplicate code"; got != want {
		t.Errorf("error = %q, want %q", got, want)
	}
}

// TestSubmitFormAcceptsCompleteDataForACreatedForm is the end-to-end proof that
// a form created through CreateForm can be submitted. Before the fix the fields
// column held "{}", so this call returned sentinel.BadRequest and never reached
// the repository.
func TestSubmitFormAcceptsCompleteDataForACreatedForm(t *testing.T) {
	repo := newFakeRepo()
	e := newEngine(repo)

	created, err := e.CreateForm(context.Background(), "t1", &models.CreateFormRequest{
		Name: "Onboarding", Code: "onboarding", Category: "hr",
		// The shape api/forms.ts actually sends: name, not field_id, and no
		// visible key.
		Fields: mustFieldSlice(t, `[{"name":"name","label":"Name","type":"text","required":true},`+
			`{"name":"age","label":"Age","type":"number","required":false}]`),
	})
	if err != nil {
		t.Fatalf("CreateForm: %v", err)
	}

	sub, err := e.SubmitForm(context.Background(), "t1", created.ID, "user-1",
		map[string]interface{}{"name": "Ada", "age": 30})
	if err != nil {
		t.Fatalf("SubmitForm: %v", err)
	}
	if sub == nil {
		t.Fatal("SubmitForm returned (nil, nil)")
	}
	if sub.Status != "submitted" {
		t.Errorf("Status = %q, want %q", sub.Status, "submitted")
	}
	if sub.SubmittedBy != "user-1" {
		t.Errorf("SubmittedBy = %q, want %q", sub.SubmittedBy, "user-1")
	}
	if got, want := sub.Data, `{"age":30,"name":"Ada"}`; got != want {
		t.Errorf("Data = %q, want %q", got, want)
	}
	if len(repo.submissionLog) != 1 {
		t.Fatalf("repository calls = %d, want 1", len(repo.submissionLog))
	}
	if got := repo.submissionLog[0].dataJSON; got != `{"age":30,"name":"Ada"}` {
		t.Errorf("stored dataJSON = %q, want %q", got, `{"age":30,"name":"Ada"}`)
	}
}

// TestSubmitFormRejectsMissingRequiredField is the arm that proves the
// acceptance test above is not vacuous: the validator does refuse incomplete
// data. A rejected submission must not reach the repository.
func TestSubmitFormRejectsMissingRequiredField(t *testing.T) {
	repo := newFakeRepo()
	e := newEngine(repo)

	created, err := e.CreateForm(context.Background(), "t1", &models.CreateFormRequest{
		Name: "Onboarding", Code: "onboarding", Category: "hr",
		Fields: mustFieldSlice(t, `[{"name":"name","label":"Name","required":true}]`),
	})
	if err != nil {
		t.Fatalf("CreateForm: %v", err)
	}

	sub, err := e.SubmitForm(context.Background(), "t1", created.ID, "user-1",
		map[string]interface{}{})
	if err == nil {
		t.Fatal("expected validation error, got nil")
	}
	if sub != nil {
		t.Errorf("expected nil submission on validation failure, got %+v", sub)
	}
	if want := "field name is required"; !contains(err.Error(), want) {
		t.Errorf("error = %q, want it to contain %q", err.Error(), want)
	}
	if len(repo.submissionLog) != 0 {
		t.Errorf("rejected submission reached the repository: %+v", repo.submissionLog)
	}
}

// TestSubmitFormRejectsMalformedFieldsColumn is the control for the whole pair:
// a form whose fields column is an object instead of an array must be refused.
// Without it, TestSubmitFormAcceptsCompleteDataForACreatedForm could pass with a
// validator that accepted anything.
func TestSubmitFormRejectsMalformedFieldsColumn(t *testing.T) {
	repo := newFakeRepo()
	repo.forms["form-1"] = &models.FormDefinition{
		ID: "form-1", TenantID: "t1", Code: "broken",
		Fields: "{}", Status: "active", Version: 1,
	}
	e := newEngine(repo)

	sub, err := e.SubmitForm(context.Background(), "t1", "form-1", "user-1",
		map[string]interface{}{"name": "Ada"})
	if err == nil {
		t.Fatal("expected error for an object-typed fields column, got nil")
	}
	if sub != nil {
		t.Errorf("expected nil submission, got %+v", sub)
	}
	if !errors.Is(err, sentinel.BadRequest) {
		t.Errorf("error = %v, want sentinel.BadRequest", err)
	}
	if len(repo.submissionLog) != 0 {
		t.Errorf("rejected submission reached the repository: %+v", repo.submissionLog)
	}
}

// TestSubmitFormRejectsUnidentifiableField is the regression for the panic.
// f["field_id"].(string) on a field without that key panicked with
// "interface conversion: interface {} is nil, not string", which is what a form
// created from the frontend's documented shape produced on every submit.
func TestSubmitFormRejectsUnidentifiableField(t *testing.T) {
	repo := newFakeRepo()
	repo.forms["form-1"] = &models.FormDefinition{
		ID: "form-1", TenantID: "t1", Code: "junk",
		Fields: `[{"label":"Name","type":"text","required":true}]`,
		Status: "active", Version: 1,
	}
	e := newEngine(repo)

	sub, err := e.SubmitForm(context.Background(), "t1", "form-1", "user-1",
		map[string]interface{}{"label": "Ada"})
	if err == nil {
		t.Fatal("expected error for an unidentifiable field, got nil")
	}
	if sub != nil {
		t.Errorf("expected nil submission, got %+v", sub)
	}
	if !errors.Is(err, sentinel.BadRequest) {
		t.Errorf("error = %v, want sentinel.BadRequest", err)
	}
}

// TestValidateSubmissionEnforcesRequiredWhenVisibleIsOmitted is the regression
// for the silent skip. form_fields.visible defaults to TRUE in the DDL, so a
// field the client never marked visible is visible. The old _ := read defaulted
// it to false and skipped the required check entirely.
func TestValidateSubmissionEnforcesRequiredWhenVisibleIsOmitted(t *testing.T) {
	e := newEngine(newFakeRepo())
	form := &models.FormDefinition{
		Fields: `[{"field_id":"name","required":true},{"field_id":"note","required":true}]`,
	}

	if err := e.ValidateSubmission(map[string]interface{}{"name": "Ada"}, form); err == nil {
		t.Error("missing required note was not reported")
	} else if want := "field note is required"; !contains(err.Error(), want) {
		t.Errorf("error = %v, want it to contain %q", err, want)
	}

	// An explicit false still hides the field.
	hidden := &models.FormDefinition{
		Fields: `[{"field_id":"name","required":true,"visible":false}]`,
	}
	if err := e.ValidateSubmission(map[string]interface{}{}, hidden); err != nil {
		t.Errorf("explicitly invisible required field was enforced: %v", err)
	}
}

// TestValidateSubmissionAcceptsTheFrontendFieldShape is the regression for the
// panic in the opposite direction: a field carrying "name" must validate, not
// panic, because that is the key api/forms.ts sends.
func TestValidateSubmissionAcceptsTheFrontendFieldShape(t *testing.T) {
	e := newEngine(newFakeRepo())
	form := &models.FormDefinition{
		Fields: `[{"name":"name","label":"Name","type":"text","required":true}]`,
	}
	if err := e.ValidateSubmission(map[string]interface{}{"name": "Ada"}, form); err != nil {
		t.Errorf("frontend-shaped field rejected: %v", err)
	}
	if err := e.ValidateSubmission(map[string]interface{}{}, form); err == nil {
		t.Error("missing frontend-shaped required field was not reported")
	}
}

// TestSubmissionDraftUsesTheSameKeyTheValidatorChecks keeps draft keys and
// validated keys in step. Resolving field_id alone wrote draft[""] for every
// frontend-shaped field.
func TestSubmissionDraftUsesTheSameKeyTheValidatorChecks(t *testing.T) {
	e := newEngine(newFakeRepo())
	form := &models.FormDefinition{
		Fields: `[{"name":"name","type":"text"},{"name":"age","type":"number"}]`,
	}
	draft := e.SubmissionDraft(form)
	if draft["name"] != "" {
		t.Errorf("draft[name] = %v, want %q", draft["name"], "")
	}
	if draft["age"] != "0" {
		t.Errorf("draft[age] = %v, want %q", draft["age"], "0")
	}
	if _, ok := draft[""]; ok {
		t.Error("draft has an empty-string key; field id resolution failed")
	}
}

// TestUpdateSubmissionStatusRejectsAnUnknownStatus pins the allow-list.
func TestUpdateSubmissionStatusRejectsAnUnknownStatus(t *testing.T) {
	e := newEngine(newFakeRepo())
	sub, err := e.UpdateSubmissionStatus(context.Background(), "t1", "sub-1", "exported")
	if err == nil {
		t.Fatal("expected error for an unknown status, got nil")
	}
	if sub != nil {
		t.Errorf("expected nil submission, got %+v", sub)
	}
	if want := "invalid status: exported"; want != err.Error() {
		t.Errorf("error = %q, want %q", err.Error(), want)
	}
}

func mustFieldSlice(t *testing.T, raw string) []map[string]interface{} {
	t.Helper()
	var out []map[string]interface{}
	if err := jsonUnmarshal(raw, &out); err != nil {
		t.Fatalf("bad fixture %q: %v", raw, err)
	}
	return out
}

func contains(haystack, needle string) bool {
	return strings.Contains(haystack, needle)
}

func jsonUnmarshal(raw string, out *[]map[string]interface{}) error {
	return json.Unmarshal([]byte(raw), out)
}
