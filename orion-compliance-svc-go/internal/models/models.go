package models

import (
	"database/sql/driver"
	"fmt"
	"time"
)

// ==================== Status Types ====================

// ReportStatus represents the lifecycle status of a compliance report.
type ReportStatus string

const (
	ReportStatusDraft    ReportStatus = "draft"
	ReportStatusRunning  ReportStatus = "running"
	ReportStatusCompleted ReportStatus = "completed"
	ReportStatusFailed   ReportStatus = "failed"
)

// FindingSeverity represents the severity level of a compliance finding.
type FindingSeverity string

const (
	FindingSeverityCritical FindingSeverity = "critical"
	FindingSeverityHigh     FindingSeverity = "high"
	FindingSeverityMedium   FindingSeverity = "medium"
	FindingSeverityLow      FindingSeverity = "low"
	FindingSeverityInfo     FindingSeverity = "info"
)

// FindingStatus represents the pass/fail status of a compliance finding.
type FindingStatus string

const (
	FindingStatusPass          FindingStatus = "pass"
	FindingStatusFail          FindingStatus = "fail"
	FindingStatusNotApplicable FindingStatus = "not_applicable"
)

// ==================== Entities ====================

// ComplianceReport represents a compliance assessment report.
type ComplianceReport struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description *string   `db:"description" json:"description,omitempty"`
	Framework   string    `db:"framework" json:"framework"`
	Status      ReportStatus `db:"status" json:"status"`
	Score       *float64  `db:"score" json:"score,omitempty"`
	Findings    JSONB     `db:"findings" json:"findings,omitempty"`
	ScheduleID  *string   `db:"schedule_id" json:"schedule_id,omitempty"`
	TriggeredBy string    `db:"triggered_by" json:"triggered_by"`
	StartedAt   *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// ComplianceFinding represents a single finding within a compliance report.
type ComplianceFinding struct {
	RuleID      string         `json:"rule_id"`
	RuleName    string         `json:"rule_name"`
	Severity    FindingSeverity `json:"severity"`
	Status      FindingStatus   `json:"status"`
	Details     *string        `json:"details,omitempty"`
	ResourceType *string       `json:"resource_type,omitempty"`
	ResourceID  *string        `json:"resource_id,omitempty"`
}

// ComplianceSchedule represents a recurring compliance scan schedule.
type ComplianceSchedule struct {
	ID            string     `db:"id" json:"id"`
	TenantID      string     `db:"tenant_id" json:"tenant_id"`
	Name          string     `db:"name" json:"name"`
	Framework     string     `db:"framework" json:"framework"`
	CronExpression string    `db:"cron_expression" json:"cron_expression"`
	Enabled       bool       `db:"enabled" json:"enabled"`
	LastRunAt     *time.Time `db:"last_run_at" json:"last_run_at,omitempty"`
	NextRunAt     *time.Time `db:"next_run_at" json:"next_run_at,omitempty"`
	CreatedBy     *string    `db:"created_by" json:"created_by,omitempty"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updated_at"`
}

// ==================== JSONB Type ====================

// JSONB is a custom type for PostgreSQL JSONB columns.
type JSONB []byte

// Value implements the driver.Valuer interface for JSONB storage.
func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return j, nil
}

// Scan implements the sql.Scanner interface for JSONB retrieval.
func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		*j = v
	case string:
		*j = []byte(v)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
	return nil
}

// ==================== DTOs ====================

// CreateReportInput is the input for creating a compliance report.
type CreateReportInput struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Framework   string `json:"framework" binding:"required"`
	TriggeredBy string `json:"triggered_by"`
	ScheduleID  string `json:"schedule_id"`
}

// UpdateReportInput is the input for updating a compliance report.
type UpdateReportInput struct {
	Name        *string         `json:"name,omitempty"`
	Description *string         `json:"description,omitempty"`
	Status      *ReportStatus   `json:"status,omitempty"`
	Score       *float64        `json:"score,omitempty"`
	Findings    []ComplianceFinding `json:"findings,omitempty"`
}

// CreateScheduleInput is the input for creating a compliance schedule.
type CreateScheduleInput struct {
	Name          string `json:"name" binding:"required"`
	Framework     string `json:"framework" binding:"required"`
	CronExpression string `json:"cron_expression" binding:"required"`
	Enabled       *bool  `json:"enabled,omitempty"`
}

// UpdateScheduleInput is the input for updating a compliance schedule.
type UpdateScheduleInput struct {
	Name          *string `json:"name,omitempty"`
	Framework     *string `json:"framework,omitempty"`
	CronExpression *string `json:"cron_expression,omitempty"`
	Enabled       *bool   `json:"enabled,omitempty"`
}

// ==================== Framework Info ====================

// ComplianceFrameworkInfo represents a supported compliance framework.
type ComplianceFrameworkInfo struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	Version         string   `json:"version"`
	Categories      []string `json:"categories"`
	TotalControls   int      `json:"total_controls"`
	URL             string   `json:"url,omitempty"`
}

// ==================== Pagination ====================

// PaginatedRequest provides pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

// Offset calculates the SQL offset from page and page size.
func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

// Limit returns the SQL limit, capped at 100.
func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
