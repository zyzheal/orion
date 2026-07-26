package models

import "time"

// PipelineTemplate represents a reusable pipeline template
type PipelineTemplate struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	Category    string    `db:"category" json:"category"`
	YAMLConfig  string    `db:"yaml_config" json:"yaml_config"`
	Variables   string    `db:"variables" json:"variables"` // JSON array of variable definitions
	IsPublic    bool      `db:"is_public" json:"is_public"`
	Version     string    `db:"version" json:"version"`
	UsageCount  int       `db:"usage_count" json:"usage_count"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// TemplateVariable defines a configurable variable in a template
type TemplateVariable struct {
	Name         string `json:"name"`
	Type         string `json:"type"` // string, number, boolean, select
	Label        string `json:"label"`
	DefaultValue string `json:"default_value,omitempty"`
	Required     bool   `json:"required"`
	Options      []string `json:"options,omitempty"` // for select type
	Description  string `json:"description,omitempty"`
}

// CreateTemplateRequest is input for creating a template
type CreateTemplateRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Category    string `json:"category"`
	YAMLConfig  string `json:"yaml_config" binding:"required"`
	Variables   string `json:"variables"`
	IsPublic    bool   `json:"is_public"`
}
