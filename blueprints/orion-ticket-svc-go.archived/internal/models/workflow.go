package models

import "time"

// Valid ticket statuses
const (
	StatusOpen       = "open"
	StatusAssigned   = "assigned"
	StatusInProgress = "in-progress"
	StatusResolved   = "resolved"
	StatusClosed     = "closed"
)

// Valid status transitions
var ValidTransitions = map[string][]string{
	StatusOpen:       {StatusAssigned, StatusInProgress, StatusClosed},
	StatusAssigned:   {StatusInProgress, StatusOpen, StatusClosed},
	StatusInProgress: {StatusResolved, StatusAssigned, StatusOpen},
	StatusResolved:   {StatusClosed, StatusInProgress},
	StatusClosed:     {StatusOpen}, // reopen
}

// WorkflowHistory tracks status transitions
type WorkflowHistory struct {
	ID         string    `json:"id" db:"id"`
	TicketID   string    `json:"ticket_id" db:"ticket_id"`
	FromStatus string    `json:"from_status" db:"from_status"`
	ToStatus   string    `json:"to_status" db:"to_status"`
	PerformedBy string   `json:"performed_by" db:"performed_by"`
	Reason     string    `json:"reason,omitempty" db:"reason"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// TransitionRequest is the input for status transitions
type TransitionRequest struct {
	ToStatus   string `json:"to_status" binding:"required"`
	PerformedBy string `json:"performed_by" binding:"required"`
	Reason     string `json:"reason"`
}
