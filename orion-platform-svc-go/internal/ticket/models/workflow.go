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

// WorkflowHistory tracks status transitions.
//
// The db tags name the columns 076_create_ticketing_tables.sql actually
// created: from_state, to_state, user_id and comment. The previous tags pointed
// at from_status, to_status, performed_by and reason, none of which exist, so
// every INSERT this module issued was rejected by the driver. The json keys are
// left alone because they are the wire contract the frontend already reads.
//
// TenantID and Action exist because 695 adds tenant_id and 076 declares
// action NOT NULL with no default, so a row cannot be written without both.
// CreatedAt is likewise NOT NULL with no default.
type WorkflowHistory struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenant_id" db:"tenant_id"`
	TicketID    string    `json:"ticket_id" db:"ticket_id"`
	Action      string    `json:"action" db:"action"`
	FromStatus  string    `json:"from_status" db:"from_state"`
	ToStatus    string    `json:"to_status" db:"to_state"`
	PerformedBy string    `json:"performed_by" db:"user_id"`
	Reason      string    `json:"reason,omitempty" db:"comment"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// TransitionRequest is the input for status transitions
type TransitionRequest struct {
	ToStatus    string `json:"to_status" binding:"required"`
	PerformedBy string `json:"performed_by" binding:"required"`
	Reason      string `json:"reason"`
}
