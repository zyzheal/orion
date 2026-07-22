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
	DatabaseName  string            `json:"databaseName" db:"database_name"`
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
	DatabaseName  string            `json:"databaseName"`
	Extra         map[string]any    `json:"extra"`
}

// UpdateEntryRequest is the request body for updating a catalog entry.
type UpdateEntryRequest struct {
	Description   string            `json:"description"`
	DataType      string            `json:"dataType"`
	TableName     string            `json:"tableName"`
	ColumnName    string            `json:"column_name"`
	DataFormat    string            `json:"dataFormat"`
	SampleValues  string            `json:"sampleValues"`
	SchemaVersion string            `json:"schemaVersion"`
	Owner         string            `json:"owner"`
	DatabaseName  string            `json:"databaseName"`
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

// --- Auto-discovery models ---

// ConnectionType identifies the database dialect being introspected.
type ConnectionType string

const (
	ConnectionTypePostgreSQL ConnectionType = "postgresql"
	ConnectionTypeMySQL      ConnectionType = "mysql"
	ConnectionTypeSQLite     ConnectionType = "sqlite"
)

// DiscoveryConfig defines a single database connection for auto-discovery.
type DiscoveryConfig struct {
	Dialect    ConnectionType `json:"dialect" binding:"required"`
	Name       string         `json:"name" binding:"required"`
	DSN        string         `json:"dsn" binding:"required"`
	SchemaName string         `json:"schemaName"` // PostgreSQL schema; ignored by MySQL/SQLite
	TimeoutSec int            `json:"timeoutSec"`
}

// ColumnInfo describes a single column discovered during introspection.
type ColumnInfo struct {
	Name            string `json:"name"`
	DataType        string `json:"dataType"`
	IsNullable      bool   `json:"isNullable"`
	IsPrimary       bool   `json:"isPrimary"`
	IsForeignKey    bool   `json:"isForeignKey"`
	DefaultValue    string `json:"defaultValue"`
	OrdinalPosition int    `json:"ordinalPosition"`
}

// ForeignKeyRef describes a foreign key discovered during introspection.
type ForeignKeyRef struct {
	ColumnName       string `json:"columnName"`
	ReferencedTable  string `json:"referencedTable"`
	ReferencedColumn string `json:"referencedColumn"`
}

// IndexInfo describes an index discovered during introspection.
type IndexInfo struct {
	Name      string   `json:"name"`
	Columns   []string `json:"columns"`
	IsUnique  bool     `json:"isUnique"`
	IsPrimary bool     `json:"isPrimary"`
}

// DiscoveredSchema holds the fully introspected schema for one table.
type DiscoveredSchema struct {
	TableName      string          `json:"tableName"`
	SchemaName     string          `json:"schemaName"`
	Columns        []ColumnInfo    `json:"columns"`
	PrimaryKey     []string        `json:"primaryKey"`
	ForeignKeyRefs []ForeignKeyRef `json:"foreignKeyRefs"`
	Indexes        []IndexInfo     `json:"indexes"`
}

// DiscoverySummary is the return payload of the /data-catalog/discover endpoint.
type DiscoverySummary struct {
	TotalTablesDiscovered int               `json:"totalTablesDiscovered"`
	TablesPerDatabase     map[string]int    `json:"tablesPerDatabase"`
	NewEntriesCreated     int               `json:"newEntriesCreated"`
	UpdatedEntries        int               `json:"updatedEntries"`
	Errors                []string          `json:"errors"`
	SampleTable           *DiscoveredSchema `json:"sampleTable"`
	Status                string            `json:"status"`
	Message               string            `json:"message"`
}
