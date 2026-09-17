package models

import "time"

// AssignmentRule defines automatic ticket assignment rules
type AssignmentRule struct {
	ID         string    `json:"id" db:"id"`
	Name       string    `json:"name" db:"name"`
	Categories []string  `json:"categories" db:"categories"`
	Assignee   string    `json:"assignee" db:"assignee"`
	Priorities []string  `json:"priorities,omitempty" db:"priorities"`
	Enabled    bool      `json:"enabled" db:"enabled"`
	Order      int       `json:"order" db:"order"`
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

// TransferRecord tracks a ticket transfer between engineers. The db tags name
// 076_create_ticketing_tables.sql's columns; the json tags are the API contract
// and are unchanged.
//
//   FromEngineerID -> from_user_id   (076's column is from_user_id, there is no
//                                     from_engineer_id)
//   ToEngineerID   -> to_user_id     (076's column is to_user_id, there is no
//                                     to_engineer_id)
//
// InitiatedBy / HoldDurationMs have no column in 076; 696_add_ticket_relation_transfer_columns.sql
// adds them because TransferRequest marks initiated_by binding:"required" and
// the transfer handlers return hold_duration_ms.
type TransferRecord struct {
	ID             string    `json:"id" db:"id"`
	TicketID       string    `json:"ticket_id" db:"ticket_id"`
	FromEngineerID string    `json:"from_engineer_id" db:"from_user_id"`
	ToEngineerID   string    `json:"to_engineer_id" db:"to_user_id"`
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
