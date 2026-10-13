package models

import "time"

type Shift struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenantId" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Team        *string   `json:"team" db:"team"`
	Pattern     string    `json:"pattern" db:"pattern"`
	StartTime   *string   `json:"startTime" db:"start_time"`
	EndTime     *string   `json:"endTime" db:"end_time"`
	Weekdays    []int     `json:"weekdays" db:"weekdays"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

type Assignment struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	ShiftID   string    `json:"shiftId" db:"shift_id"`
	UserID    string    `json:"userId" db:"user_id"`
	Role      string    `json:"role" db:"role"`
	StartTime time.Time `json:"startTime" db:"start_time"`
	EndTime   time.Time `json:"endTime" db:"end_time"`
	Assigned  bool      `json:"assigned" db:"assigned"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

type CreateShiftRequest struct {
	Name      string  `json:"name" binding:"required"`
	Team      *string `json:"team"`
	Pattern   string  `json:"pattern"`
	StartTime *string `json:"startTime"`
	EndTime   *string `json:"endTime"`
	Weekdays  []int   `json:"weekdays"`
	Enabled   bool    `json:"enabled"`
	TenantID  *string `json:"tenantId"`
}

// UpdateShiftRequest uses pointer fields so callers can distinguish
// "not provided" from "set to zero value".
type UpdateShiftRequest struct {
	Name      *string `json:"name"`
	Team      *string `json:"team"`
	Pattern   *string `json:"pattern"`
	StartTime *string `json:"startTime"`
	EndTime   *string `json:"endTime"`
	Weekdays  []int   `json:"weekdays"`
	Enabled   *bool   `json:"enabled"`
}

type CreateAssignmentRequest struct {
	UserID    string    `json:"userId" binding:"required"`
	Role      string    `json:"role"`
	StartTime time.Time `json:"startTime" binding:"required"`
	EndTime   time.Time `json:"endTime" binding:"required"`
}
