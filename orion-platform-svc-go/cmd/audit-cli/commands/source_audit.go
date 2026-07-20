// Package commands implements the source-audit subcommand for audit-cli.
// It audits the _source column distribution across tables.
package commands

import (
	"database/sql"
	"fmt"
	"os"
	"strings"

	"orion/platform-svc-go/cmd/audit-cli/output"
	"orion/platform-svc-go/cmd/audit-cli/types"
)

// SourceAuditCommand audits _source column distribution in a database.
func SourceAuditCommand(args map[string]string) int {
	dsn, err := requireFlag(args, "dsn")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v
", err)
		return types.ExitErr
	}
	tableArg := args["tables"]
	format := types.OutputFormat(args["format"])
	if format == "" {
		format = types.FormatTABLE
	}

	db, err := openDB(dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error connecting to database: %v\n", err)
		return types.ExitErr
	}
	defer db.Close()

	tables := parseTables(tableArg)
	if tables == nil {
		tables, err = listAllTables(db)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error listing tables: %v\n", err)
			return types.ExitErr
		}
	}

	result := types.SourceAuditResult{}
	hasSourceCol := false

	for _, table := range tables {
		dist, err := auditSourceColumn(db, table)
		if err != nil {
			// _source column may not exist on all tables
			if strings.Contains(err.Error(), "does not exist") {
				fmt.Fprintf(os.Stderr, "warning: table %s has no _source column: %v\n", table, err)
			} else {
				fmt.Fprintf(os.Stderr, "warning: error auditing %s: %v\n", table, err)
			}
			continue
		}
		hasSourceCol = true
		result.Tables = append(result.Tables, types.SourceDist{
			Table:     dist.Table,
			Total:     dist.Total,
			SourceTS:  dist.SourceTS,
			SourceGo:  dist.SourceGo,
			SourceEmpty: dist.SourceEmpty,
		})
	}

	if !hasSourceCol {
		fmt.Println("No tables with _source column found.")
		return types.ExitPass
	}

	out := output.Format(types.DimSource, &result, format)
	fmt.Println(out)

	return types.ExitPass
}

// sourceDist holds _source distribution for a table.
type sourceDist struct {
	Table       string `json:"table"`
	Total       int64  `json:"total"`
	SourceTS    int64  `json:"source_ts"`
	SourceGo    int64  `json:"source_go"`
	SourceEmpty int64  `json:"source_empty"`
}

// auditSourceColumn counts _source values in a table.
func auditSourceColumn(db *sql.DB, table string) (*sourceDist, error) {
	var dist sourceDist
	dist.Table = table

	// First check if the _source column exists
	var exists bool
	err := db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_name = $1 AND column_name = '_source'
		)
	`, table).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, fmt.Errorf("column _source does not exist in table %s", table)
	}

	// Count distribution
	err = db.QueryRow(fmt.Sprintf(`
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE _source = 'ts') AS ts_count,
			COUNT(*) FILTER (WHERE _source = 'go') AS go_count,
			COUNT(*) FILTER (WHERE _source IS NULL OR _source = '') AS empty_count
		FROM %s
	`, table)).Scan(&dist.Total, &dist.SourceTS, &dist.SourceGo, &dist.SourceEmpty)
	return &dist, err
}

// SourceAuditHelp prints help text.
func SourceAuditHelp() {
	fmt.Println(`source-audit: Audit _source column distribution across tables.

Usage:
  audit-cli source-audit --dsn <postgres-dsn> [--tables "t1,t2"] [--format json|csv|table]

Flags:
  --dsn      PostgreSQL DSN (required)
  --tables   Comma-separated list of tables, or "all" (default: all)
  --format   Output format: json, csv, table (default)
  --help     Show this help text

Exit codes:
  0 = success (informational, always passes)
  2 = execution error

Example:
  audit-cli source-audit --dsn "postgres://u:p@h/orion" --tables "all"`)
}

// SourceAuditParseArgs parses flag arguments into a map.
func SourceAuditParseArgs(args []string) (map[string]string, bool) {
	flags := make(map[string]string)
	for i := 0; i < len(args); i++ {
		if args[i] == "--help" || args[i] == "-h" {
			SourceAuditHelp()
			return nil, true
		}
		if strings.HasPrefix(args[i], "--") && i+1 < len(args) {
			key := strings.TrimPrefix(args[i], "--")
			flags[key] = args[i+1]
			i++
		}
	}
	return flags, false
}
