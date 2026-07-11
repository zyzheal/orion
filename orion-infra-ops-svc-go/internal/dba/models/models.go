package models

import "time"

// SQLOrder represents a database administration order/ticket.
type SQLOrder struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Title       string    `db:"title" json:"title"`
	Description string    `db:"description" json:"description,omitempty"`
	Database    string    `db:"database" json:"database"`
	SQLContent  string    `db:"sql_content" json:"sql_content"`
	Status      string    `db:"status" json:"status"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	ApprovedBy  *string   `db:"approved_by" json:"approved_by,omitempty"`
	ExecutedBy  *string   `db:"executed_by" json:"executed_by,omitempty"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateOrderInput struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	Database    string `json:"database" binding:"required"`
	SQLContent  string `json:"sql_content" binding:"required"`
}

// DataSource represents a database data source connection.
type DataSource struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	DBType      string    `db:"db_type" json:"db_type"`
	Host        string    `db:"host" json:"host"`
	Port        int       `db:"port" json:"port"`
	Database    string    `db:"database" json:"database"`
	Username    string    `db:"username" json:"username"`
	PasswordRef string    `db:"password_ref" json:"password_ref,omitempty"`
	SSLMode     string    `db:"ssl_mode" json:"ssl_mode"`
	Status      string    `db:"status" json:"status"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateDataSourceInput struct {
	Name        string `json:"name" binding:"required"`
	DBType      string `json:"db_type" binding:"required"`
	Host        string `json:"host" binding:"required"`
	Port        int    `json:"port"`
	Database    string `json:"database" binding:"required"`
	Username    string `json:"username" binding:"required"`
	PasswordRef string `json:"password_ref"`
	SSLMode     string `json:"ssl_mode"`
}

// AuditRule represents a SQL audit rule.
type AuditRule struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description,omitempty"`
	Category    string    `db:"category" json:"category"`
	Pattern     string    `db:"pattern" json:"pattern"`
	Severity    string    `db:"severity" json:"severity"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type CreateAuditRuleInput struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Category    string `json:"category" binding:"required"`
	Pattern     string `json:"pattern" binding:"required"`
	Severity    string `json:"severity"`
	Enabled     *bool  `json:"enabled"`
}

// QueryLog represents a query execution audit log.
type QueryLog struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	DataSourceID string    `db:"data_source_id" json:"data_source_id"`
	SQLContent   string    `db:"sql_content" json:"sql_content"`
	Status       string    `db:"status" json:"status"`
	Duration     int       `db:"duration" json:"duration"`
	RowCount     int       `db:"row_count" json:"row_count"`
	ErrorMessage *string   `db:"error_message" json:"error_message,omitempty"`
	CreatedBy    string    `db:"created_by" json:"created_by"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// QueryResult represents a direct query response.
type QueryResult struct {
	Success         bool                    `json:"success"`
	Data            []map[string]interface{} `json:"data,omitempty"`
	Columns         []string                `json:"columns,omitempty"`
	RowCount        int                     `json:"row_count"`
	ExecutionRecord *QueryLog               `json:"execution_record,omitempty"`
	Error           string                  `json:"error,omitempty"`
}
type DirectQueryInput struct {
    DatabaseID string            `json:"database_id"`
    Query      string            `json:"query"`
    Params     map[string]interface{} `json:"params,omitempty"`
}
