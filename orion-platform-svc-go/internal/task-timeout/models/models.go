package models

import "time"

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

// TimeoutAction represents the action taken when a task times out.
type TimeoutAction string

const (
	TimeoutActionRemind      TimeoutAction = "remind"
	TimeoutActionEscalate    TimeoutAction = "escalate"
	TimeoutActionAutoComplete TimeoutAction = "auto_complete"
	TimeoutActionCancel      TimeoutAction = "cancel"
)

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

// TimeoutTask holds information about a task that has exceeded its due date.
type TimeoutTask struct {
	TaskID        string        `json:"task_id" db:"task_id"`
	Title         string        `json:"title" db:"title"`
	InstanceID    string        `json:"instance_id" db:"instance_id"`
	DueDate       time.Time     `json:"due_date" db:"due_date"`
	ActualDueDate *time.Time    `json:"actual_due_date,omitempty" db:"actual_due_date"`
	OverdueHours  float64       `json:"overdue_hours" db:"overdue_hours"`
	TimeoutAction TimeoutAction `json:"timeout_action" db:"timeout_action"`
	Status        string        `json:"status" db:"status"`
	CreatedAt     time.Time     `json:"created_at" db:"created_at"`
}

// TimeoutCheckerStatus holds the health/status of the timeout checker.
type TimeoutCheckerStatus struct {
	IsRunning           bool          `json:"is_running"`
	CheckIntervalMs     int64         `json:"check_interval_ms"`
	FirstRemindHours    int           `json:"first_remind_hours"`
	EscalateHours       int           `json:"escalate_hours"`
	AutoCompleteHours   int           `json:"auto_complete_hours"`
	DefaultTimeoutAction TimeoutAction `json:"default_timeout_action"`
	LastCheckAt         *time.Time    `json:"last_check_at,omitempty"`
	TotalChecked        int64         `json:"total_checked"`
}

// ---------------------------------------------------------------------------
// Request / Response models
// ---------------------------------------------------------------------------

// CheckNowRequest is the optional request body for triggering an immediate check.
type CheckNowRequest struct {
	// Action overrides the default timeout action for this manual check.
	Action *TimeoutAction `json:"action"`
}

// CheckNowResponse wraps the result of a manual check trigger.
type CheckNowResponse struct {
	CheckedTasks int64             `json:"checked_tasks"`
	Tasks        []CheckNowTask    `json:"tasks"`
}

// CheckNowTask is a summary of a timed-out task returned from a manual check.
type CheckNowTask struct {
	TaskID        string        `json:"task_id"`
	Title         string        `json:"title"`
	OverdueHours  float64       `json:"overdue_hours"`
	Action        TimeoutAction `json:"action"`
}

// TimedOutListResponse wraps the list of currently timed-out tasks.
type TimedOutListResponse struct {
	Tasks []TimedOutTask `json:"data"`
}

// TimedOutTask is the response shape for a single timed-out task.
type TimedOutTask struct {
	Task          TimeoutTask   `json:"task"`
	OverdueHours  float64       `json:"overdue_hours"`
	TimeoutAction TimeoutAction `json:"timeout_action"`
}
