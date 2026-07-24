package models

import "time"

// Schedule represents an on-call schedule.
type Schedule struct {
	ID          string    `json:"id" db:"id"`
	TenantID    string    `json:"tenantId" db:"tenant_id"`
	Name        string    `json:"name" db:"name"`
	Timezone    string    `json:"timezone" db:"timezone"`
	RotationType string   `json:"rotationType" db:"rotation_type"`
	StartDate   *time.Time `json:"startDate" db:"start_date"`
	EndDate     *time.Time `json:"endDate" db:"end_date"`
	Status      string    `json:"status" db:"status"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateScheduleRequest is the body for creating a schedule.
type CreateScheduleRequest struct {
	Name        string   `json:"name" binding:"required"`
	Timezone    string   `json:"timezone"`
	RotationType string  `json:"rotationType"`
	StartDate   *string  `json:"startDate"`
	EndDate     *string  `json:"endDate"`
	Status      string   `json:"status"`
}

// UpdateScheduleRequest is the body for updating a schedule.
type UpdateScheduleRequest struct {
	Name        *string  `json:"name"`
	Timezone    *string  `json:"timezone"`
	RotationType *string `json:"rotationType"`
	StartDate   *string  `json:"startDate"`
	EndDate     *string  `json:"endDate"`
	Status      *string  `json:"status"`
}

// Assignment represents an on-call assignment within a schedule.
type Assignment struct {
	ID          string    `json:"id" db:"id"`
	ScheduleID  string    `json:"scheduleId" db:"schedule_id"`
	AssigneeID  string    `json:"assigneeId" db:"assignee_id"`
	AssigneeName string   `json:"assigneeName" db:"assignee_name"`
	Role        string    `json:"role" db:"role"`
	StartTime   time.Time `json:"startTime" db:"start_time"`
	EndTime     time.Time `json:"endTime" db:"end_time"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
}

// CreateAssignmentRequest is the body for creating an assignment.
type CreateAssignmentRequest struct {
	ScheduleID   string `json:"scheduleId" binding:"required"`
	AssigneeID   string `json:"assigneeId" binding:"required"`
	AssigneeName string `json:"assigneeName" binding:"required"`
	Role         string `json:"role"`
	StartTime    string `json:"startTime" binding:"required"`
	EndTime      string `json:"endTime" binding:"required"`
}

// UpdateAssignmentRequest is the body for updating an assignment.
type UpdateAssignmentRequest struct {
	AssigneeID   *string `json:"assigneeId"`
	AssigneeName *string `json:"assigneeName"`
	Role         *string `json:"role"`
	StartTime    *string `json:"startTime"`
	EndTime      *string `json:"endTime"`
}

// Override represents a temporary substitution for an on-call assignment.
type Override struct {
	ID          string    `json:"id" db:"id"`
	ScheduleID  string    `json:"scheduleId" db:"schedule_id"`
	AssigneeID  string    `json:"assigneeId" db:"assignee_id"`
	AssigneeName string   `json:"assigneeName" db:"assignee_name"`
	Reason      *string   `json:"reason" db:"reason"`
	StartTime   time.Time `json:"startTime" db:"start_time"`
	EndTime     time.Time `json:"endTime" db:"end_time"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
}

// CreateOverrideRequest is the body for creating an override.
type CreateOverrideRequest struct {
	ScheduleID   string `json:"scheduleId" binding:"required"`
	AssigneeID   string `json:"assigneeId" binding:"required"`
	AssigneeName string `json:"assigneeName" binding:"required"`
	Reason       *string `json:"reason"`
	StartTime    string `json:"startTime" binding:"required"`
	EndTime      string `json:"endTime" binding:"required"`
}

// UpdateOverrideRequest is the body for updating an override.
type UpdateOverrideRequest struct {
	AssigneeID   *string `json:"assigneeId"`
	AssigneeName *string `json:"assigneeName"`
	Reason       *string `json:"reason"`
	StartTime    *string `json:"startTime"`
	EndTime      *string `json:"endTime"`
}

// CurrentOnCallResult is the result of a "who is on-call now" query.
type CurrentOnCallResult struct {
	ScheduleID string    `json:"scheduleId"`
	AssigneeID string    `json:"assigneeId"`
	AssigneeName string   `json:"assigneeName"`
	Role       string    `json:"role"`
	StartTime  time.Time `json:"startTime"`
	EndTime    time.Time `json:"endTime"`
}

// ListSchedulesResponse wraps the list of schedules.
type ListSchedulesResponse struct {
	Schedules []Schedule `json:"schedules"`
	Total     int        `json:"total"`
}

// ListAssignmentsResponse wraps the list of assignments.
type ListAssignmentsResponse struct {
	Assignments []Assignment `json:"assignments"`
	Total       int          `json:"total"`
	ScheduleID  string       `json:"scheduleId"`
}

// ListOverridesResponse wraps the list of overrides.
type ListOverridesResponse struct {
	Overrides []Override `json:"overrides"`
	Total     int        `json:"total"`
}
