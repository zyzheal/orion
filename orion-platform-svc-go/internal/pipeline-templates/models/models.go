package models

import "encoding/json"

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

// TemplateStatus represents the lifecycle status of a pipeline template.
type TemplateStatus string

const (
	StatusDraft      TemplateStatus = "draft"
	StatusPublished  TemplateStatus = "published"
	StatusDeprecated TemplateStatus = "deprecated"
	StatusArchived   TemplateStatus = "archived"
)

// TemplateVisibility represents who can see the template.
type TemplateVisibility string

const (
	VisibilityPublic       TemplateVisibility = "public"
	VisibilityPrivate      TemplateVisibility = "private"
	VisibilityOrganization TemplateVisibility = "organization"
)

// TemplateCategory represents the category of a pipeline template.
type TemplateCategory string

const (
	CategoryCICD           TemplateCategory = "ci_cd"
	CategoryBuild          TemplateCategory = "build"
	CategoryDeploy         TemplateCategory = "deploy"
	CategoryTest           TemplateCategory = "test"
	CategorySecurity       TemplateCategory = "security"
	CategoryMonitoring     TemplateCategory = "monitoring"
	CategoryInfrastructure TemplateCategory = "infrastructure"
	CategoryDataPipeline   TemplateCategory = "data_pipeline"
	CategoryMLOps          TemplateCategory = "ml_ops"
	CategoryCustom         TemplateCategory = "custom"
)

// ParameterType represents the type of a template parameter.
type ParameterType string

const (
	ParamTypeString  ParameterType = "string"
	ParamTypeNumber  ParameterType = "number"
	ParamTypeBoolean ParameterType = "boolean"
	ParamTypeObject  ParameterType = "object"
	ParamTypeArray   ParameterType = "array"
	ParamTypeEnum    ParameterType = "enum"
)

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

// PipelineTemplate represents a reusable pipeline template.
type PipelineTemplate struct {
	ID           string             `json:"id" db:"id"`
	TenantID     string             `json:"tenant_id" db:"tenant_id"`
	Name         string             `json:"name" db:"name"`
	DisplayName  string             `json:"display_name" db:"display_name"`
	Description  string             `json:"description" db:"description"`
	Category     TemplateCategory   `json:"category" db:"category"`
	Tags         string             `json:"tags" db:"tags"` // JSON array
	Status       TemplateStatus     `json:"status" db:"status"`
	Visibility   TemplateVisibility `json:"visibility" db:"visibility"`
	Version      string             `json:"version" db:"version"`
	Author       string             `json:"author" db:"author"`
	Organization *string            `json:"organization,omitempty" db:"organization"`
	Config       string             `json:"config" db:"config"`         // JSONB
	Parameters   string             `json:"parameters" db:"parameters"` // JSON array of TemplateParameter
	Readme       *string            `json:"readme,omitempty" db:"readme"`
	Icon         *string            `json:"icon,omitempty" db:"icon"`
	UsageCount   int64              `json:"usage_count" db:"usage_count"`
	StarCount    int64              `json:"star_count" db:"star_count"`
	CreatedAt    *int64             `json:"created_at" db:"created_at"`               // unix seconds
	UpdatedAt    *int64             `json:"updated_at" db:"updated_at"`               // unix seconds
	PublishedAt  *int64             `json:"published_at,omitempty" db:"published_at"` // unix seconds
}

// TagsSlice marshals/unmarshals the tags JSON array.
func (t *PipelineTemplate) TagsSlice() []string {
	if t.Tags == "" {
		return nil
	}
	var s []string
	_ = json.Unmarshal([]byte(t.Tags), &s)
	return s
}

// ParametersSlice returns the template parameters as a slice.
func (t *PipelineTemplate) ParametersSlice() []TemplateParameter {
	if t.Parameters == "" {
		return nil
	}
	var ps []TemplateParameter
	_ = json.Unmarshal([]byte(t.Parameters), &ps)
	return ps
}

// ConfigMap returns the template config as a map.
func (t *PipelineTemplate) ConfigMap() map[string]interface{} {
	if t.Config == "" {
		return make(map[string]interface{})
	}
	var m map[string]interface{}
	_ = json.Unmarshal([]byte(t.Config), &m)
	return m
}

// TemplateVersion represents a version snapshot of a template.
type TemplateVersion struct {
	ID         string `json:"id" db:"id"`
	TemplateID string `json:"template_id" db:"template_id"`
	Version    string `json:"version" db:"version"`
	Config     string `json:"config" db:"config"`         // JSONB
	Parameters string `json:"parameters" db:"parameters"` // JSON array
	ChangeLog  string `json:"change_log" db:"change_log"`
	CreatedAt  *int64 `json:"created_at" db:"created_at"` // unix seconds
	CreatedBy  string `json:"created_by" db:"created_by"`
}

// TemplateParameter defines a parameter that a template accepts.
type TemplateParameter struct {
	Name         string        `json:"name"`
	Type         ParameterType `json:"type"`
	Description  *string       `json:"description,omitempty"`
	Required     bool          `json:"required"`
	DefaultValue interface{}   `json:"default_value"`
	Validation   *string       `json:"validation,omitempty"` // JSON
}

// TemplateCategorySummary is the response for a category summary entry.
type TemplateCategorySummary struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Count       int    `json:"count"`
}

// ---------------------------------------------------------------------------
// Request / Response models
// ---------------------------------------------------------------------------

// CreateTemplateRequest is the request body for creating a template.
type CreateTemplateRequest struct {
	Name        string                 `json:"name" binding:"required"`
	DisplayName string                 `json:"displayName" binding:"required"`
	Description string                 `json:"description"`
	Category    TemplateCategory       `json:"category" binding:"required"`
	Tags        []string               `json:"tags"`
	Visibility  TemplateVisibility     `json:"visibility"`
	Config      map[string]interface{} `json:"config" binding:"required"`
	Parameters  []TemplateParameter    `json:"parameters"`
	Readme      *string                `json:"readme"`
	Icon        *string                `json:"icon"`
}

// UpdateTemplateRequest is the request body for updating a template.
type UpdateTemplateRequest struct {
	Name        *string                `json:"name"`
	DisplayName *string                `json:"displayName"`
	Description *string                `json:"description"`
	Category    *TemplateCategory      `json:"category"`
	Tags        []string               `json:"tags"`
	Visibility  *TemplateVisibility    `json:"visibility"`
	Config      map[string]interface{} `json:"config"`
	Parameters  []TemplateParameter    `json:"parameters"`
	Readme      *string                `json:"readme"`
	Icon        *string                `json:"icon"`
}

// InstantiateTemplateRequest is the request body for instantiating a pipeline from a template.
type InstantiateTemplateRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description *string                `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// InstantiateTemplateResponse is the response when instantiating a template.
type InstantiateTemplateResponse struct {
	PipelineID string                 `json:"pipelineId"`
	Config     map[string]interface{} `json:"config"`
}

// ListQuery is the query parameters for listing/searching templates.
type ListQuery struct {
	Category   string `form:"category"`
	Status     string `form:"status"`
	Visibility string `form:"visibility"`
	Author     string `form:"author"`
	Tags       string `form:"tags"`
	Search     string `form:"q"`
	Limit      int    `form:"limit"`
	Offset     int    `form:"offset"`
	Sort       string `form:"sort"`
	Order      string `form:"order"`
}
