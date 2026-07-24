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
