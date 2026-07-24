package models

import "time"

// WorkflowTask represents a task in a workflow instance.
type WorkflowTask struct {
	ID                 string     `db:"id" json:"id"`
	TenantID           string     `db:"tenant_id" json:"tenantId"`
	WorkflowInstanceID string     `db:"workflow_instance_id" json:"workflowInstanceId"`
	Name               string     `db:"name" json:"name"`
	Description        *string    `db:"description" json:"description"`
	AssigneeID         *string    `db:"assignee_id" json:"assigneeId"`
	Status             string     `db:"status" json:"status"` // pending|assigned|completed|cancelled
	FormData           *string    `db:"form_data" json:"formData"`
	Comment            *string    `db:"comment" json:"comment"`
	CreatedBy          string     `db:"created_by" json:"createdBy"`
	CreatedAt          time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt          time.Time  `db:"updated_at" json:"updatedAt"`
	CompletedAt        *time.Time `db:"completed_at" json:"completedAt"`
}

// ListFilter contains optional query filters for listing workflow tasks.
type ListFilter struct {
	AssigneeID *string `json:"assigneeId"`
	Status     *string `json:"status"`
	Page       int     `json:"page"`
	PageSize   int     `json:"pageSize"`
}

// ClaimTaskRequest is the request body for claiming a workflow task.
type ClaimTaskRequest struct {
	Comment *string `json:"comment"`
}

// CompleteTaskRequest is the request body for completing a workflow task.
type CompleteTaskRequest struct {
	Comment  *string `json:"comment"`
	FormData *string `json:"formData"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}
