package models

import "time"

// FormDefinition represents a form template definition.
type FormDefinition struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenantId" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Code        string    `json:"code" db:"code"`
	Category    string    `json:"category" db:"category"`
	Description string    `json:"description" db:"description"`
	Layout      string    `json:"layout" db:"layout"`
	Fields      string    `json:"fields" db:"fields"`
	Status      string    `json:"status" db:"status"`
	Version     int       `json:"version" db:"version"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// FormField represents a single field within a form definition.
type FormField struct {
	ID           string    `json:"id" db:"id"`
	FormID       string    `json:"formId" db:"form_id"`
	FieldID      string    `json:"fieldId" db:"field_id"`
	Label        string    `json:"label" db:"label"`
	Type         string    `json:"type" db:"type"`
	PlaceHolder  string    `json:"placeholder" db:"placeholder"`
	Required     bool      `json:"required" db:"required"`
	Visible      bool      `json:"visible" db:"visible"`
	ReadOnly     bool      `json:"readOnly" db:"read_only"`
	Validation   string    `json:"validation" db:"validation"`
	Options      string    `json:"options" db:"options"`
	DefaultValue string    `json:"defaultValue" db:"default_value"`
	Dependency   string    `json:"dependency" db:"dependency"`
	Priority     int       `json:"priority" db:"priority"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

// FormSubmission represents a submitted form instance.
type FormSubmission struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenantId" db:"tenant_id"`
	FormID      string    `json:"formId" db:"form_id"`
	Data        string    `json:"data" db:"data"`
	SubmittedBy string    `json:"submittedBy" db:"submitted_by"`
	Status      string    `json:"status" db:"status"`
	Comment     string    `json:"comment" db:"comment"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateFormRequest is the request body for creating a form.
type CreateFormRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Code        string                 `json:"code" binding:"required"`
	Category    string                 `json:"category" binding:"required"`
	Description string                 `json:"description"`
	Layout      map[string]interface{} `json:"layout"`
	Fields      []map[string]interface{} `json:"fields" binding:"required"`
}

// UpdateFormRequest is the request body for updating a form.
type UpdateFormRequest struct {
	Name        *string                `json:"name"`
	Category    *string                `json:"category"`
	Description *string                `json:"description"`
	Layout      map[string]interface{} `json:"layout"`
	Fields      []map[string]interface{} `json:"fields"`
	Status      *string                `json:"status"`
}

// SubmitFormRequest is the request body for submitting a form.
type SubmitFormRequest struct {
	Data map[string]interface{} `json:"data" binding:"required"`
	Comment string             `json:"comment"`
}

// ValidateFormRequest is the request body for validating form data.
type ValidateFormRequest struct {
	Data map[string]interface{} `json:"data" binding:"required"`
}

// ValidationResult is the response for form validation.
type ValidationResult struct {
	Valid   bool            `json:"valid"`
	Errors  []string        `json:"errors"`
	Fields  []FieldError    `json:"fields"`
}

// FieldError describes a validation error on a specific field.
type FieldError struct {
	FieldID string `json:"fieldId"`
	Message string `json:"message"`
}

// RenderFormResponse is the response for rendering a form.
type RenderFormResponse struct {
	Form     *FormDefinition `json:"form"`
	Fields   []FormField     `json:"fields"`
	Layout   interface{}     `json:"layout"`
	Controls []FormControl   `json:"controls"`
}

// FormControl describes a renderable control with its metadata.
type FormControl struct {
	ID           string                 `json:"id"`
	Label        string                 `json:"label"`
	Type         string                 `json:"type"`
	PlaceHolder  string                 `json:"placeholder"`
	Required     bool                   `json:"required"`
	Visible      bool                   `json:"visible"`
	ReadOnly     bool                   `json:"readOnly"`
	Options      []Option               `json:"options"`
	DefaultValue interface{}            `json:"defaultValue"`
	Validation   map[string]interface{} `json:"validation"`
	Rules        []string               `json:"rules"`
}

// Option represents a select/radio checkbox option.
type Option struct {
	Label string `json:"label"`
	Value string `json:"value"`
	Disabled bool `json:"disabled"`
}
