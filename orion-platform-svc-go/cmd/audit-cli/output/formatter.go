// Package output provides JSON, CSV, and TABLE output formatters for audit results.
package output

import (
	"encoding/json"
	"fmt"
	"strings"

	"orion/platform-svc-go/cmd/audit-cli/types"
)

// Format produces a formatted string from audit results.
func Format(dimension types.AuditDimension, result interface{}, format types.OutputFormat) string {
	switch format {
	case types.FormatJSON:
		return formatJSON(result)
	case types.FormatCSV:
		return formatCSV(dimension, result)
	case types.FormatTABLE, "":
		return formatTable(dimension, result)
	default:
		return formatJSON(result)
	}
}

// formatJSON marshals the result to pretty-printed JSON.
func formatJSON(v interface{}) string {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Sprintf("JSON error: %v", err)
	}
	return string(data)
}

// formatCSV produces a CSV representation.
func formatCSV(dimension types.AuditDimension, v interface{}) string {
	var sb strings.Builder
	switch r := v.(type) {
	case *types.DataCompareResult:
		sb.WriteString("table,row_count_ts,row_count_go,checksum_ts,checksum_go,matched\n")
		for _, t := range r.Tables {
			sb.WriteString(fmt.Sprintf("%s,%d,%d,%s,%s,%t\n",
				t.Table, t.RowCountTS, t.RowCountGo,
				t.ChecksumTS, t.ChecksumGo, t.Matched))
		}
	case *types.SourceAuditResult:
		sb.WriteString("table,total,source_ts,source_go,source_empty\n")
		for _, t := range r.Tables {
			sb.WriteString(fmt.Sprintf("%s,%d,%d,%d,%d\n",
				t.Table, t.Total, t.SourceTS, t.SourceGo, t.SourceEmpty))
		}
	case *types.SchemaAuditResult:
		sb.WriteString("diff_type,table,column,detail\n")
		for _, d := range r.TablesInTSOnly {
			sb.WriteString(fmt.Sprintf("table_only_in_ts,%s,,\n", d))
		}
		for _, d := range r.TablesInGoOnly {
			sb.WriteString(fmt.Sprintf("table_only_in_go,%s,,\n", d))
		}
		for _, d := range r.ColumnDiffs {
			detail := ""
			if d.OnlyInTS {
				detail = "ts_only"
			} else if d.OnlyInGo {
				detail = "go_only"
			} else {
				detail = fmt.Sprintf("ts=%s go=%s", d.TypeTS, d.TypeGo)
			}
			sb.WriteString(fmt.Sprintf("column_diff,%s,%s,%s\n", d.Table, d.Column, detail))
		}
	case *types.FullReport:
		sb.WriteString("dimension,status,count\n")
		sb.WriteString(fmt.Sprintf("schema,%s,%d\n", dimStatus(r.Schema), reportCount(r.Schema)))
		sb.WriteString(fmt.Sprintf("data,%s,%d\n", dimStatus(r.Data), reportCount(r.Data)))
		sb.WriteString(fmt.Sprintf("source,%s,%d\n", dimStatus(r.Source), reportCount(r.Source)))
		sb.WriteString(fmt.Sprintf("referential,%s,%d\n", dimStatus(r.Referential), len(r.Referential)))
		sb.WriteString(fmt.Sprintf("migration,%s,%d\n", dimStatus(r.Migrations), len(r.Migrations)))
	default:
		data, _ := json.Marshal(v)
		sb.Write(data)
	}
	return sb.String()
}

// formatTable produces a human-readable table.
func formatTable(dimension types.AuditDimension, v interface{}) string {
	var sb strings.Builder
	switch r := v.(type) {
	case *types.DataCompareResult:
		sb.WriteString("Data Comparison\n")
		sb.WriteString("─────────────────────────────────────────────────────────────────────\n")
		sb.WriteString(fmt.Sprintf("%-30s %10s %10s  %5s\n", "Table", "TS Rows", "Go Rows", "OK"))
		sb.WriteString("─────────────────────────────────────────────────────────────────────\n")
		for _, t := range r.Tables {
			status := "OK"
			if !t.Matched {
				status = "DIFF"
			}
			sb.WriteString(fmt.Sprintf("%-30s %10d %10d  %5s\n", t.Table, t.RowCountTS, t.RowCountGo, status))
		}
	case *types.SourceAuditResult:
		sb.WriteString("Source Distribution\n")
		sb.WriteString("─────────────────────────────────────────────────────────────\n")
		sb.WriteString(fmt.Sprintf("%-30s %8s %8s %8s %8s\n", "Table", "Total", "TS", "Go", "Empty"))
		sb.WriteString("─────────────────────────────────────────────────────────────\n")
		for _, t := range r.Tables {
			sb.WriteString(fmt.Sprintf("%-30s %8d %8d %8d %8d\n",
				t.Table, t.Total, t.SourceTS, t.SourceGo, t.SourceEmpty))
		}
	case *types.SchemaAuditResult:
		sb.WriteString("Schema Comparison\n")
		sb.WriteString("──────────────────────────────────────────────────────\n")
		if len(r.TablesInTSOnly) > 0 {
			sb.WriteString(fmt.Sprintf("\nTables only in TS (%d):\n", len(r.TablesInTSOnly)))
			for _, t := range r.TablesInTSOnly {
				sb.WriteString(fmt.Sprintf("  - %s\n", t))
			}
		}
		if len(r.TablesInGoOnly) > 0 {
			sb.WriteString(fmt.Sprintf("\nTables only in Go (%d):\n", len(r.TablesInGoOnly)))
			for _, t := range r.TablesInGoOnly {
				sb.WriteString(fmt.Sprintf("  - %s\n", t))
			}
		}
		if len(r.ColumnDiffs) > 0 {
			sb.WriteString(fmt.Sprintf("\nColumn differences (%d):\n", len(r.ColumnDiffs)))
			for _, d := range r.ColumnDiffs {
				status := "ts-only"
				if d.OnlyInGo {
					status = "go-only"
				} else {
					status = fmt.Sprintf("ts=%s go=%s", d.TypeTS, d.TypeGo)
				}
				sb.WriteString(fmt.Sprintf("  %s.%s [%s]\n", d.Table, d.Column, status))
			}
		}
		if len(r.IndexDiffs) > 0 {
			sb.WriteString(fmt.Sprintf("\nIndex differences (%d):\n", len(r.IndexDiffs)))
			for _, d := range r.IndexDiffs {
				status := "ts-only"
				if d.OnlyInGo {
					status = "go-only"
				}
				sb.WriteString(fmt.Sprintf("  %s.%s [%s]\n", d.Table, d.Index, status))
			}
		}
	case *types.FullReport:
		sb.WriteString("Full Audit Report\n")
		sb.WriteString("═════════════════════════════════════════════════════════════\n")
		sb.WriteString(fmt.Sprintf("\nOverall status: %s\n", r.Overall))
		sb.WriteString(fmt.Sprintf("Tables checked: %d\n", r.TablesChecked))
		sb.WriteString(fmt.Sprintf("Discrepancies: %d\n", r.Discrepancies))
		if r.Migrations != nil {
			sb.WriteString(fmt.Sprintf("Migrations: %d\n", len(r.Migrations)))
		}
	case []types.FKOrphanResult:
		if len(r) == 0 {
			sb.WriteString("No orphaned rows found.\n")
		} else {
			sb.WriteString("Orphaned Rows\n")
			sb.WriteString("──────────────────────────────────────────────────────\n")
			for _, f := range r {
				sb.WriteString(fmt.Sprintf("  %s -> %s (%s): %d orphans\n",
					f.Table, f.RefTable, f.ForeignKey, f.OrphanCount))
			}
		}
	default:
		data, _ := json.Marshal(v)
		sb.Write(data)
	}
	return sb.String()
}

// dimStatus returns a pass/fail string for a dimension result.
func dimStatus(v interface{}) string {
	if v == nil {
		return "skip"
	}
	switch r := v.(type) {
	case *types.SchemaAuditResult:
		if len(r.TablesInTSOnly)+len(r.TablesInGoOnly)+
			len(r.ColumnDiffs)+len(r.IndexDiffs) > 0 {
			return "diff"
		}
	case *types.DataCompareResult:
		for _, t := range r.Tables {
			if !t.Matched {
				return "diff"
			}
		}
	case *types.SourceAuditResult:
		// Source audit is informational, not pass/fail
		return "info"
	case []types.FKOrphanResult:
		if len(r) > 0 {
			return "diff"
		}
	}
	return "pass"
}

// reportCount returns a count of items in a result.
func reportCount(v interface{}) int {
	switch r := v.(type) {
	case *types.SchemaAuditResult:
		return len(r.ColumnDiffs) + len(r.IndexDiffs)
	case *types.DataCompareResult:
		return len(r.Tables)
	case *types.SourceAuditResult:
		return len(r.Tables)
	}
	return 0
}
