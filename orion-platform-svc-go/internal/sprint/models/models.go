package models

import "time"

// Sprint represents a development sprint.
type Sprint struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Goal      string    `json:"goal" db:"goal"`
	StartDate string    `json:"start_date" db:"start_date"`
	EndDate   string    `json:"end_date" db:"end_date"`
	Status    string    `json:"status" db:"status"`
	Capacity  int       `json:"capacity" db:"capacity"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// CreateSprintRequest is the request body for creating a sprint.
type CreateSprintRequest struct {
	Name      string `json:"name" binding:"required"`
	Goal      string `json:"goal"`
	StartDate string `json:"startDate" binding:"required"`
	EndDate   string `json:"endDate" binding:"required"`
	Status    string `json:"status"`
	Capacity  int    `json:"capacity"`
}

// UpdateSprintRequest is the request body for updating a sprint.
type UpdateSprintRequest struct {
	Name      *string `json:"name"`
	Goal      *string `json:"goal"`
	StartDate *string `json:"startDate"`
	EndDate   *string `json:"endDate"`
	Status    *string `json:"status"`
	Capacity  *int    `json:"capacity"`
}

// AddTicketRequest is the request body for adding a ticket to a sprint.
type AddTicketRequest struct {
	TicketID  string `json:"ticketId" binding:"required"`
	SortOrder *int   `json:"sortOrder"`
}

// ReorderTicketsRequest is the request body for reordering tickets in a sprint.
type ReorderTicketsRequest struct {
	Orders []TicketOrder `json:"orders" binding:"required"`
}

// TicketOrder represents a single ticket ordering entry.
type TicketOrder struct {
	TicketID  string `json:"ticketId" binding:"required"`
	SortOrder int    `json:"sortOrder" binding:"required"`
}

// SprintTicket represents a ticket assigned to a sprint.
type SprintTicket struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	SprintID  string    `json:"sprint_id" db:"sprint_id"`
	TicketID  string    `json:"ticket_id" db:"ticket_id"`
	Status    string    `json:"status" db:"status"`
	SortOrder int       `json:"sort_order" db:"sort_order"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// SprintBoard represents the board view of a sprint (grouped by status).
type SprintBoard struct {
	ID              string                       `json:"id"`
	TenantID        string                       `json:"tenant_id"`
	Name            string                       `json:"name"`
	Status          string                       `json:"status"`
	StartDate       string                       `json:"start_date"`
	EndDate         string                       `json:"end_date"`
	TicketsByStatus map[string][]SprintTicket    `json:"ticketsByStatus"`
}

// BurndownPoint represents a single point in a burndown chart.
type BurndownPoint struct {
	Date      string `json:"date"`
	Total     int    `json:"total"`
	Done      int    `json:"done"`
	Remaining int    `json:"remaining"`
}

// BurndownData is the response for the burndown endpoint.
type BurndownData struct {
	SprintID string          `json:"sprintId"`
	Total    int             `json:"total"`
	Done     int             `json:"done"`
	Points   []BurndownPoint `json:"points"`
}
