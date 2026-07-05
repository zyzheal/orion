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

// ListAuditLogFilters contains optional filters for listing audit logs.
type ListAuditLogFilters struct {
	TenantID     string
	UserID       string
	Action       string
	ResourceType string
	ResourceID   string
	Limit        int
	Offset       int
}
