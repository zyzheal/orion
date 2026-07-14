package models

import "time"

// PipelineTemplate represents a reusable pipeline template definition.
type PipelineTemplate struct {
	ID             string     `db:"id" json:"id"`
	TenantID       string     `db:"tenant_id" json:"tenantId"`
	Name           string     `db:"name" json:"name"`
	Description    *string    `db:"description" json:"description"`
	YAMLDefinition string     `db:"yaml_definition" json:"yamlDefinition"`
	Tags           string     `db:"tags" json:"tags"`
	Category       *string    `db:"category" json:"category"`
	Version        *string    `db:"version" json:"version"`
	CreatedBy      *string    `db:"created_by" json:"createdBy"`
	CreatedAt      time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateTemplateRequest is the request body for creating a pipeline template.
type CreateTemplateRequest struct {
	Name           string  `json:"name" binding:"required"`
	Description    *string `json:"description"`
	YAMLDefinition string  `json:"yamlDefinition" binding:"required"`
	Tags           *string `json:"tags"`
	Category       *string `json:"category"`
	Version        *string `json:"version"`
	CreatedBy      *string `json:"createdBy"`
}

// UpdateTemplateRequest is the request body for updating a pipeline template.
type UpdateTemplateRequest struct {
	Name           *string `json:"name"`
	Description    *string `json:"description"`
	YAMLDefinition *string `json:"yamlDefinition"`
	Tags           *string `json:"tags"`
	Category       *string `json:"category"`
	Version        *string `json:"version"`
}

// InstantiateRequest is the request body for instantiating a template into a pipeline.
type InstantiateRequest struct {
	Name        string            `json:"name" binding:"required"`
	Parameters  map[string]string `json:"parameters"`
	Environment *string           `json:"environment"`
}

// InstantiatedPipeline is the response returned when a template is instantiated.
type InstantiatedPipeline struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Status   string `json:"status"`
	SourceID string `json:"sourceId"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
