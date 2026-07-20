package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a PostgreSQL JSONB-compatible map type.
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

// JSONArray is a PostgreSQL JSONB-compatible slice type.
type JSONArray []interface{}

func (a JSONArray) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}

func (a *JSONArray) Scan(src interface{}) error {
	if src == nil {
		*a = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("cannot scan %T into JSONArray", src)
	}
}

// ---------------------------------------------------------------------------
// SQL Audit History
// ---------------------------------------------------------------------------

// SQLAuditHistory stores audit results from the Inception engine.
type SQLAuditHistory struct {
	ID            string    `db:"id" json:"id"`
	TenantID      string    `db:"tenant_id" json:"tenant_id"`
	DBName        string    `db:"db_name" json:"db_name"`
	SQLStatement  string    `db:"sql_statement" json:"sql_statement"`
	OperationType string    `db:"operation_type" json:"operation_type"`
	DryRun        bool      `db:"dry_run" json:"dry_run"`
	Status        string    `db:"status" json:"status"`
	Errors        JSONArray `db:"errors" json:"errors"`
	Warnings      JSONArray `db:"warnings" json:"warnings"`
	AffectedRows  *int      `db:"affected_rows" json:"affected_rows,omitempty"`
	ExecTimeMs    *int      `db:"exec_time_ms" json:"exec_time_ms,omitempty"`
	AuditedBy     *string   `db:"audited_by" json:"audited_by,omitempty"`
	RequestID     *string   `db:"request_id" json:"request_id,omitempty"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
}

// CreateAuditRequest is the request payload for creating an audit entry.
type CreateAuditRequest struct {
	DBName        string `json:"db_name" binding:"required"`
	SQLStatement  string `json:"sql_statement" binding:"required"`
	OperationType string `json:"operation_type"`
	DryRun        bool   `json:"dry_run"`
	AuditedBy     string `json:"audited_by"`
	RequestID     string `json:"request_id"`
}

// ---------------------------------------------------------------------------
// SQL Blacklist
// ---------------------------------------------------------------------------

// SQLBlacklist tracks dangerous SQL patterns that should be blocked.
type SQLBlacklist struct {
	ID          string    `db:"id" json:"id"`
	TenantID    *string   `db:"tenant_id" json:"tenant_id,omitempty"`
	Pattern     string    `db:"pattern" json:"pattern"`
	Description *string   `db:"description" json:"description,omitempty"`
	Severity    string    `db:"severity" json:"severity"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	CreatedBy   *string   `db:"created_by" json:"created_by,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// CreateBlacklistRequest is the request payload for creating a blacklist entry.
type CreateBlacklistRequest struct {
	Pattern     string `json:"pattern" binding:"required"`
	Description string `json:"description"`
	Severity    string `json:"severity"`
	CreatedBy   string `json:"created_by"`
}

// UpdateBlacklistRequest is the request payload for updating a blacklist entry.
type UpdateBlacklistRequest struct {
	Pattern     *string `json:"pattern"`
	Description *string `json:"description"`
	Severity    *string `json:"severity"`
	Enabled     *bool   `json:"enabled"`
}

// ---------------------------------------------------------------------------
// Inception Config
// ---------------------------------------------------------------------------

// InceptionConfig stores Inception server configuration per tenant.
type InceptionConfig struct {
	ID                string    `db:"id" json:"id"`
	TenantID          string    `db:"tenant_id" json:"tenant_id"`
	Host              string    `db:"host" json:"host"`
	Port              int       `db:"port" json:"port"`
	User              string    `db:"user" json:"user"`
	EncryptedPassword *string   `db:"encrypted_password" json:"-"`
	DefaultDB         *string   `db:"default_db" json:"default_db,omitempty"`
	TimeoutMs         int       `db:"timeout_ms" json:"timeout_ms"`
	Enabled           bool      `db:"enabled" json:"enabled"`
	CreatedAt         time.Time `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time `db:"updated_at" json:"updated_at"`
}

// CreateConfigRequest is the request payload for creating/upserting an inception config.
type CreateConfigRequest struct {
	Host      string `json:"host" binding:"required"`
	Port      int    `json:"port"`
	User      string `json:"user" binding:"required"`
	Password  string `json:"password" binding:"required"`
	DefaultDB string `json:"default_db"`
	TimeoutMs int    `json:"timeout_ms"`
}

// UpdateConfigRequest is the request payload for updating an inception config.
type UpdateConfigRequest struct {
	Host      *string `json:"host"`
	Port      *int    `json:"port"`
	User      *string `json:"user"`
	Password  *string `json:"password"`
	DefaultDB *string `json:"default_db"`
	TimeoutMs *int    `json:"timeout_ms"`
	Enabled   *bool   `json:"enabled"`
}

// ---------------------------------------------------------------------------
// Audit Report
// ---------------------------------------------------------------------------

// AuditReport stores exported audit reports.
type AuditReport struct {
	ID          string     `db:"id" json:"id"`
	TenantID    string     `db:"tenant_id" json:"tenant_id"`
	ReportName  string     `db:"report_name" json:"report_name"`
	Format      string     `db:"format" json:"format"`
	Filters     JSONB      `db:"filters" json:"filters,omitempty"`
	FilePath    *string    `db:"file_path" json:"file_path,omitempty"`
	Status      string     `db:"status" json:"status"`
	GeneratedBy *string    `db:"generated_by" json:"generated_by,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	ExpiresAt   *time.Time `db:"expires_at" json:"expires_at,omitempty"`
}

// CreateReportRequest is the request payload for creating a report.
type CreateReportRequest struct {
	ReportName  string `json:"report_name" binding:"required"`
	Format      string `json:"format"`
	GeneratedBy string `json:"generated_by"`
}

// ---------------------------------------------------------------------------
// API Request payloads (TS-compatible: sql/database instead of db_name/sql_statement)
// ---------------------------------------------------------------------------

// AuditRequest is the /inception/audit payload.
type AuditRequest struct {
	SQL           string `json:"sql" binding:"required"`
	Database      string `json:"database"`
	OperationType string `json:"operation_type"`
	DryRun        bool   `json:"dry_run"`
	AuditedBy     string `json:"audited_by"`
}

func (r *AuditRequest) ToCreateAudit() *CreateAuditRequest {
	db := r.Database
	if db == "" {
		db = "default"
	}
	opType := r.OperationType
	if opType == "" {
		opType = "audit"
	}
	return &CreateAuditRequest{
		DBName:        db,
		SQLStatement:  r.SQL,
		OperationType: opType,
		DryRun:        r.DryRun,
		AuditedBy:     r.AuditedBy,
	}
}

// ParseRequest is the /inception/parse payload.
type ParseRequest struct {
	SQL string `json:"sql" binding:"required"`
}

func (r *ParseRequest) ToCreateAudit() *CreateAuditRequest {
	return &CreateAuditRequest{
		DBName:        "default",
		SQLStatement:  r.SQL,
		OperationType: "parse",
		DryRun:        true,
	}
}

// ExecuteRequest is the /inception/execute payload.
type ExecuteRequest struct {
	SQL      string `json:"sql" binding:"required"`
	Database string `json:"database"`
}

func (r *ExecuteRequest) ToCreateAudit() *CreateAuditRequest {
	db := r.Database
	if db == "" {
		db = "default"
	}
	return &CreateAuditRequest{
		DBName:        db,
		SQLStatement:  r.SQL,
		OperationType: "execute",
		DryRun:        false,
	}
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

// PaginatedRequest holds pagination parameters.
type PaginatedRequest struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

// Offset returns the SQL OFFSET value, applying defaults.
func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

// Limit returns the SQL LIMIT value, capping at 100.
func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}
