package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"time"
)

// ==================== JSONB Helpers ====================

// JSONMap represents a JSONB object for PostgreSQL storage.
type JSONMap map[string]interface{}

// Value implements the driver.Valuer interface for JSONB storage.
func (j JSONMap) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface for JSONB retrieval.
func (j *JSONMap) Scan(src interface{}) error {
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
		return fmt.Errorf("cannot scan %T into JSONMap", src)
	}
}

// JSONArray represents a JSONB array for PostgreSQL storage.
type JSONArray []interface{}

// Value implements the driver.Valuer interface for JSONB storage.
func (j JSONArray) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface for JSONB retrieval.
func (j *JSONArray) Scan(src interface{}) error {
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
		return fmt.Errorf("cannot scan %T into JSONArray", src)
	}
}

// ==================== Report Definition ====================

// ReportDefinition represents a report definition.
type ReportDefinition struct {
	ID                 string     `db:"id" json:"id"`
	TenantID           string     `db:"tenant_id" json:"tenant_id"`
	Name               string     `db:"name" json:"name"`
	Description        *string    `db:"description" json:"description,omitempty"`
	Category           *string    `db:"category" json:"category,omitempty"`
	Layout             JSONMap    `db:"layout" json:"layout"`
	Components         JSONArray  `db:"components" json:"components"`
	DatasourceBindings *JSONMap   `db:"datasource_bindings" json:"datasource_bindings,omitempty"`
	TemplateID         *string    `db:"template_id" json:"template_id,omitempty"`
	Enabled            bool       `db:"enabled" json:"enabled"`
	CreatedBy          *string    `db:"created_by" json:"created_by,omitempty"`
	CreatedAt          time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt          time.Time  `db:"updated_at" json:"updated_at"`
}

// CreateReportInput is the input for creating a report.
type CreateReportInput struct {
	Name               string            `json:"name" binding:"required"`
	Description        *string           `json:"description,omitempty"`
	Category           *string           `json:"category,omitempty"`
	Layout             JSONMap           `json:"layout,omitempty"`
	Components         JSONArray         `json:"components,omitempty"`
	DatasourceBindings *JSONMap          `json:"datasource_bindings,omitempty"`
	TemplateID         *string           `json:"template_id,omitempty"`
	Enabled            *bool             `json:"enabled,omitempty"`
	CreatedBy          *string           `json:"created_by,omitempty"`
}

// UpdateReportInput is the input for updating a report.
type UpdateReportInput struct {
	Name               *string           `json:"name,omitempty"`
	Description        *string           `json:"description,omitempty"`
	Category           *string           `json:"category,omitempty"`
	Layout             *JSONMap          `json:"layout,omitempty"`
	Components         *JSONArray        `json:"components,omitempty"`
	DatasourceBindings *JSONMap          `json:"datasource_bindings,omitempty"`
	TemplateID         *string           `json:"template_id,omitempty"`
	Enabled            *bool             `json:"enabled,omitempty"`
}

// ReportDefinitionFilters represents filters for listing reports.
type ReportDefinitionFilters struct {
	Category *string
	Enabled  *bool
	Keyword  *string
	Limit    int
	Offset   int
}

// ==================== Report Datasource ====================

// ReportDatasource represents a report datasource.
type ReportDatasource struct {
	ID             string     `db:"id" json:"id"`
	TenantID       string     `db:"tenant_id" json:"tenant_id"`
	Name           string     `db:"name" json:"name"`
	DatasourceType string     `db:"datasource_type" json:"datasource_type"`
	Config         JSONMap    `db:"config" json:"config"`
	RefreshInterval *int      `db:"refresh_interval" json:"refresh_interval,omitempty"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updated_at"`
}

// CreateDatasourceInput is the input for creating a datasource.
type CreateDatasourceInput struct {
	Name           string    `json:"name" binding:"required"`
	DatasourceType string    `json:"datasource_type" binding:"required"`
	Config         JSONMap   `json:"config" binding:"required"`
	RefreshInterval *int     `json:"refresh_interval,omitempty"`
}

// UpdateDatasourceInput is the input for updating a datasource.
type UpdateDatasourceInput struct {
	Name           *string   `json:"name,omitempty"`
	DatasourceType *string   `json:"datasource_type,omitempty"`
	Config         *JSONMap  `json:"config,omitempty"`
	RefreshInterval *int     `json:"refresh_interval,omitempty"`
}

// ==================== Report Schedule ====================

// ReportSchedule represents a report schedule.
type ReportSchedule struct {
	ID            string     `db:"id" json:"id"`
	TenantID      string     `db:"tenant_id" json:"tenant_id"`
	ReportID      string     `db:"report_id" json:"report_id"`
	CronExpression string    `db:"cron_expression" json:"cron_expression"`
	ExportFormat  string     `db:"export_format" json:"export_format"`
	Recipients    JSONArray  `db:"recipients" json:"recipients"`
	Enabled       bool       `db:"enabled" json:"enabled"`
	LastRunAt     *time.Time `db:"last_run_at" json:"last_run_at,omitempty"`
	NextRunAt     *time.Time `db:"next_run_at" json:"next_run_at,omitempty"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
}

// CreateScheduleInput is the input for creating a schedule.
type CreateScheduleInput struct {
	ReportID      string     `json:"report_id" binding:"required"`
	CronExpression string    `json:"cron_expression" binding:"required"`
	ExportFormat  string     `json:"export_format" binding:"required"`
	Recipients    JSONArray  `json:"recipients,omitempty"`
	Enabled       *bool      `json:"enabled,omitempty"`
}

// UpdateScheduleInput is the input for updating a schedule.
type UpdateScheduleInput struct {
	CronExpression *string    `json:"cron_expression,omitempty"`
	ExportFormat   *string    `json:"export_format,omitempty"`
	Recipients     *JSONArray `json:"recipients,omitempty"`
	Enabled        *bool      `json:"enabled,omitempty"`
	LastRunAt      *time.Time `json:"last_run_at,omitempty"`
	NextRunAt      *time.Time `json:"next_run_at,omitempty"`
}

// ==================== Report Execution ====================

// ReportExecution represents a report execution record.
type ReportExecution struct {
	ID           string     `db:"id" json:"id"`
	TenantID     string     `db:"tenant_id" json:"tenant_id"`
	ReportID     string     `db:"report_id" json:"report_id"`
	ScheduleID   *string    `db:"schedule_id" json:"schedule_id,omitempty"`
	ExportFormat string     `db:"export_format" json:"export_format"`
	Status       string     `db:"status" json:"status"`
	FileURL      *string    `db:"file_url" json:"file_url,omitempty"`
	Error        *string    `db:"error" json:"error,omitempty"`
	StartedAt    *time.Time `db:"started_at" json:"started_at,omitempty"`
	CompletedAt  *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	DurationMs   *int       `db:"duration_ms" json:"duration_ms,omitempty"`
	TriggeredBy  *string    `db:"triggered_by" json:"triggered_by,omitempty"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
}

// ==================== Preview & Execution Responses ====================

// PreviewResult represents the result of previewing a report.
type PreviewResult struct {
	Report      ReportDefinition `json:"report"`
	PreviewParams JSONMap        `json:"preview_params"`
}

// ExecuteReportResult represents the result of executing a report.
type ExecuteReportResult struct {
	Report      ReportDefinition `json:"report"`
	Execution   ReportExecution  `json:"execution"`
}

// ==================== Helpers ====================

const letterBytes = "abcdefghijklmnopqrstuvwxyz0123456789"

func RandomString(n int) string {
	sb := strings.Builder{}
	sb.Grow(n)
	for i := 0; i < n; i++ {
		sb.WriteByte(letterBytes[rand.Intn(len(letterBytes))])
	}
	return sb.String()
}

func GenerateReportID() string {
	return fmt.Sprintf("rpt-%d-%s", time.Now().UnixNano(), RandomString(7))
}
