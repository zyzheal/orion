package engine

// =============================================================================
// Model interfaces — decouple Engine from service-layer models
// =============================================================================
// The Engine accepts these interfaces instead of importing
// orion/platform-svc-go/internal/form/models, keeping the engine package
// self-contained and testable.

// FormDefinitionModel represents a service-layer form definition (template).
type FormDefinitionModel interface {
	// Identifier returns the form's unique ID.
	Identifier() string
	// TenantID returns the owning tenant.
	TenantID() string
	// Name returns the human-readable form name.
	Name() string
	// Code returns the machine-readable form code.
	Code() string
	// Title returns the display title.
	Title() string
	// Description returns the form description.
	Description() string
	// Category returns the form category (approval, cmdb, config, ...).
	Category() string
	// Status returns the form status (draft, active, archived).
	Status() string
	// Version returns the form version number.
	Version() int
	// ModuleName returns the owning module.
	ModuleName() string
	// FormType returns the form type (approval, cmdb_item, config, ...).
	FormType() string
	// LayoutJSON returns the raw layout JSON string.
	LayoutJSON() string
	// FieldsJSON returns the raw fields JSON string.
	FieldsJSON() string
	// Meta returns the form's extended metadata.
	Meta() map[string]string
	// Tags returns the form's tags.
	Tags() []string
}

// FormFieldModel represents a service-layer form field definition.
type FormFieldModel interface {
	// Identifier returns the field's unique ID (DB row id).
	Identifier() string
	// FormID returns the parent form's ID.
	FormID() string
	// FieldID returns the field's logical key (e.g. "approval_name").
	FieldID() string
	// Label returns the field's display label.
	Label() string
	// Type returns the field type (text, number, select, date, ...).
	Type() string
	// Placeholder returns the input placeholder text.
	Placeholder() string
	// Required returns whether the field is required.
	Required() bool
	// Visible returns whether the field is visible.
	Visible() bool
	// ReadOnly returns whether the field is read-only.
	ReadOnly() bool
	// ValidationJSON returns the raw validation JSON string.
	ValidationJSON() string
	// OptionsJSON returns the raw options JSON string.
	OptionsJSON() string
	// DefaultValue returns the field's default value.
	DefaultValue() string
	// DependencyJSON returns the raw dependency JSON string.
	DependencyJSON() string
	// Priority returns the field's sort priority.
	Priority() int
}

// FieldState describes the resolved state of a field after condition evaluation.
type FieldState struct {
	Visible  bool
	Required bool
	Disabled bool
}
