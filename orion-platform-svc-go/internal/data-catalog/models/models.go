package models

import "time"

// Entry represents a single data catalog entry describing a data asset
// (table, column, or field-level metadata).
type Entry struct {
	ID            string            `json:"id" db:"id"`
	TenantID      string            `json:"tenantId" db:"tenant_id"`
	Name          string            `json:"name" db:"name"`
	Description   string            `json:"description" db:"description"`
	DataType      string            `json:"dataType" db:"data_type"`
	TableName     string            `json:"tableName" db:"table_name"`
	ColumnName    string            `json:"columnName" db:"column_name"`
	DataFormat    string            `json:"dataFormat" db:"data_format"`
	SampleValues  string            `json:"sampleValues" db:"sample_values"`
	SchemaVersion string            `json:"schemaVersion" db:"schema_version"`
	Owner         string            `json:"owner" db:"owner"`
	Extra         map[string]any    `json:"extra,omitempty" db:"-"`
	CreatedAt     time.Time         `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time         `json:"updatedAt" db:"last_updated"`
}

// CreateEntryRequest is the request body for creating a catalog entry.
type CreateEntryRequest struct {
	Name          string            `json:"name" binding:"required"`
	Description   string            `json:"description"`
	DataType      string            `json:"dataType" binding:"required"`
	TableName     string            `json:"tableName" binding:"required"`
	ColumnName    string            `json:"columnName"`
	DataFormat    string            `json:"dataFormat"`
	SampleValues  string            `json:"sampleValues"`
	SchemaVersion string            `json:"schemaVersion"`
	Owner         string            `json:"owner"`
	Extra         map[string]any    `json:"extra"`
}

// UpdateEntryRequest is the request body for updating a catalog entry.
type UpdateEntryRequest struct {
	Description   string            `json:"description"`
	DataType      string            `json:"dataType"`
	TableName     string            `json:"tableName"`
	ColumnName    string            `json:"columnName"`
	DataFormat    string            `json:"dataFormat"`
	SampleValues  string            `json:"sampleValues"`
	SchemaVersion string            `json:"schemaVersion"`
	Owner         string            `json:"owner"`
	Extra         map[string]any    `json:"extra"`
}

// SearchRequest holds query parameters for catalog search / filter.
type SearchRequest struct {
	Query      string `json:"query" query:"q"`
	DataType   string `json:"dataType" query:"dataType"`
	TableName  string `json:"tableName" query:"tableName"`
	Owner      string `json:"owner" query:"owner"`
	SchemaVer  string `json:"schemaVersion" query:"schemaVersion"`
	Page       int    `json:"page" query:"page"`
	Limit      int    `json:"limit" query:"limit"`
}

// PaginatedResponse wraps a paged list result.
type PaginatedResponse struct {
	Data  []Entry `json:"data"`
	Total int     `json:"total"`
	Page  int     `json:"page"`
	Limit int     `json:"limit"`
}

// DiscoverySummary is the return payload of the /data-catalog/discover stub.
type DiscoverySummary struct {
	ScannedTables  int    `json:"scannedTables"`
	NewEntries     int    `json:"newEntries"`
	UpdatedEntries int    `json:"updatedEntries"`
	Status         string `json:"status"`
	Message        string `json:"message"`
}
