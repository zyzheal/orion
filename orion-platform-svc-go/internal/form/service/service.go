package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/form/models"

	"go.uber.org/zap"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateForm(ctx context.Context, tenantID string, req models.CreateFormRequest, layoutJSON, fieldsJSON string) (*models.FormDefinition, error)
	GetFormByID(ctx context.Context, tenantID, id string) (*models.FormDefinition, error)
	GetFormByCode(ctx context.Context, tenantID, code string) (*models.FormDefinition, error)
	ListForms(ctx context.Context, tenantID, category string) ([]models.FormDefinition, error)
	UpdateForm(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.FormDefinition, error)
	DeleteForm(ctx context.Context, tenantID, id string) error

	CreateFormField(ctx context.Context, tenantID string, formID string, field models.FormField) error
	ListFieldsByFormID(ctx context.Context, tenantID, formID string) ([]models.FormField, error)
	UpdateFormField(ctx context.Context, tenantID string, formID string, updates map[string]interface{}) (*models.FormField, error)
	DeleteFormField(ctx context.Context, tenantID, formID, fieldID string) error

	CreateSubmission(ctx context.Context, tenantID, formID, submittedBy string, dataJSON, status string) (*models.FormSubmission, error)
	GetSubmission(ctx context.Context, tenantID, id string) (*models.FormSubmission, error)
	ListSubmissions(ctx context.Context, tenantID, formID string) ([]models.FormSubmission, error)
	UpdateSubmissionStatus(ctx context.Context, tenantID, id, status string) (*models.FormSubmission, error)
}

// FormEngine is the business-logic layer for the Form Engine.
type FormEngine struct {
	repo   RepositoryInterface
	logger *zap.Logger
}

// NewFormEngine creates a new FormEngine.
func NewFormEngine(repo RepositoryInterface, logger *zap.Logger) *FormEngine {
	return &FormEngine{repo: repo, logger: logger}
}

// --- Form CRUD ---

// CreateForm persists a form definition.
//
// The old signature took name/code/category/layout/fields positionally and
// reassembled the request inside the engine with Description hardcoded to "".
// The handler was the only place that knew the body, and it passed a literal
// nil for the fields: POST /forms wrote "{}" to forms.fields and "" to
// forms.description on every request, while CreateFormRequest.Fields carried
// binding:"required" -- the client was forced to send data that was then
// thrown away. forms.fields is a JSON array: ValidateSubmission and
// SubmissionDraft both unmarshal it into []FormFieldRaw, so "{}" made every
// submission of a form created through this route fail validation before a
// single field was checked. Taking the request makes the handler the only copy
// point, the same shape the condition engine settled on.
func (e *FormEngine) CreateForm(ctx context.Context, tenantID string, req *models.CreateFormRequest) (*models.FormDefinition, error) {
	e.logger.Info("CreateForm", zap.String("tenantID", tenantID), zap.String("code", req.Code))

	layoutJSON, err := marshalJSON(req.Layout)
	if err != nil {
		return nil, fmt.Errorf("invalid layout: %w", err)
	}
	fieldsJSON, err := marshalFieldSlice(req.Fields)
	if err != nil {
		return nil, fmt.Errorf("invalid fields: %w", err)
	}

	form, err := e.repo.CreateForm(ctx, tenantID, *req, layoutJSON, fieldsJSON)
	if err != nil {
		return nil, err
	}
	e.logger.Info("Form created", zap.String("id", form.ID), zap.String("code", req.Code))
	return form, nil
}

func (e *FormEngine) GetForm(ctx context.Context, tenantID, code string) (*models.FormDefinition, error) {
	return e.repo.GetFormByCode(ctx, tenantID, code)
}

func (e *FormEngine) GetFormByID(ctx context.Context, tenantID, id string) (*models.FormDefinition, error) {
	return e.repo.GetFormByID(ctx, tenantID, id)
}

func (e *FormEngine) ListForms(ctx context.Context, tenantID, category string) ([]models.FormDefinition, error) {
	return e.repo.ListForms(ctx, tenantID, category)
}

func (e *FormEngine) UpdateForm(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.FormDefinition, error) {
	return e.repo.UpdateForm(ctx, tenantID, id, updates)
}

func (e *FormEngine) DeleteForm(ctx context.Context, tenantID, id string) error {
	return e.repo.DeleteForm(ctx, tenantID, id)
}

// --- FormFields ---

func (e *FormEngine) GetFields(ctx context.Context, tenantID, formID string) ([]models.FormField, error) {
	return e.repo.ListFieldsByFormID(ctx, tenantID, formID)
}

func (e *FormEngine) AddField(ctx context.Context, tenantID, formID string, field models.FormField) ([]models.FormField, error) {
	if err := e.repo.CreateFormField(ctx, tenantID, formID, field); err != nil {
		return nil, err
	}
	return e.repo.ListFieldsByFormID(ctx, tenantID, formID)
}

// --- Submissions ---

func (e *FormEngine) SubmitForm(ctx context.Context, tenantID, formID string, submittedBy string, data map[string]interface{}) (*models.FormSubmission, error) {
	e.logger.Info("SubmitForm", zap.String("tenantID", tenantID), zap.String("formID", formID),
		zap.String("submittedBy", submittedBy))

	form, err := e.repo.GetFormByID(ctx, tenantID, formID)
	if err != nil {
		return nil, err
	}

	if err := e.ValidateSubmission(data, form); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	dataJSON, err := marshalJSON(data)
	if err != nil {
		return nil, fmt.Errorf("invalid data: %w", err)
	}

	sub, err := e.repo.CreateSubmission(ctx, tenantID, formID, submittedBy, dataJSON, "submitted")
	if err != nil {
		return nil, err
	}
	e.logger.Info("Form submitted", zap.String("submissionID", sub.ID))
	return sub, nil
}

func (e *FormEngine) ListSubmissions(ctx context.Context, tenantID, formID string) ([]models.FormSubmission, error) {
	return e.repo.ListSubmissions(ctx, tenantID, formID)
}

func (e *FormEngine) GetSubmission(ctx context.Context, tenantID, id string) (*models.FormSubmission, error) {
	return e.repo.GetSubmission(ctx, tenantID, id)
}

func (e *FormEngine) UpdateSubmissionStatus(ctx context.Context, tenantID, id, status string) (*models.FormSubmission, error) {
	valid := map[string]bool{
		"draft": true, "submitted": true, "approved": true, "rejected": true,
	}
	if !valid[status] {
		return nil, fmt.Errorf("invalid status: %s", status)
	}
	return e.repo.UpdateSubmissionStatus(ctx, tenantID, id, status)
}

// --- Validation ---

// ValidateSubmission validates submitted data against a form definition.
func (e *FormEngine) ValidateSubmission(data map[string]interface{}, form *models.FormDefinition) error {
	var fields []FormFieldRaw
	if err := json.Unmarshal([]byte(form.Fields), &fields); err != nil {
		return sentinel.BadRequest
	}

	errors := []string{}
	for _, f := range fields {
		// The field id is looked up with a comma-ok assertion. The bare
		// f["field_id"].(string) panicked with "interface conversion: interface
		// {} is nil, not string" for every field that did not carry a field_id
		// key -- and the frontend does not send one: api/forms.ts FormField
		// declares name, label, type, required. So POST /forms/{id}/submit
		// panicked on every submission of a form the UI created.
		fieldID, ok := stringField(f, "field_id")
		if !ok {
			// "name" is the key the API contract actually uses.
			fieldID, ok = stringField(f, "name")
		}
		if !ok {
			// An unidentifiable field cannot be matched against the payload, so
			// it cannot be validated. Skipping it would silently bypass the
			// required check, which is the worse failure.
			return sentinel.BadRequest
		}
		required, _ := f["required"].(bool)
		// Missing means visible, matching form_fields.visible's DDL default of
		// TRUE. The old _ := read defaulted a missing key to false, so a field
		// the client never marked visible was skipped and its required check
		// never ran.
		visible, visOK := f["visible"].(bool)
		if visOK && !visible {
			continue
		}
		if required {
			val, ok := data[fieldID]
			if !ok || val == nil || fmt.Sprintf("%v", val) == "" {
				errors = append(errors, fmt.Sprintf("field %s is required", fieldID))
			}
		}
	}
	if len(errors) > 0 {
		return fmt.Errorf("%s", strings.Join(errors, "; "))
	}
	return nil
}

// --- Rendering ---

// RenderForm produces a renderable view of a form including resolved controls.
func (e *FormEngine) RenderForm(ctx context.Context, tenantID, formID string) (*models.RenderFormResponse, error) {
	form, err := e.repo.GetFormByID(ctx, tenantID, formID)
	if err != nil {
		return nil, err
	}
	fields, err := e.repo.ListFieldsByFormID(ctx, tenantID, formID)
	if err != nil {
		return nil, err
	}

	controls := make([]models.FormControl, 0, len(fields))
	for _, f := range fields {
		ctl, err := e.buildFormControl(f)
		if err != nil {
			e.logger.Warn("failed to build control", zap.String("fieldId", f.FieldID), zap.Error(err))
			continue
		}
		controls = append(controls, ctl)
	}

	var layout interface{}
	if form.Layout != "" {
		json.Unmarshal([]byte(form.Layout), &layout)
	}

	return &models.RenderFormResponse{
		Form:     form,
		Fields:   fields,
		Layout:   layout,
		Controls: controls,
	}, nil
}

func (e *FormEngine) buildFormControl(f models.FormField) (models.FormControl, error) {
	ctl := models.FormControl{
		ID:           f.FieldID,
		Label:        f.Label,
		Type:         f.Type,
		PlaceHolder:  f.PlaceHolder,
		Required:     f.Required,
		Visible:      f.Visible,
		ReadOnly:     f.ReadOnly,
		DefaultValue: nil,
		Rules:        nil,
	}
	if f.Options != "" {
		var opts []struct {
			Label    string `json:"label"`
			Value    string `json:"value"`
			Disabled bool   `json:"disabled"`
		}
		if err := json.Unmarshal([]byte(f.Options), &opts); err == nil {
			ctl.Options = make([]models.Option, len(opts))
			for i, o := range opts {
				ctl.Options[i] = models.Option(o)
			}
		}
	}
	if f.DefaultValue != "" {
		ctl.DefaultValue = f.DefaultValue
	}
	if f.Validation != "" {
		var v map[string]interface{}
		if err := json.Unmarshal([]byte(f.Validation), &v); err == nil {
			ctl.Validation = v
			ctl.Rules = extractRules(v)
		}
	}
	return ctl, nil
}

// --- Control type registry (30+ control types) ---

// ControlTypes lists all supported form control types.
func ControlTypes() []string {
	return []string{
		// Basic input
		"text", "number", "email", "password", "textarea",
		// Selection
		"select", "radio", "checkbox", "switch",
		// Structured
		"cascader", "table", "tree-select",
		// Date/time
		"date", "datetime", "time", "date-range",
		// Rich
		"file", "image", "upload",
		// Computed / system
		"formula", "hidden", "computed",
		// Layout
		"divider", "group", "panel", "tab",
		// Rating / score
		"rate", "slider", "color",
		// Reference
		"user-picker", "component-picker", "asset-picker",
		// Specialized
		"ip-address", "code", "markdown",
	}
}

// IsControlTypeValid returns true if the type is a supported control type.
func IsControlTypeValid(t string) bool {
	types := ControlTypes()
	for _, v := range types {
		if v == t {
			return true
		}
	}
	return false
}

// defaultForType returns a sensible default value for a control type.
func defaultForType(t string) string {
	switch t {
	case "text", "textarea", "password", "email", "select", "radio", "date",
		"datetime", "time", "date-range", "cascader", "tree-select", "table",
		"user-picker", "component-picker", "asset-picker", "ip-address",
		"code", "markdown", "formula", "computed", "hidden", "divider",
		"group", "panel", "tab", "file", "image", "upload", "color":
		return ""
	case "number", "slider":
		return "0"
	case "checkbox", "switch", "rate":
		return "false"
	default:
		return ""
	}
}

// extractRules extracts human-readable rule strings from a validation map.
func extractRules(v map[string]interface{}) []string {
	var rules []string
	if t, ok := v["type"].(string); ok {
		rules = append(rules, fmt.Sprintf("type:%s", t))
	}
	if min, ok := v["min"]; ok {
		rules = append(rules, fmt.Sprintf("min:%v", min))
	}
	if max, ok := v["max"]; ok {
		rules = append(rules, fmt.Sprintf("max:%v", max))
	}
	if pattern, ok := v["pattern"].(string); ok {
		rules = append(rules, fmt.Sprintf("pattern:%s", pattern))
	}
	if required, ok := v["required"].(bool); ok && required {
		rules = append(rules, "required")
	}
	if v["length"] != nil {
		rules = append(rules, fmt.Sprintf("length:%v", v["length"]))
	}
	return rules
}

// --- Submission helpers ---

// SubmissionDraftValue fills default values for a form draft.
func (e *FormEngine) SubmissionDraft(form *models.FormDefinition) map[string]interface{} {
	draft := make(map[string]interface{})
	var fields []FormFieldRaw
	if err := json.Unmarshal([]byte(form.Fields), &fields); err != nil {
		return draft
	}
	for _, f := range fields {
		// Same id resolution as ValidateSubmission, so a draft key and the key
		// the validator checks are the same string. Resolving field_id alone
		// wrote draft[""] for every field in the frontend shape.
		fieldID, ok := stringField(f, "field_id")
		if !ok {
			fieldID, ok = stringField(f, "name")
		}
		if !ok {
			continue
		}
		typ, _ := f["type"].(string)
		draft[fieldID] = defaultForType(typ)
	}
	return draft
}

// --- helpers ---

type FormFieldRaw map[string]interface{}

func marshalJSON(v interface{}) (string, error) {
	if v == nil {
		return "{}", nil
	}
	// A typed nil does not satisfy v == nil: map[string]interface{}(nil) carries
	// a type, so it fell through to json.Marshal, which wrote "null" into a
	// JSONB column whose readers treat it as an object (forms.layout,
	// form_submissions.data). Both columns default to '{}', so the serialized
	// form must match.
	if m, ok := v.(map[string]interface{}); ok && m == nil {
		return "{}", nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// marshalFieldSlice serializes the form's field definitions for forms.fields,
// which is a JSON array.
//
// marshalJSON would turn a nil slice into "null": jsonb performs no shape check,
// so it would have been written to the column and only surfaced later as a
// validation error at submission time, in ValidateSubmission and SubmissionDraft
// -- both of which unmarshal the column into []FormFieldRaw. An empty slice and
// a nil slice must both become "[]".
func marshalFieldSlice(fields []map[string]interface{}) (string, error) {
	if len(fields) == 0 {
		return "[]", nil
	}
	b, err := json.Marshal(fields)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// stringField reads a string-valued key from a raw field definition. Both keys
// must be present and be a non-empty string: an empty id would validate and
// draft against the literal empty string.
func stringField(f FormFieldRaw, key string) (string, bool) {
	s, ok := f[key].(string)
	return s, ok && s != ""
}

// time helpers for tests
var now = time.Now().UTC
