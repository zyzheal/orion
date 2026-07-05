package models

import "time"

// ── Job Status & Type ─────────────────────────────────────────────────────

// JobStatus represents the lifecycle of a scheduled job.
type JobStatus string

const (
	JobActive   JobStatus = "active"
	JobPaused   JobStatus = "paused"
	JobDisabled JobStatus = "disabled"
)

// JobType represents the type of scheduled job.
type JobType string

const (
	JobTypeCron     JobType = "cron"
	JobTypeOnce     JobType = "once"
	JobTypeInterval JobType = "interval"
)

// ── Cron Job ──────────────────────────────────────────────────────────────

// Job represents a scheduled job.
type Job struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	Name        string     `db:"name" json:"name"`
	Description string     `db:"description" json:"description"`
	Type        JobType    `db:"type" json:"type"`
	CronExpr    *string    `db:"cron_expr" json:"cron_expr,omitempty"`
	IntervalSec *int       `db:"interval_sec" json:"interval_sec,omitempty"`
	Status      JobStatus  `db:"status" json:"status"`
	LastRunAt   *time.Time `db:"last_run_at" json:"last_run_at,omitempty"`
	NextRunAt   *time.Time `db:"next_run_at" json:"next_run_at,omitempty"`
	RunCount    int        `db:"run_count" json:"run_count"`
	MaxRuns     *int       `db:"max_runs" json:"max_runs,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updated_at"`
}

// JobRun represents a single execution of a job.
type JobRun struct {
	ID         string     `db:"id" json:"id"`
	JobID      string     `db:"job_id" json:"job_id"`
	Status     string     `db:"status" json:"status"`
	Error      *string    `db:"error" json:"error,omitempty"`
	StartedAt  time.Time  `db:"started_at" json:"started_at"`
	EndedAt    *time.Time `db:"ended_at" json:"ended_at,omitempty"`
	DurationMs int64      `db:"duration_ms" json:"duration_ms"`
}

// ── Request DTOs ──────────────────────────────────────────────────────────

// CreateJobRequest is the input for creating a scheduled job.
type CreateJobRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description"`
	Type        JobType `json:"type" binding:"required"`
	CronExpr    *string `json:"cron_expr"`
	IntervalSec *int    `json:"interval_sec"`
	MaxRuns     *int    `json:"max_runs"`
}

// UpdateJobRequest is the input for updating a scheduled job.
type UpdateJobRequest struct {
	Name        *string    `json:"name"`
	Description *string    `json:"description"`
	CronExpr    *string    `json:"cron_expr"`
	IntervalSec *int       `json:"interval_sec"`
	MaxRuns     *int       `json:"max_runs"`
	Status      *JobStatus `json:"status"`
}

// PaginatedRequest provides pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}

// ── On-Call Domain ────────────────────────────────────────────────────────

// RotationType defines how on-call duty rotates among team members.
type RotationType string

const (
	RotationDaily   RotationType = "daily"
	RotationWeekly  RotationType = "weekly"
	RotationMonthly RotationType = "monthly"
)

// EscalationRule defines a single escalation tier.
type EscalationRule struct {
	Level          int      `json:"level"`
	TimeoutMinutes int      `json:"timeout_minutes"`
	Targets        []string `json:"targets"`
}

// OnCallSchedule represents a named on-call rotation schedule.
type OnCallSchedule struct {
	ID                 string           `db:"id" json:"id"`
	TenantID           string           `db:"tenant_id" json:"tenant_id"`
	Name               string           `db:"name" json:"name"`
	Timezone           string           `db:"timezone" json:"timezone"`
	RotationType       RotationType     `db:"rotation_type" json:"rotation_type"`
	RotationStartHour  int              `db:"rotation_start_hour" json:"rotation_start_hour"`
	TeamMembers        []string         `db:"team_members" json:"team_members"`
	StartDate          time.Time        `db:"start_date" json:"start_date"`
	EndDate            *time.Time       `db:"end_date" json:"end_date,omitempty"`
	Escalations        []EscalationRule `db:"escalations" json:"escalations"`
	CreatedAt          time.Time        `db:"created_at" json:"created_at"`
	UpdatedAt          time.Time        `db:"updated_at" json:"updated_at"`
}

// OnCallAssignment records which user is on-call during a time window.
type OnCallAssignment struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	ScheduleID string    `db:"schedule_id" json:"schedule_id"`
	UserID     string    `db:"user_id" json:"user_id"`
	StartTime  time.Time `db:"start_time" json:"start_time"`
	EndTime    time.Time `db:"end_time" json:"end_time"`
}

// OnCallOverride records a temporary substitution of one user for another.
type OnCallOverride struct {
	ID              string     `db:"id" json:"id"`
	TenantID        string     `db:"tenant_id" json:"tenant_id"`
	ScheduleID      string     `db:"schedule_id" json:"schedule_id"`
	OriginalUserID  string     `db:"original_user_id" json:"original_user_id"`
	OverrideUserID  string     `db:"override_user_id" json:"override_user_id"`
	StartTime       time.Time  `db:"start_time" json:"start_time"`
	EndTime         time.Time  `db:"end_time" json:"end_time"`
	Reason          *string    `db:"reason" json:"reason,omitempty"`
}

// OnCallCheckResult is the answer to "who is on-call right now?".
type OnCallCheckResult struct {
	IsOnCall         bool     `json:"is_on_call"`
	PrimaryUserID    *string  `json:"primary_user_id,omitempty"`
	EscalationTargets []string `json:"escalation_targets,omitempty"`
}

// ── On-Call Request DTOs ──────────────────────────────────────────────────

// CreateScheduleRequest is the input for creating an on-call schedule.
type CreateScheduleRequest struct {
	Name              string           `json:"name" binding:"required"`
	Timezone          string           `json:"timezone" binding:"required"`
	RotationType      RotationType     `json:"rotation_type" binding:"required"`
	TeamMembers       []string         `json:"team_members" binding:"required,min=1"`
	RotationStartHour int              `json:"rotation_start_hour"`
	Escalations       []EscalationRule `json:"escalations"`
}

// CreateOverrideRequest is the input for creating an on-call override.
type CreateOverrideRequest struct {
	OriginalUserID string    `json:"original_user_id" binding:"required"`
	OverrideUserID string    `json:"override_user_id" binding:"required"`
	StartTime      time.Time `json:"start_time" binding:"required"`
	EndTime        time.Time `json:"end_time" binding:"required"`
	Reason         *string   `json:"reason"`
}
