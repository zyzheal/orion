package engine

import (
	"context"
	"time"

	formengine "orion/go-common/pkg/form"

	"go.uber.org/zap"
)

// Engine is the Form Engine bridge between service-layer models and the
// go-common Form engine. It provides:
//   1. Field-level validation (required, type, min/max, pattern, length)
//   2. Conditional validation (required_when, visible_when)
//   3. Cross-field validation (InterFieldRule: comparison, consistency)
//   4. Enhanced rendering (JSON Schema, HTML, React, YAML)
//   5. Conditional visibility resolution
//
// It does NOT replace the existing FormEngine service layer — it augments it
// with the rich engine types from orion-go-common.
type Engine struct {
	engineForm *formengine.Form
	validator  *formengine.FormValidator
	renderer   *formengine.FormRenderer
	logger     *zap.Logger
}

// Option configures the Engine.
type Option func(*Engine)

// WithLogger sets the logger.
func WithLogger(logger *zap.Logger) Option {
	return func(e *Engine) {
		e.logger = logger
	}
}

// NewEngine creates a new Form Engine from engine Form + FormField types.
//
// Pass a fully-built formengine.Form with Fields populated. The engine
// constructs validator, renderer, and converter from it.
//
// For service-layer models, use NewEngineFromService instead.
func NewEngine(form *formengine.Form, opts ...Option) *Engine {
	e := &Engine{
		engineForm:  form,
		validator:   formengine.NewFormValidator(form),
		renderer:    formengine.NewFormRenderer(form),
		logger:      zap.NewNop(),
	}
	for _, opt := range opts {
		opt(e)
	}
	return e
}

// NewEngineFromService creates an Engine from service-layer models.
// It converts the service FormDefinition and FormField list to engine types
// using the built-in Converter, then constructs the full engine.
func NewEngineFromService(serviceForm FormDefinitionModel, serviceFields []FormFieldModel, opts ...Option) *Engine {
	// Build engine Form from service model
	engineForm := &formengine.Form{
		ID:          serviceForm.Identifier(),
		TenantID:    serviceForm.TenantID(),
		Name:        serviceForm.Name(),
		Title:       resolveTitle(serviceForm),
		Description: serviceForm.Description(),
		Version:     serviceForm.Version(),
		Category:    serviceForm.Category(),
		Status:      serviceForm.Status(),
		ModuleName:  serviceForm.ModuleName(),
		FormType:    serviceForm.FormType(),
		Tags:        serviceForm.Tags(),
		Meta:        serviceForm.Meta(),
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}
	// Parse layout JSON
	if layoutJSON := serviceForm.LayoutJSON(); layoutJSON != "" {
		var layout formengine.FormLayoutConfig
		if err := parseJSON(layoutJSON, &layout); err == nil {
			engineForm.Layout = &layout
		}
	}
	// Parse cross-field rules from fields JSON
	if fieldsJSON := serviceForm.FieldsJSON(); fieldsJSON != "" {
		parseInterFieldRules(engineForm, fieldsJSON)
	}

	// Convert service fields to engine fields
	engineForm.Fields = ConvertServiceFields(serviceFields)

	e := NewEngine(engineForm, opts...)
	return e
}

// Validate validates submission data using the engine's full validation pipeline:
//   1. Field-level validation (required, type, min/max, pattern, length)
//   2. Conditional validation (required_when, visible_when)
//   3. Cross-field validation (InterFieldRule: comparison, consistency)
//
// Returns a *formengine.ValidatedFormData with structured errors.
func (e *Engine) Validate(ctx context.Context, data map[string]interface{}) *formengine.ValidatedFormData {
	e.logger.Debug("Engine.Validate", zap.Any("fieldCount", len(e.engineForm.Fields)))
	return e.validator.Validate(data)
}

// RenderJSON renders the form as a JSON Schema (draft-07) for frontend consumption.
func (e *Engine) RenderJSON(ctx context.Context) ([]byte, error) {
	return e.renderer.RenderJSON()
}

// RenderHTML renders the form as an HTML template for server-side rendering.
func (e *Engine) RenderHTML(ctx context.Context) ([]byte, error) {
	return e.renderer.RenderHTML()
}

// RenderReact renders the form as a React (Ant Design) component code snippet.
func (e *Engine) RenderReact(ctx context.Context) ([]byte, error) {
	return e.renderer.RenderReact()
}

// RenderYAML renders the form as a YAML configuration file for ops management.
func (e *Engine) RenderYAML(ctx context.Context) ([]byte, error) {
	return e.renderer.RenderYAML()
}

// ToFormData converts a Go struct into a FormData snapshot using the engine Form.

// FromFormData converts FormData back into a Go struct using the engine Form.

// ResolveVisibility evaluates all condition expressions (visible_when, required_when,
// disabled_when) against the given data and returns per-field visibility state.
//
// Returns a map[fieldKey]FieldState indicating visible, required, and disabled state.
func (e *Engine) ResolveVisibility(ctx context.Context, data map[string]interface{}) map[string]FieldState {
	states := make(map[string]FieldState)

	for _, f := range e.engineForm.Fields {
		state := FieldState{
		Visible:  !f.Hidden && f.Visible,
			Required: f.Required,
			Disabled: f.Disabled,
		}

		// Resolve visible_when
		if f.VisibleWhen != nil {
			state.Visible = evaluateCondition(f.VisibleWhen, data)
		}

		// Resolve required_when
		if f.RequiredWhen != nil {
			state.Required = evaluateCondition(f.RequiredWhen, data)
		}

		// Resolve disabled_when
		if f.DisabledWhen != nil {
			state.Disabled = evaluateCondition(f.DisabledWhen, data)
		}

		states[f.Key] = state
	}

	return states
}

// DefaultValues produces a draft data map with sensible defaults for all fields.
//
// Default value resolution order:
//   1. Field-level Default value
//   2. Type-appropriate zero value ("" for text, 0 for number, false for boolean)
func (e *Engine) DefaultValues() map[string]interface{} {
	draft := make(map[string]interface{})

	for _, f := range e.engineForm.Fields {
		if f.Default != nil {
			draft[f.Key] = f.Default
			continue
		}
		draft[f.Key] = typeDefault(string(f.Type))
	}

	return draft
}

// EngineForm returns the underlying engine Form definition for inspection.
func (e *Engine) EngineForm() *formengine.Form {
	return e.engineForm
}

// EngineFields returns the underlying engine FormField list for inspection.
func (e *Engine) EngineFields() []formengine.FormField {
	return e.engineForm.Fields
}

// ResolveTitle uses Name as fallback when Title is not available.
func resolveTitle(m FormDefinitionModel) string {
	if title := m.Title(); title != "" {
		return title
	}
	return m.Name()
}

// parseJSON is a helper to unmarshal JSON bytes into a target.
func parseJSON(data string, target interface{}) error {
	return jsonUnmarshal([]byte(data), target)
}

// typeDefault returns the zero value for a field type string.
func typeDefault(t string) interface{} {
	switch t {
	case "number":
		return float64(0)
	case "checkbox", "switch":
		return false
	case "multi-select", "cascader", "upload":
		return []interface{}{}
	case "table":
		return []interface{}{}
	default:
		return ""
	}
}
