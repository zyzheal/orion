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

func (e *FormEngine) CreateForm(ctx context.Context, tenantID string, name, code, category string, layout, fields map[string]interface{}) (*models.FormDefinition, error) {
	e.logger.Info("CreateForm", zap.String("tenantID", tenantID), zap.String("code", code))

	layoutJSON, err := marshalJSON(layout)
	if err != nil {
		return nil, fmt.Errorf("invalid layout: %w", err)
	}
	fieldsJSON, err := marshalJSON(fields)
	if err != nil {
		return nil, fmt.Errorf("invalid fields: %w", err)
	}

	req := models.CreateFormRequest{
		Name:        name,
		Code:        code,
		Category:    category,
		Layout:      layout,
		Fields:      toFieldSlice(fields),
		Description: "",
	}

	form, err := e.repo.CreateForm(ctx, tenantID, req, layoutJSON, fieldsJSON)
	if err != nil {
		return nil, err
	}
	e.logger.Info("Form created", zap.String("id", form.ID), zap.String("code", code))
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
		fieldID := f["field_id"].(string)
		required, _ := f["required"].(bool)
		visible, _ := f["visible"].(bool)
		if !visible {
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
		fieldID, _ := f["field_id"].(string)
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
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func toFieldSlice(fields map[string]interface{}) []map[string]interface{} {
	slice := make([]map[string]interface{}, 0)
	if raw, ok := fields["items"].([]map[string]interface{}); ok {
		slice = raw
	}
	return slice
}

// time helpers for tests
var now = time.Now().UTC
