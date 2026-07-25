package models

import "time"

// AssignmentRule defines automatic ticket assignment rules
type AssignmentRule struct {
	ID         string   `json:"id" db:"id"`
	Name       string   `json:"name" db:"name"`
	Categories []string `json:"categories" db:"categories"`
	Assignee   string   `json:"assignee" db:"assignee"`
	Priorities []string `json:"priorities,omitempty" db:"priorities"`
	Enabled    bool     `json:"enabled" db:"enabled"`
	Order      int      `json:"order" db:"order"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

// CreateAssignmentRuleRequest is input for creating an assignment rule
type CreateAssignmentRuleRequest struct {
	ID         string   `json:"id"`
	Name       string   `json:"name" binding:"required"`
	Categories []string `json:"categories" binding:"required"`
	Assignee   string   `json:"assignee" binding:"required"`
	Priorities []string `json:"priorities"`
	Enabled    *bool    `json:"enabled"`
	Order      int      `json:"order"`
}

// TransferRecord tracks a ticket transfer between engineers
type TransferRecord struct {
	ID             string    `json:"id" db:"id"`
	TicketID       string    `json:"ticket_id" db:"ticket_id"`
	FromEngineerID string    `json:"from_engineer_id" db:"from_engineer_id"`
	ToEngineerID   string    `json:"to_engineer_id" db:"to_engineer_id"`
	InitiatedBy    string    `json:"initiated_by" db:"initiated_by"`
	Reason         string    `json:"reason" db:"reason"`
	HoldDurationMs int64     `json:"hold_duration_ms" db:"hold_duration_ms"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

// TransferRequest is input for transferring a ticket
type TransferRequest struct {
	ToEngineerID string `json:"to_engineer_id" binding:"required"`
	InitiatedBy  string `json:"initiated_by" binding:"required"`
	Reason       string `json:"reason" binding:"required"`
}
