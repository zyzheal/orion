package models

import "time"

// Valid suspend reasons
const (
	SuspendVacation    = "vacation"
	SuspendSickLeave   = "sick-leave"
	SuspendTraining    = "training"
	SuspendReassignment = "reassignment"
	SuspendOther       = "other"
)

var ValidSuspendReasons = []string{
	SuspendVacation, SuspendSickLeave, SuspendTraining, SuspendReassignment, SuspendOther,
}

// SuspendRecord represents an engineer suspension
type SuspendRecord struct {
	ID                  string     `json:"id" db:"id"`
	EngineerID          string     `json:"engineer_id" db:"engineer_id"`
	Reason              string     `json:"reason" db:"reason"`
	Status              string     `json:"status" db:"status"` // pending, active, ended, cancelled
	StartTime           time.Time  `json:"start_time" db:"start_time"`
	EndTime             time.Time  `json:"end_time" db:"end_time"`
	BackupEngineerID    string     `json:"backup_engineer_id,omitempty" db:"backup_engineer_id"`
	AutoReassignPending bool       `json:"auto_reassign_pending" db:"auto_reassign_pending"`
	PauseSLAForPending  bool       `json:"pause_sla_for_pending" db:"pause_sla_for_pending"`
	Notes               string     `json:"notes,omitempty" db:"notes"`
	CreatedBy           string     `json:"created_by" db:"created_by"`
	ActivatedAt         *time.Time `json:"activated_at,omitempty" db:"activated_at"`
	EndedAt             *time.Time `json:"ended_at,omitempty" db:"ended_at"`
	CancelledAt         *time.Time `json:"cancelled_at,omitempty" db:"cancelled_at"`
	CreatedAt           time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at" db:"updated_at"`
}

// CreateSuspendRequest is input for creating a suspension
type CreateSuspendRequest struct {
	EngineerID          string `json:"engineer_id" binding:"required"`
	Reason              string `json:"reason" binding:"required"`
	StartTime           string `json:"start_time" binding:"required"`
	EndTime             string `json:"end_time" binding:"required"`
	BackupEngineerID    string `json:"backup_engineer_id"`
	AutoReassignPending bool   `json:"auto_reassign_pending"`
	PauseSLAForPending  bool   `json:"pause_sla_for_pending"`
	Notes               string `json:"notes"`
	CreatedBy           string `json:"created_by" binding:"required"`
}

// SuspendImpact shows the impact of an engineer's suspension
type SuspendImpact struct {
	EngineerID         string `json:"engineer_id"`
	SuspendID          string `json:"suspend_id"`
	PendingTickets     int    `json:"pending_tickets"`
	ActiveTickets      int    `json:"active_tickets"`
	BackupEngineerID   string `json:"backup_engineer_id,omitempty"`
	ReassignedTickets  int    `json:"reassigned_tickets"`
	PausedSLACount     int    `json:"paused_sla_count"`
}
