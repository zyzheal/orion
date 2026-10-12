package models

import "time"

// InspectionSchedule defines a scheduled inspection task.
type InspectionSchedule struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenantId" db:"tenant_id"`
	Name          string    `json:"name" db:"name"`
	CronExpr      string    `json:"cronExpr" db:"cron_expr"`
	TemplateID    string    `json:"templateId" db:"template_id"`
	TargetConfig  map[string]any `json:"targetConfig" db:"target_config"`
	NextRunAt     *time.Time `json:"nextRunAt" db:"next_run_at"`
	LastRunAt     *time.Time `json:"lastRunAt" db:"last_run_at"`
	LastResult    string    `json:"lastResult" db:"last_result"`
	Enabled       bool      `json:"enabled" db:"enabled"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateScheduleRequest is the request body for creating a schedule.
type CreateScheduleRequest struct {
	Name         string         `json:"name" binding:"required"`
	CronExpr     string         `json:"cronExpr" binding:"required"`
	TemplateID   string         `json:"templateId" binding:"required"`
	TargetConfig map[string]any `json:"targetConfig"`
	Enabled      bool           `json:"enabled"`
	TenantID     *string        `json:"tenantId"`
}

// UpdateScheduleRequest is the request body for updating a schedule.
type UpdateScheduleRequest struct {
	Name         *string        `json:"name"`
	CronExpr     *string        `json:"cronExpr"`
	TemplateID   *string        `json:"templateId"`
	TargetConfig map[string]any `json:"targetConfig"`
	Enabled      *bool          `json:"enabled"`
}
