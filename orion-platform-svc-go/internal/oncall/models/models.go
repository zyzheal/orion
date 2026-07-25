package models

import (
	"time"

	"github.com/google/uuid"
)

// Schedule represents an on-call schedule.
type Schedule struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	IsPrimary   bool      `json:"is_primary"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Rotation represents a rotation entry within a schedule.
type Rotation struct {
	ID         uuid.UUID `json:"id"`
	ScheduleID uuid.UUID `json:"schedule_id"`
	UserID     string    `json:"user_id"`
	UserName   string    `json:"user_name"`
	IsActive   bool      `json:"is_active"`
	StartDate  time.Time `json:"start_date"`
	EndDate    time.Time `json:"end_date"`
	CreatedAt  time.Time `json:"created_at"`
}

// EscalationPath defines the order of escalation.
type EscalationPath struct {
	ID          uuid.UUID `json:"id"`
	ScheduleID  uuid.UUID `json:"schedule_id"`
	Level       int       `json:"level"`
	UserID      string    `json:"user_id"`
	UserName    string    `json:"user_name"`
	IsCurrent   bool      `json:"is_current"`
}

// CreateScheduleRequest for creating a schedule.
type CreateScheduleRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	IsPrimary   *bool  `json:"is_primary"`
}

// AddRotationRequest for adding a rotation to a schedule.
type AddRotationRequest struct {
	UserID    string    `json:"user_id" binding:"required"`
	UserName  string    `json:"user_name" binding:"required"`
	StartDate time.Time `json:"start_date" binding:"required"`
	EndDate   time.Time `json:"end_date" binding:"required"`
}

// ScheduleResponse wraps schedule query results.
type ScheduleResponse struct {
	Total int64      `json:"total"`
	Data  []Schedule `json:"data"`
}

// CurrentOnCallResponse shows who is currently on-call.
type CurrentOnCallResponse struct {
	ScheduleID uuid.UUID `json:"schedule_id"`
	ScheduleName string   `json:"schedule_name"`
	UserID     string    `json:"user_id"`
	UserName   string    `json:"user_name"`
	StartDate  time.Time `json:"start_date"`
	EndDate    time.Time `json:"end_date"`
	Level      int       `json:"level"`
}

// ---------------------------------------------------------------------------
// Assignment — explicit assignment of a user to a schedule slot
// ---------------------------------------------------------------------------

// Assignment represents an on-call assignment.
type Assignment struct {
	ID         uuid.UUID `json:"id"`
	ScheduleID uuid.UUID `json:"schedule_id"`
	UserID     string    `json:"user_id"`
	UserName   string    `json:"user_name"`
	StartDate  time.Time `json:"start_date"`
	EndDate    time.Time `json:"end_date"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// CreateAssignmentRequest for creating an assignment.
type CreateAssignmentRequest struct {
	UserID    string    `json:"user_id" binding:"required"`
	UserName  string    `json:"user_name" binding:"required"`
	ScheduleID uuid.UUID `json:"schedule_id" binding:"required"`
	StartDate time.Time `json:"start_date" binding:"required"`
	EndDate   time.Time `json:"end_date" binding:"required"`
}

// UpdateAssignmentRequest for partially updating an assignment.
type UpdateAssignmentRequest struct {
	UserID    *string   `json:"user_id"`
	UserName  *string   `json:"user_name"`
	StartDate *time.Time `json:"start_date"`
	EndDate   *time.Time `json:"end_date"`
}

// ---------------------------------------------------------------------------
// Override — temporary override for an on-call schedule
// ---------------------------------------------------------------------------

// Override represents a temporary on-call override.
type Override struct {
	ID         uuid.UUID `json:"id"`
	ScheduleID uuid.UUID `json:"schedule_id"`
	UserID     string    `json:"user_id"`
	UserName   string    `json:"user_name"`
	Reason     string    `json:"reason"`
	StartDate  time.Time `json:"start_date"`
	EndDate    time.Time `json:"end_date"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// CreateOverrideRequest for creating an override.
type CreateOverrideRequest struct {
	UserID    string    `json:"user_id" binding:"required"`
	UserName  string    `json:"user_name" binding:"required"`
	ScheduleID uuid.UUID `json:"schedule_id" binding:"required"`
	Reason    string    `json:"reason"`
	StartDate time.Time `json:"start_date" binding:"required"`
	EndDate   time.Time `json:"end_date" binding:"required"`
}

// UpdateOverrideRequest for partially updating an override.
type UpdateOverrideRequest struct {
	UserID    *string    `json:"user_id"`
	UserName  *string    `json:"user_name"`
	Reason    *string    `json:"reason"`
	StartDate *time.Time `json:"start_date"`
	EndDate   *time.Time `json:"end_date"`
}

// ---------------------------------------------------------------------------
// Schedule update
// ---------------------------------------------------------------------------

// UpdateScheduleRequest for partially updating a schedule.
type UpdateScheduleRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	IsPrimary   *bool   `json:"is_primary"`
}

// ---------------------------------------------------------------------------
// Get on-call now result
// ---------------------------------------------------------------------------

// CurrentOnCallResult returns who is currently on-call for a schedule.
type CurrentOnCallResult struct {
	UserID     string    `json:"user_id"`
	UserName   string    `json:"user_name"`
	IsOverride bool      `json:"is_override"`
	StartDate  time.Time `json:"start_date"`
	EndDate    time.Time `json:"end_date"`
}
