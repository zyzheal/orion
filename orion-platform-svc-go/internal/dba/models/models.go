package models

import "time"

// ---- SQL Orders ----

type SqlOrder struct {
	ID         string    `json:"id" db:"id"`
	TenantID   string    `json:"tenant_id" db:"tenant_id"`
	UserID     string    `json:"user_id" db:"user_id"`
	Database   string    `json:"database" db:"database_name"`
	SQL        string    `json:"sql" db:"sql_text"`
	Comment    string    `json:"comment" db:"comment"`
	Type       string    `json:"type" db:"order_type"`
	Status     string    `json:"status" db:"status"`
	Result     *string   `json:"result,omitempty" db:"result"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	ExecutedAt *time.Time `json:"executed_at,omitempty" db:"executed_at"`
	ApprovedBy *string   `json:"approved_by,omitempty" db:"approved_by"`
	ApprovedAt *time.Time `json:"approved_at,omitempty" db:"approved_at"`
}

type CreateOrderRequest struct {
	Database string `json:"database" binding:"required"`
	SQL      string `json:"sql" binding:"required"`
	Comment  string `json:"comment"`
	Type     string `json:"type"`
}

type OrderListParams struct {
	Status string `json:"status"`
	Page   int    `json:"page"`
	Limit  int    `json:"limit"`
}

type OrderListResult struct {
	Data  []SqlOrder `json:"data"`
	Total int        `json:"total"`
}

// ---- Data Sources ----

type DataSource struct {
	ID             string     `json:"id" db:"id"`
	TenantID       string     `json:"tenant_id" db:"tenant_id"`
	Name           string     `json:"name" db:"name"`
	Type           string     `json:"type" db:"source_type"`
	Host           string     `json:"host" db:"host"`
	Port           int        `json:"port" db:"port"`
	Database       string     `json:"database" db:"database_name"`
	Username       *string    `json:"username,omitempty" db:"username"`
	Status         string     `json:"status" db:"status"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
	LastChecked    *time.Time `json:"last_checked,omitempty" db:"last_checked"`
}

type CreateDataSourceRequest struct {
	Name     string  `json:"name" binding:"required"`
	Type     string  `json:"type" binding:"required"`
	Host     string  `json:"host" binding:"required"`
	Port     int     `json:"port" binding:"required"`
	Database string  `json:"database" binding:"required"`
	Username *string `json:"username"`
	Password *string `json:"password"`
}

type UpdateDataSourceRequest struct {
	Name     *string `json:"name"`
	Type     *string `json:"type"`
	Host     *string `json:"host"`
	Port     *int    `json:"port"`
	Database *string `json:"database"`
	Username *string `json:"username"`
	Status   *string `json:"status"`
}

type TestConnectionResult struct {
	Success bool    `json:"success"`
	Message string  `json:"message"`
	Latency *float64 `json:"latency,omitempty"`
	Version *string  `json:"version,omitempty"`
}

// ---- Audit Rules ----

type AuditRule struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenant_id" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Pattern   string    `json:"pattern" db:"pattern"`
	Severity  string    `json:"severity" db:"severity"`
	Enabled   bool      `json:"enabled" db:"enabled"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CreateAuditRuleRequest struct {
	Name     string `json:"name" binding:"required"`
	Pattern  string `json:"pattern" binding:"required"`
	Severity string `json:"severity"`
	Enabled  *bool  `json:"enabled"`
}

type UpdateAuditRuleRequest struct {
	Name     *string `json:"name"`
	Pattern  *string `json:"pattern"`
	Severity *string `json:"severity"`
	Enabled  *bool   `json:"enabled"`
}

// ---- Direct Query ----

type DirectQueryRequest struct {
	DataSourceID string  `json:"data_source_id" binding:"required"`
	SQL          string  `json:"sql" binding:"required"`
	Timeout      *int    `json:"timeout"`
}

type DirectQueryResponse struct {
	Success         bool                   `json:"success"`
	Data            *DirectQueryData       `json:"data,omitempty"`
	Error           string                 `json:"error,omitempty"`
	ExecutionRecord *QueryExecutionRecord  `json:"execution_record,omitempty"`
}

type DirectQueryData struct {
	Rows     []map[string]interface{} `json:"rows"`
	RowCount int                      `json:"row_count"`
	Fields   []map[string]interface{} `json:"fields,omitempty"`
	Latency  float64                  `json:"latency"`
	Truncated *bool                    `json:"truncated,omitempty"`
	Message  string                   `json:"message"`
}

// ---- Query Execution Audit Log ----

type QueryExecutionRecord struct {
	ID             string    `json:"id" db:"id"`
	TenantID       string    `json:"tenant_id" db:"tenant_id"`
	UserID         string    `json:"user_id" db:"user_id"`
	DataSourceID   string    `json:"data_source_id" db:"data_source_id"`
	DataSourceName string    `json:"data_source_name" db:"data_source_name"`
	SQL            string    `json:"sql" db:"sql_text"`
	Status         string    `json:"status" db:"status"`
	RowCount       int       `json:"row_count" db:"row_count"`
	Latency        float64   `json:"latency" db:"latency_ms"`
	Error          *string   `json:"error,omitempty" db:"error_message"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type QueryLogQuery struct {
	DataSourceID string `json:"data_source_id"`
	Status       string `json:"status"`
	Page         int    `json:"page"`
	Limit        int    `json:"limit"`
}

type QueryLogResult struct {
	Data  []QueryExecutionRecord `json:"data"`
	Total int                    `json:"total"`
	Page  int                    `json:"page"`
	Limit int                    `json:"limit"`
}
