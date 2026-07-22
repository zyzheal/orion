package models

import "time"

// LowcodeFlow represents a lowcode workflow definition
type LowcodeFlow struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Version     string    `json:"version" db:"version"`
	Nodes       string    `json:"nodes" db:"nodes"`
	Edges       string    `json:"edges" db:"edges"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedBy   string    `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// LowcodeInstance represents a workflow execution instance
type LowcodeInstance struct {
	ID                  string     `json:"id" db:"id"`
	TenantID            string     `json:"tenant_id" db:"tenant_id"`
	WorkflowID          string     `json:"workflow_id" db:"workflow_id"`
	WorkflowDefinitionID string    `json:"workflow_definition_id" db:"workflow_definition_id"`
	Status              string     `json:"status" db:"status"`
	Variables           string     `json:"variables" db:"variables"`
	Input               string     `json:"input" db:"input"`
	Output              string     `json:"output" db:"output"`
	CurrentNodeID       string     `json:"current_node_id" db:"current_node_id"`
	TriggeredBy         string     `json:"triggered_by" db:"triggered_by"`
	StartedAt           *time.Time `json:"started_at" db:"started_at"`
	CompletedAt         *time.Time `json:"completed_at" db:"completed_at"`
	CreatedAt           time.Time  `json:"created_at" db:"created_at"`
}

// LowcodeTemplate represents a lowcode workflow template
type LowcodeTemplate struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Category    string    `json:"category" db:"category"`
	Thumbnail   string    `json:"thumbnail" db:"thumbnail"`
	Definition  string    `json:"definition" db:"definition"`
	Tags        string    `json:"tags" db:"tags"`
	UsageCount  int       `json:"usage_count" db:"usage_count"`
	CreatedBy   string    `json:"created_by" db:"created_by"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// VersionSnapshot represents a version snapshot of a workflow
type VersionSnapshot struct {
	ID         string    `json:"id" db:"id"`
	WorkflowID string    `json:"workflow_id" db:"workflow_id"`
	Version    string    `json:"version" db:"version"`
	Definition string    `json:"definition" db:"definition"`
	CreatedBy  string    `json:"created_by" db:"created_by"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// --- Request types ---

// CreateFlowRequest for creating a flow
type CreateFlowRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Version     string `json:"version"`
	Nodes       string `json:"nodes"`
	Edges       string `json:"edges"`
}

// UpdateFlowRequest for updating a flow
type UpdateFlowRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Version     *string `json:"version"`
	Nodes       *string `json:"nodes"`
	Edges       *string `json:"edges"`
	Enabled     *bool   `json:"enabled"`
}

// CreateTemplateRequest for creating a template
type CreateTemplateRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Tags        string `json:"tags"`
}

// ApplyTemplateRequest for applying a template to create a workflow
type ApplyTemplateRequest struct {
	WorkflowName string `json:"workflow_name" binding:"required"`
	Description  string `json:"description"`
	Variables    string `json:"variables"`
}

// ImportWorkflowRequest for importing a workflow from JSON
type ImportWorkflowRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	CurrentDefinition struct {
		Nodes string `json:"nodes"`
		Edges string `json:"edges"`
	} `json:"current_definition"`
}

// ExportResponse for exporting a workflow as JSON
type ExportResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Version     string `json:"version"`
	Definition  struct {
		Nodes string `json:"nodes"`
		Edges string `json:"edges"`
	} `json:"definition"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// PaginatedResponse for list endpoints
type PaginatedResponse struct {
	Data     any   `json:"data"`
	Total    int   `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"page_size"`
}

// ListFlowFilters for filtering flow list
type ListFlowFilters struct {
	Enabled *bool   `json:"enabled"`
	Search  *string `json:"search"`
}