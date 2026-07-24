// Package types defines audit report structures for the data audit CLI.
package types

// AuditDimension identifies the dimension being checked.
type AuditDimension string

const (
	DimSchema      AuditDimension = "schema"
	DimData        AuditDimension = "data"
	DimSource      AuditDimension = "source"
	DimRefIntegrity AuditDimension = "referential_integrity"
	DimMigration   AuditDimension = "migration"
)

// Exit codes
const (
	ExitPass = 0 // all checks pass
	ExitDiff = 1 // discrepancies found
	ExitErr  = 2 // execution error
)

// SchemaAuditResult holds the result of a schema comparison.
type SchemaAuditResult struct {
	TablesInTSOnly    []string          `json:"tables_in_ts_only,omitempty"`
	TablesInGoOnly    []string          `json:"tables_in_go_only,omitempty"`
	ColumnDiffs       []ColumnDiff      `json:"column_diffs,omitempty"`
	IndexDiffs        []IndexDiff       `json:"index_diffs,omitempty"`
	TablesInCommon    []string          `json:"tables_in_common"`
}

// ColumnDiff describes a mismatched column between two schemas.
type ColumnDiff struct {
	Table    string `json:"table"`
	Column   string `json:"column"`
	TypeTS   string `json:"type_ts,omitempty"`
	TypeGo   string `json:"type_go,omitempty"`
	OnlyInTS bool   `json:"only_in_ts,omitempty"`
	OnlyInGo bool   `json:"only_in_go,omitempty"`
}

// IndexDiff describes a mismatched index.
type IndexDiff struct {
	Table    string `json:"table"`
	Index    string `json:"index"`
	OnlyInTS bool   `json:"only_in_ts,omitempty"`
	OnlyInGo bool   `json:"only_in_go,omitempty"`
}

// DataCompareResult holds the result of a data comparison.
type DataCompareResult struct {
	Tables []TableDataCompare `json:"tables"`
}

// TableDataCompare compares row counts and checksums for a single table.
type TableDataCompare struct {
	Table      string `json:"table"`
	RowCountTS int64  `json:"row_count_ts"`
	RowCountGo int64  `json:"row_count_go"`
	ChecksumTS string `json:"checksum_ts,omitempty"`
	ChecksumGo string `json:"checksum_go,omitempty"`
	Matched    bool   `json:"matched"`
}

// SourceAuditResult holds _source column distribution per table.
type SourceAuditResult struct {
	Tables []SourceDist `json:"tables"`
}

// SourceDist shows the distribution of _source values in a table.
type SourceDist struct {
	Table    string `json:"table"`
	Total    int64  `json:"total"`
	SourceTS int64  `json:"source_ts"`
	SourceGo int64  `json:"source_go"`
	SourceEmpty int64 `json:"source_empty"`
}

// FKOrphanResult describes orphaned rows detected by referential integrity checks.
type FKOrphanResult struct {
	Table       string `json:"table"`
	ForeignKey  string `json:"foreign_key"`
	RefTable    string `json:"referenced_table"`
	OrphanCount int64  `json:"orphan_count"`
}

// MigrationStatus describes the state of a migration.
type MigrationStatus struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Applied     bool   `json:"applied"`
}

// FullReport is the comprehensive audit report output by the report command.
type FullReport struct {
	Schema          *SchemaAuditResult `json:"schema,omitempty"`
	Data            *DataCompareResult `json:"data,omitempty"`
	Source          *SourceAuditResult `json:"source,omitempty"`
	Referential     []FKOrphanResult   `json:"referential,omitempty"`
	Migrations      []MigrationStatus  `json:"migrations,omitempty"`
	Overall         string             `json:"overall"`
	TablesChecked   int                `json:"tables_checked"`
	Discrepancies   int                `json:"discrepancies"`
}

// OutputFormat specifies the desired output format.
type OutputFormat string

const (
	FormatJSON  OutputFormat = "json"
	FormatCSV   OutputFormat = "csv"
	FormatTABLE OutputFormat = "table"
)
