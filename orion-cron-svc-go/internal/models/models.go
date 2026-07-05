package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ── JSONB helper ─────────────────────────────────────────────

type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// StringSlice is a JSONB-backed []string used for team_members.
type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	if s == nil {
		return []byte("[]"), nil
	}
	return json.Marshal(s)
}

func (s *StringSlice) Scan(src interface{}) error {
	if src == nil {
		*s = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, s)
	case string:
		return json.Unmarshal([]byte(v), s)
	default:
		return fmt.Errorf("cannot scan %T into StringSlice", src)
	}
}

// EscalationSlice is a JSONB-backed []EscalationRule.
type EscalationSlice []EscalationRule

func (e EscalationSlice) Value() (driver.Value, error) {
	if e == nil {
		return []byte("[]"), nil
	}
	return json.Marshal(e)
}

func (e *EscalationSlice) Scan(src interface{}) error {
	if src == nil {
		*e = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, e)
	case string:
		return json.Unmarshal([]byte(v), e)
	default:
		return fmt.Errorf("cannot scan %T into EscalationSlice", src)
	}
}

// ── CronJob ──────────────────────────────────────────────────

type CronJob struct {
	ID             string     `db:"id" json:"id"`
	TenantID       string     `db:"tenant_id" json:"tenant_id"`
	Name           string     `db:"name" json:"name"`
	Schedule       string     `db:"schedule" json:"schedule"`
	Command        string     `db:"command" json:"command"`
	Payload        JSONB      `db:"payload" json:"payload,omitempty"`
	Enabled        bool       `db:"enabled" json:"enabled"`
	LastRunAt      *time.Time `db:"last_run_at" json:"last_run_at,omitempty"`
	LastRunStatus  *string    `db:"last_run_status" json:"last_run_status,omitempty"`
	NextRunAt      *time.Time `db:"next_run_at" json:"next_run_at,omitempty"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updated_at"`
}

type CreateCronJobRequest struct {
	Name     string `json:"name" binding:"required"`
	Schedule string `json:"schedule" binding:"required"`
	Command  string `json:"command" binding:"required"`
	Payload  JSONB  `json:"payload"`
}

type UpdateCronJobRequest struct {
	Name     *string `json:"name"`
	Schedule *string `json:"schedule"`
	Command  *string `json:"command"`
	Payload  *JSONB  `json:"payload"`
}

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

// ── CronExecution ────────────────────────────────────────────

type CronExecution struct {
	ID          string     `db:"id" json:"execution_id"`
	JobID       string     `db:"job_id" json:"job_id"`
	StartedAt   time.Time  `db:"started_at" json:"started_at"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	Status      string     `db:"status" json:"status"`
	Output      *string    `db:"output" json:"output,omitempty"`
	Error       *string    `db:"error" json:"error,omitempty"`
}

// ── EscalationRule ───────────────────────────────────────────

type EscalationRule struct {
	Level          int      `json:"level"`
	TimeoutMinutes int      `json:"timeout_minutes"`
	Targets        []string `json:"targets"`
}

// ── OnCallSchedule ───────────────────────────────────────────

type OnCallSchedule struct {
	ID                string          `db:"id" json:"id"`
	TenantID          string          `db:"tenant_id" json:"tenant_id"`
	Name              string          `db:"name" json:"name"`
	Timezone          string          `db:"timezone" json:"timezone"`
	RotationType      string          `db:"rotation_type" json:"rotation_type"`
	RotationStartHour int             `db:"rotation_start_hour" json:"rotation_start_hour"`
	TeamMembers       StringSlice     `db:"team_members" json:"team_members"`
	StartDate         time.Time       `db:"start_date" json:"start_date"`
	EndDate           *time.Time      `db:"end_date" json:"end_date,omitempty"`
	Escalations       EscalationSlice `db:"escalations" json:"escalations"`
	CreatedAt         time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time       `db:"updated_at" json:"updated_at"`
}

type CreateOnCallScheduleRequest struct {
	Name              string          `json:"name" binding:"required"`
	Timezone          string          `json:"timezone"`
	RotationType      string          `json:"rotation_type" binding:"required,oneof=daily weekly monthly"`
	RotationStartHour int             `json:"rotation_start_hour"`
	TeamMembers       []string        `json:"team_members" binding:"required,min=1"`
	Escalations       []EscalationRule `json:"escalations"`
}

// ── OnCallAssignment ─────────────────────────────────────────

type OnCallAssignment struct {
	ID         string    `db:"id" json:"id"`
	ScheduleID string    `db:"schedule_id" json:"schedule_id"`
	UserID     string    `db:"user_id" json:"user_id"`
	StartTime  time.Time `db:"start_time" json:"start_time"`
	EndTime    time.Time `db:"end_time" json:"end_time"`
}

// ── OnCallOverride ───────────────────────────────────────────

type OnCallOverride struct {
	ID             string    `db:"id" json:"id"`
	ScheduleID     string    `db:"schedule_id" json:"schedule_id"`
	OriginalUserID string    `db:"original_user_id" json:"original_user_id"`
	OverrideUserID string    `db:"override_user_id" json:"override_user_id"`
	StartTime      time.Time `db:"start_time" json:"start_time"`
	EndTime        time.Time `db:"end_time" json:"end_time"`
	Reason         *string   `db:"reason" json:"reason,omitempty"`
}

type CreateOnCallOverrideRequest struct {
	OriginalUserID string  `json:"original_user_id" binding:"required"`
	OverrideUserID string  `json:"override_user_id" binding:"required"`
	StartTime      string  `json:"start_time" binding:"required"`
	EndTime        string  `json:"end_time" binding:"required"`
	Reason         *string `json:"reason"`
}

// ── OnCallCheckResult ────────────────────────────────────────

type OnCallCheckResult struct {
	IsOnCall         bool     `json:"is_on_call"`
	PrimaryUserID    *string  `json:"primary_user_id,omitempty"`
	EscalationTargets []string `json:"escalation_targets,omitempty"`
}
