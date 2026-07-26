package models

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a type alias for map[string]interface{} that implements
// the sql.Scanner and driver.Valuer interfaces for PostgreSQL JSONB columns.
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

// AuditLog represents a single audit log entry stored in PostgreSQL.
// Matches the Node.js AuditLog interface from AuditRepository.ts,
// with ActorID preserving backward compatibility (maps to user_id column).
type AuditLog struct {
	ID            string         `db:"id" json:"id"`
	TenantID      string         `db:"tenant_id" json:"tenant_id"`
	ActorID       string         `db:"user_id" json:"actor_id"`
	Action        string         `db:"action" json:"action"`
	ResourceType  string         `db:"resource_type" json:"resource_type"`
	ResourceID    sql.NullString `db:"resource_id" json:"resource_id"`
	RequestMethod sql.NullString `db:"request_method" json:"request_method"`
	RequestPath   sql.NullString `db:"request_path" json:"request_path"`
	RequestBody   JSONB          `db:"request_body" json:"request_body"`
	ResponseCode  sql.NullInt32  `db:"response_code" json:"response_code"`
	ResponseBody  JSONB          `db:"response_body" json:"response_body"`
	IPAddress     sql.NullString `db:"ip_address" json:"ip_address"`
	UserAgent     sql.NullString `db:"user_agent" json:"user_agent"`
	PrevHash      sql.NullString `db:"prev_hash" json:"prev_hash"`
	Hash          string         `db:"hash" json:"hash"`
	CreatedAt     time.Time      `db:"created_at" json:"created_at"`
}

// CreateAuditRequest is the input payload for creating a new audit log entry.
type CreateAuditRequest struct {
	Action        string                 `json:"action" binding:"required"`
	ResourceType  string                 `json:"resource_type" binding:"required"`
	ResourceID    string                 `json:"resource_id"`
	ActorID       string                 `json:"actor_id"`
	ActorName     string                 `json:"actor_name"`
	RequestMethod string                 `json:"request_method"`
	RequestPath   string                 `json:"request_path"`
	RequestBody   map[string]interface{} `json:"request_body"`
	ResponseCode  int                    `json:"response_code"`
	ResponseBody  map[string]interface{} `json:"response_body"`
	IPAddress     string                 `json:"ip_address"`
	UserAgent     string                 `json:"user_agent"`
}

// PaginatedRequest holds pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

// Offset returns the SQL OFFSET value based on page and page_size.
func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

// Limit returns the SQL LIMIT value, capped at 100.
func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}

// PaginatedResponse wraps a paginated result set.
type PaginatedResponse struct {
	Data       []AuditLog `json:"data"`
	Total      int        `json:"total"`
	Page       int        `json:"page"`
	PageSize   int        `json:"page_size"`
	TotalPages int        `json:"total_pages"`
}

// ChainVerificationResult holds the outcome of a hash chain integrity check.
type ChainVerificationResult struct {
	Valid         bool       `json:"valid"`
	BrokenAt      *time.Time `json:"broken_at,omitempty"`
	TotalVerified int        `json:"total_verified"`
}

// UpdateAuditRequest is the input payload for updating an audit log entry.
// Only non-hash-chain fields can be modified.
type UpdateAuditRequest struct {
	ResponseCode  *int                 `json:"response_code"`
	ResponseBody  map[string]interface{} `json:"response_body"`
	IPAddress     string               `json:"ip_address"`
	UserAgent     string               `json:"user_agent"`
	RequestBody   map[string]interface{} `json:"request_body"`
}

// ListAuditLogFilters contains optional filters for listing audit logs.
type ListAuditLogFilters struct {
	TenantID     string
	UserID       string
	Action       string
	ResourceType string
	ResourceID   string
	DateFrom     string
	DateTo       string
	Limit        int
	Offset       int
}

// ExportAuditLogsRequest is the input payload for exporting audit logs.
type ExportAuditLogsRequest struct {
	TenantID     string `json:"tenant_id" form:"tenant_id"`
	UserID       string `json:"user_id" form:"user_id"`
	Action       string `json:"action" form:"action"`
	ResourceType string `json:"resource_type" form:"resource_type"`
	ResourceID   string `json:"resource_id" form:"resource_id"`
	DateFrom     string `json:"date_from" form:"date_from"`
	DateTo       string `json:"date_to" form:"date_to"`
	Format       string `json:"format" form:"format"` // "json" or "csv"
}

// RetentionPolicy represents an audit log retention policy per tenant.
type RetentionPolicy struct {
	ID                string    `db:"id" json:"id"`
	TenantID          string    `db:"tenant_id" json:"tenant_id"`
	RetentionDays     int       `db:"retention_days" json:"retention_days"`
	ArchiveBeforeDel  bool      `db:"archive_before_delete" json:"archive_before_delete"`
	Enabled           bool      `db:"enabled" json:"enabled"`
	CreatedAt         time.Time `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time `db:"updated_at" json:"updated_at"`
}

// CreateRetentionPolicyInput is the payload for creating/updating a retention policy.
type CreateRetentionPolicyInput struct {
	TenantID          string `json:"tenant_id" binding:"required"`
	RetentionDays     int    `json:"retention_days" binding:"min=30"`
	ArchiveBeforeDel  bool   `json:"archive_before_delete"`
	Enabled           bool   `json:"enabled"`
}

// UpdateRetentionPolicyInput is the payload for updating a retention policy.
type UpdateRetentionPolicyInput struct {
	RetentionDays    *int  `json:"retention_days"`
	ArchiveBeforeDel *bool `json:"archive_before_delete"`
	Enabled          *bool `json:"enabled"`
}

// RetentionCleanupResult is the output of executing a retention cleanup.
type RetentionCleanupResult struct {
	TotalScanned int      `json:"total_scanned"`
	Archived     int      `json:"archived"`
	Deleted      int      `json:"deleted"`
	Skipped      int      `json:"skipped"`
	Errors       []string `json:"errors"`
}

// RetentionStats holds aggregate statistics about audit log retention.
type RetentionStats struct {
	TotalPolicies    int        `json:"total_policies"`
	EnabledPolicies  int        `json:"enabled_policies"`
	TotalAuditLogs   int        `json:"total_audit_logs"`
	OldestLogDate    *time.Time `json:"oldest_log_date,omitempty"`
	NewestLogDate    *time.Time `json:"newest_log_date,omitempty"`
	LogsByTenant     []TenantLogStat `json:"logs_by_tenant"`
}

// TenantLogStat contains per-tenant log counts with retention days.
type TenantLogStat struct {
	TenantID      string `json:"tenant_id"`
	Count         int    `json:"count"`
	RetentionDays *int   `json:"retention_days,omitempty"`
}

// ComplianceCheckResult represents a single compliance check outcome.
type ComplianceCheckResult struct {
	CheckID        string                 `json:"check_id"`
	Framework      string                 `json:"framework"`
	ControlID      string                 `json:"control_id"`
	ControlName    string                 `json:"control_name"`
	Status         string                 `json:"status"` // PASS, FAIL, WARNING
	Severity       string                 `json:"severity"` // critical, high, medium, low
	Description    string                 `json:"description"`
	Evidence       map[string]interface{} `json:"evidence"`
	Remediation    string                 `json:"remediation"`
}

// ComplianceReport holds a full compliance report.
type ComplianceReport struct {
	TenantID    string                  `json:"tenant_id"`
	Framework   string                  `json:"framework"`
	GeneratedAt time.Time               `json:"generated_at"`
	OverallScore int                    `json:"overall_score"`
	Checks      []ComplianceCheckResult `json:"checks"`
	Summary     ComplianceSummary       `json:"summary"`
}

// ComplianceSummary aggregates compliance check results.
type ComplianceSummary struct {
	TotalChecks    int `json:"total_checks"`
	PassedChecks   int `json:"passed_checks"`
	FailedChecks   int `json:"failed_checks"`
	WarningChecks  int `json:"warning_checks"`
	CriticalIssues int `json:"critical_issues"`
}
