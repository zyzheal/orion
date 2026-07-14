package models

import "time"

// ComplianceReport represents a compliance audit report.
type ComplianceReport struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenantId"`
	Name        string     `db:"name" json:"name"`
	Description *string    `db:"description" json:"description"`
	Framework   string     `db:"framework" json:"framework"`
	TriggeredBy string     `db:"triggered_by" json:"triggeredBy"`
	ScheduleID  *string    `db:"schedule_id" json:"scheduleId"`
	Status      string     `db:"status" json:"status"`
	CreatedAt   time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateComplianceReportRequest is the request body for creating a compliance report.
type CreateComplianceReportRequest struct {
	Name        string  `json:"name" binding:"required"`
	Framework   string  `json:"framework" binding:"required"`
	Description *string `json:"description"`
	TriggeredBy *string `json:"triggeredBy"`
	ScheduleID  *string `json:"scheduleId"`
}

// UpdateComplianceReportRequest is the request body for updating a compliance report.
type UpdateComplianceReportRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Framework   *string `json:"framework"`
	TriggeredBy *string `json:"triggeredBy"`
	Status      *string `json:"status"`
}

// ComplianceSchedule represents a scheduled compliance audit.
type ComplianceSchedule struct {
	ID             string     `db:"id" json:"id"`
	TenantID       string     `db:"tenant_id" json:"tenantId"`
	Name           string     `db:"name" json:"name"`
	Framework      string     `db:"framework" json:"framework"`
	CronExpression string     `db:"cron_expression" json:"cronExpression"`
	Enabled        bool       `db:"enabled" json:"enabled"`
	LastRunAt      *time.Time `db:"last_run_at" json:"lastRunAt"`
	CreatedAt      time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updatedAt"`
}

// CreateComplianceScheduleRequest is the request body for creating a compliance schedule.
type CreateComplianceScheduleRequest struct {
	Name           string  `json:"name" binding:"required"`
	Framework      string  `json:"framework" binding:"required"`
	CronExpression string  `json:"cronExpression" binding:"required"`
	Enabled        *bool   `json:"enabled"`
}
