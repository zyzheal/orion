package models

import "time"

// ReportDefinition represents a report layout definition.
type ReportDefinition struct {
	ID                string                 `json:"id" db:"id"`
	TenantID          string                 `json:"tenantId" db:"tenant_id"`
	Name              string                 `json:"name" db:"name"`
	Description       *string                `json:"description" db:"description"`
	Category          *string                `json:"category" db:"category"`
	Layout            *string                `json:"layout" db:"layout"`               // JSONB
	Components        *string                `json:"components" db:"components"`         // JSONB
	DatasourceBindings *string               `json:"datasourceBindings" db:"datasource_bindings"` // JSONB
	TemplateID        *string                `json:"templateId" db:"template_id"`
	Status            string                 `json:"status" db:"status"`
	Enabled           bool                   `json:"enabled" db:"enabled"`
	CreatedBy         string                 `json:"createdBy" db:"created_by"`
	CreatedAt         time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt         time.Time              `json:"updatedAt" db:"updated_at"`
}

// CreateReportRequest is the body for creating a report.
type CreateReportRequest struct {
	Name              string                 `json:"name" binding:"required"`
	Description       *string                `json:"description"`
	Category          *string                `json:"category"`
	Layout            *string                `json:"layout"`
	Components        *string                `json:"components"`
	DatasourceBindings *string               `json:"datasourceBindings"`
	TemplateID        *string                `json:"templateId"`
	Enabled           *bool                  `json:"enabled"`
	CreatedBy         string                 `json:"createdBy"`
	TenantID          *string                `json:"tenantId"`
}

// UpdateReportRequest is the body for updating a report.
type UpdateReportRequest struct {
	Name               *string `json:"name"`
	Description        *string `json:"description"`
	Category           *string `json:"category"`
	Layout             *string `json:"layout"`
	Components         *string `json:"components"`
	DatasourceBindings *string `json:"datasourceBindings"`
	TemplateID         *string `json:"templateId"`
	Status             *string `json:"status"`
	Enabled            *bool   `json:"enabled"`
	User               *string `json:"user"`
}

// ListReportsRequest is the query for listing reports.
type ListReportsRequest struct {
	Category *string `json:"category"`
	Enabled  *bool   `json:"enabled"`
	Keyword  *string `json:"keyword"`
	Limit    int     `json:"limit"`
	Offset   int     `json:"offset"`
}

// ReportDatasource represents a data source configuration.
type ReportDatasource struct {
	ID            string     `json:"id" db:"id"`
	TenantID      string     `json:"tenantId" db:"tenant_id"`
	ReportID      *string    `json:"reportId" db:"report_id"`
	Name          string     `json:"name" db:"name"`
	DatasourceType string    `json:"datasourceType" db:"datasource_type"`
	Config        *string    `json:"config" db:"config"` // JSONB
	RefreshInterval *int     `json:"refreshInterval" db:"refresh_interval"`
	Status        string     `json:"status" db:"status"`
	CreatedAt     time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time  `json:"updatedAt" db:"updated_at"`
}

// CreateDatasourceRequest is the body for creating a datasource.
type CreateDatasourceRequest struct {
	Name            string     `json:"name" binding:"required"`
	DatasourceType  string     `json:"datasourceType" binding:"required"`
	Config          *string    `json:"config" binding:"required"` // JSONB
	RefreshInterval *int       `json:"refreshInterval"`
	ReportID        *string    `json:"reportId"`
	TenantID        *string    `json:"tenantId"`
}

// UpdateDatasourceRequest is the body for updating a datasource.
type UpdateDatasourceRequest struct {
	Name            *string  `json:"name"`
	DatasourceType  *string  `json:"datasourceType"`
	Config          *string  `json:"config"`
	RefreshInterval *int     `json:"refreshInterval"`
	ReportID        *string  `json:"reportId"`
	Status          *string  `json:"status"`
}

// ReportSchedule represents a cron-based schedule.
type ReportSchedule struct {
	ID            string     `json:"id" db:"id"`
	TenantID      string     `json:"tenantId" db:"tenant_id"`
	ReportID      string     `json:"reportId" db:"report_id"`
	CronExpr      string     `json:"cronExpr" db:"cron_expr"`
	Timezone      string     `json:"timezone" db:"timezone"`
	ExportFormat  string     `json:"exportFormat" db:"export_format"`
	Recipients    *string    `json:"recipients" db:"recipients"` // JSONB
	Enabled       bool       `json:"enabled" db:"enabled"`
	CreatedAt     time.Time  `json:"createdAt" db:"created_at"`
}

// CreateScheduleRequest is the body for creating a schedule.
type CreateScheduleRequest struct {
	ReportID     string  `json:"reportId" binding:"required"`
	CronExpr     string  `json:"cronExpression" binding:"required"`
	ExportFormat string  `json:"exportFormat" binding:"required"`
	Recipients   *string `json:"recipients"`
	Enabled      *bool   `json:"enabled"`
	Timezone     *string `json:"timezone"`
	TenantID     *string `json:"tenantId"`
}

// UpdateScheduleRequest is the body for updating a schedule.
type UpdateScheduleRequest struct {
	CronExpr     *string `json:"cronExpression"`
	ExportFormat *string `json:"exportFormat"`
	Recipients   *string `json:"recipients"`
	Enabled      *bool   `json:"enabled"`
	Timezone     *string `json:"timezone"`
}

// ReportExecution represents an execution record.
type ReportExecution struct {
	ID            string     `json:"id" db:"id"`
	TenantID      string     `json:"tenantId" db:"tenant_id"`
	ReportID      string     `json:"reportId" db:"report_id"`
	ScheduleID    *string    `json:"scheduleId" db:"schedule_id"`
	Status        string     `json:"status" db:"status"`
	OutputPath    *string    `json:"outputPath" db:"output_path"`
	ErrorMessage  *string    `json:"errorMessage" db:"error_message"`
	StartedAt     time.Time  `json:"startedAt" db:"started_at"`
	FinishedAt    *time.Time `json:"finishedAt" db:"finished_at"`
	CreatedAt     time.Time  `json:"createdAt" db:"created_at"`
	CreatedBy     *string    `json:"createdBy" db:"created_by"`
}

// ExecuteReportRequest is the body for executing a report.
type ExecuteReportRequest struct {
	Parameters map[string]interface{} `json:"parameters"`
	Format     *string                `json:"format"`
	User       *string                `json:"user"`
}

// PreviewReportRequest is the body for previewing a report.
type PreviewReportRequest struct {
	Parameters map[string]interface{} `json:"parameters"`
}

// PreviewReportResult is the result of a report preview.
type PreviewReportResult struct {
	ReportID  string                 `json:"reportId"`
	Data      map[string]interface{} `json:"data"`
	Components map[string]interface{} `json:"components"`
	Message   string                 `json:"message"`
}

// PaginatedResponse wraps paginated data.
type PaginatedResponse struct {
	Data     any   `json:"data"`
	Total    int   `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
}
