package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ---------------------------------------------------------------------------
// JSONB – generic JSON column that handles both objects and arrays.
// ---------------------------------------------------------------------------

type JSONB json.RawMessage

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return string(j), nil
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		*j = make(JSONB, len(v))
		copy(*j, v)
	case string:
		*j = JSONB([]byte(v))
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
	return nil
}

func (j JSONB) MarshalJSON() ([]byte, error) {
	if j == nil {
		return []byte("null"), nil
	}
	return []byte(j), nil
}

func (j *JSONB) UnmarshalJSON(data []byte) error {
	if data == nil {
		*j = nil
		return nil
	}
	*j = make(JSONB, len(data))
	copy(*j, data)
	return nil
}

// ---------------------------------------------------------------------------
// TemplateParameter – one configurable parameter declared by a template.
// ---------------------------------------------------------------------------

type TemplateParameter struct {
	Name         string      `json:"name"`
	Type         string      `json:"type"` // string | number | boolean | array
	Description  string      `json:"description"`
	DefaultValue interface{} `json:"default_value,omitempty"`
	Required     bool        `json:"required"`
}

// ParseParameters deserialises a JSONB column into typed parameter slices.
func ParseParameters(raw JSONB) ([]TemplateParameter, error) {
	if raw == nil {
		return nil, nil
	}
	var params []TemplateParameter
	if err := json.Unmarshal(raw, &params); err != nil {
		return nil, err
	}
	return params, nil
}

// ---------------------------------------------------------------------------
// PipelineTemplate – persisted row.
// ---------------------------------------------------------------------------

type PipelineTemplate struct {
	ID          string    `db:"id"         json:"id"`
	TenantID    string    `db:"tenant_id"  json:"tenant_id"`
	Name        string    `db:"name"       json:"name"`
	Description string    `db:"description" json:"description,omitempty"`
	Category    string    `db:"category"    json:"category"`
	YAMLContent string    `db:"yaml_content" json:"yaml_content"`
	Parameters  JSONB     `db:"parameters"  json:"parameters,omitempty"`
	Version     int       `db:"version"     json:"version"`
	IsPublic    bool      `db:"is_public"   json:"is_public"`
	Tags        JSONB     `db:"tags"        json:"tags,omitempty"`
	UsageCount  int       `db:"usage_count" json:"usage_count"`
	CreatedBy   *string   `db:"created_by"  json:"created_by,omitempty"`
	CreatedAt   time.Time `db:"created_at"  json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"  json:"updated_at"`
}

// ---------------------------------------------------------------------------
// Request / response DTOs
// ---------------------------------------------------------------------------

type CreatePipelineTemplateRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Category    string `json:"category"`
	YAMLContent string `json:"yaml_content" binding:"required"`
	Parameters  JSONB  `json:"parameters"`
	IsPublic    bool   `json:"is_public"`
	Tags        JSONB  `json:"tags"`
}

type UpdatePipelineTemplateRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Category    *string `json:"category"`
	YAMLContent *string `json:"yaml_content"`
	Parameters  JSONB   `json:"parameters"` // nil = skip, non-nil = set
	IsPublic    *bool   `json:"is_public"`
	Tags        JSONB   `json:"tags"` // nil = skip, non-nil = set
}

type InstantiateTemplateRequest struct {
	Name      string                 `json:"name" binding:"required"`
	ProjectID string                 `json:"project_id"`
	Params    map[string]interface{} `json:"params"`
}

type ListResult struct {
	Data  []PipelineTemplate `json:"data"`
	Total int                `json:"total"`
	Page  int                `json:"page"`
	Limit int                `json:"limit"`
}

type InstantiateResult struct {
	PipelineID string `json:"pipeline_id"`
	Name       string `json:"name"`
	Version    int    `json:"version"`
}

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------

type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
