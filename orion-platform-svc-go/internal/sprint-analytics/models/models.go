package models

import "time"

// SprintReview is the review meeting record for a sprint.
type SprintReview struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenantId" db:"tenant_id"`
	SprintID    string    `json:"sprintId" db:"sprint_id"`
	Status      string    `json:"status" db:"status"`
	Date        string    `json:"date" db:"date"`
	Attendees   []string  `json:"attendees" db:"attendees"`
	Highlights  string    `json:"highlights" db:"highlights"`
	DemoNotes   *string   `json:"demoNotes" db:"demo_notes"`
	Feedback    *string   `json:"feedback" db:"feedback"`
	CompletedAt *time.Time `json:"completedAt" db:"completed_at"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// SprintRetrospective is the retro meeting record for a sprint.
type SprintRetrospective struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenantId" db:"tenant_id"`
	SprintID   string    `json:"sprintId" db:"sprint_id"`
	Date       string    `json:"date" db:"date"`
	Attendees  []string  `json:"attendees" db:"attendees"`
	WhatWentWell []string `json:"whatWentWell" db:"what_went_well"`
	WhatToImprove  []string `json:"whatToImprove" db:"what_to_improve"`
	ActionItems []ActionItem `json:"actionItems" db:"action_items"`
	Summary    *string   `json:"summary" db:"summary"`
	CreatedAt  time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt  time.Time `json:"updatedAt" db:"updated_at"`
}

// ActionItem is a concrete action from a retrospective.
type ActionItem struct {
	Text    string `json:"text"`
	Owner   *string `json:"owner"`
	Done    bool   `json:"done"`
}

// VelocityEntry represents velocity for a single sprint.
type VelocityEntry struct {
	SprintID   string `json:"sprintId"`
	SprintName string `json:"sprintName"`
	Committed  int    `json:"committed"`
	Completed  int    `json:"completed"`
	AvgPerMember int  `json:"avgPerMember"`
}

// GanttItem represents a task or sprint in a Gantt view.
type GanttItem struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Type      string `json:"type"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	Status    string `json:"status"`
	Assignee  *string `json:"assignee"`
}

// CreateReviewRequest is the request body for creating a sprint review.
type CreateReviewRequest struct {
	SprintID   string   `json:"sprintId" binding:"required"`
	Date       string   `json:"date"`
	Attendees  []string `json:"attendees"`
	Highlights string   `json:"highlights"`
	DemoNotes  *string  `json:"demoNotes"`
	Feedback   *string  `json:"feedback"`
}

// CreateRetroRequest is the request body for creating a retrospective.
type CreateRetroRequest struct {
	SprintID      string       `json:"sprintId" binding:"required"`
	Date          string       `json:"date"`
	Attendees     []string     `json:"attendees"`
	WhatWentWell  []string     `json:"whatWentWell"`
	WhatToImprove []string     `json:"whatToImprove"`
	ActionItems   []ActionItem `json:"actionItems"`
	Summary       *string      `json:"summary"`
}

// UpdateReviewRequest is the request body for updating a review.
type UpdateReviewRequest struct {
	Status      *string  `json:"status"`
	Date        *string  `json:"date"`
	Attendees   []string `json:"attendees"`
	Highlights  *string  `json:"highlights"`
	DemoNotes   *string  `json:"demoNotes"`
	Feedback    *string  `json:"feedback"`
}

// UpdateRetroRequest is the request body for updating a retrospective.
type UpdateRetroRequest struct {
	Date          *string      `json:"date"`
	Attendees     []string     `json:"attendees"`
	WhatWentWell  []string     `json:"whatWentWell"`
	WhatToImprove []string     `json:"whatToImprove"`
	ActionItems   []ActionItem `json:"actionItems"`
	Summary       *string      `json:"summary"`
}
