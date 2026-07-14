package models

import "time"

// Workflow represents a low-code workflow definition.
type Workflow struct {
	ID        string    `db:"id" json:"id"`
	TenantID  string    `db:"tenant_id" json:"tenantId"`
	Name      string    `db:"name" json:"name"`
	Description *string `db:"description" json:"description"`
	Nodes     string    `db:"nodes" json:"nodes"`
	Edges     string    `db:"edges" json:"edges"`
	Enabled   bool      `db:"enabled" json:"enabled"`
	Version   string    `db:"version" json:"version"`
	CreatedBy string    `db:"created_by" json:"createdBy"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// WorkflowExecution represents a single run of a workflow.
type WorkflowExecution struct {
	ID                  string     `db:"id" json:"id"`
	WorkflowID          string     `db:"workflow_id" json:"workflowId"`
	WorkflowDefinitionID string    `db:"workflow_definition_id" json:"workflowDefinitionId"`
	Status              string     `db:"status" json:"status"`
	Input               string     `db:"input" json:"input"`
	Output              *string    `db:"output" json:"output"`
	CurrentNodeID       *string    `db:"current_node_id" json:"currentNodeId"`
	TriggeredBy         string     `db:"triggered_by" json:"triggeredBy"`
	StartedAt           *time.Time `db:"started_at" json:"startedAt"`
	CompletedAt         *time.Time `db:"completed_at" json:"completedAt"`
	CreatedAt           time.Time  `db:"created_at" json:"createdAt"`
}

// CreateWorkflowRequest is the request body for creating a workflow.
type CreateWorkflowRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
	Nodes       *string `json:"nodes"`
	Edges       *string `json:"edges"`
}

// UpdateWorkflowRequest is the request body for updating a workflow.
type UpdateWorkflowRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Nodes       *string `json:"nodes"`
	Edges       *string `json:"edges"`
	Enabled     *bool   `json:"enabled"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}