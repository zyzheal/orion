package models

import "time"

type Requirement struct {
	ID             string    `json:"id" db:"id"`
	TenantID       string    `json:"tenantId" db:"tenant_id"`
	Title          string    `json:"title" db:"title"`
	Description    *string   `json:"description" db:"description"`
	Status         string    `json:"status" db:"status"`
	Priority       string    `json:"priority" db:"priority"`
	Type           string    `json:"type" db:"type"`
	EffortPoints   int       `json:"effortPoints" db:"effort_points"`
	SprintID       *string   `json:"sprintId" db:"sprint_id"`
	ProjectID      *string   `json:"projectId" db:"project_id"`
	ParentID       *string   `json:"parentId" db:"parent_id"`
	RepoRef        *string   `json:"repoRef" db:"repo_ref"`
	Labels         map[string]any `json:"labels" db:"labels"`
	Severity       *string   `json:"severity" db:"severity"`
	EstimatedHours *float64  `json:"estimatedHours" db:"estimated_hours"`
	ActualHours    *float64  `json:"actualHours" db:"actual_hours"`
	AssigneeID     *string   `json:"assigneeId" db:"assignee_id"`
	CreatedBy      string    `json:"createdBy" db:"created_by"`
	CreatedAt      time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt      time.Time `json:"updatedAt" db:"updated_at"`
}

type CreateRequirementRequest struct {
	Title          string         `json:"title" binding:"required"`
	Description    *string        `json:"description"`
	Status         string         `json:"status"`
	Priority       string         `json:"priority"`
	Type           string         `json:"type"`
	EffortPoints   int            `json:"effortPoints"`
	SprintID       *string        `json:"sprintId"`
	ProjectID      *string        `json:"projectId"`
	ParentID       *string        `json:"parentId"`
	RepoRef        *string        `json:"repoRef"`
	Labels         map[string]any `json:"labels"`
	Severity       *string        `json:"severity"`
	EstimatedHours *float64       `json:"estimatedHours"`
	AssigneeID     *string        `json:"assigneeId"`
	CreatedBy      string         `json:"createdBy"`
	TenantID       *string        `json:"tenantId"`
}

type UpdateRequirementRequest struct {
	Title          *string        `json:"title"`
	Description    *string        `json:"description"`
	Status         *string        `json:"status"`
	Priority       *string        `json:"priority"`
	Type           *string        `json:"type"`
	EffortPoints   *int           `json:"effortPoints"`
	SprintID       *string        `json:"sprintId"`
	ProjectID      *string        `json:"projectId"`
	ParentID       *string        `json:"parentId"`
	RepoRef        *string        `json:"repoRef"`
	Labels         map[string]any `json:"labels"`
	Severity       *string        `json:"severity"`
	EstimatedHours *float64       `json:"estimatedHours"`
	ActualHours    *float64       `json:"actualHours"`
	AssigneeID     *string        `json:"assigneeId"`
}

type ListRequirementsRequest struct {
	Status   string
	Priority string
	Type     string
	SprintID string
	Page     int
	PageSize int
}
