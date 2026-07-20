// Package commands implements the schema-check subcommand for audit-cli.
// It compares table, column, and index definitions between two PostgreSQL databases.
package commands

import (
	"database/sql"
	"fmt"
	"os"
	"strings"

	"orion/platform-svc-go/cmd/audit-cli/output"
	"orion/platform-svc-go/cmd/audit-cli/types"
)

// SchemaCheckCommand performs a schema comparison between two databases.
func SchemaCheckCommand(args map[string]string) int {
	tsDSN, err := requireFlag(args, "ts-dsn")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v
", err)
		return types.ExitErr
	}
	goDSN, err := requireFlag(args, "go-dsn")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v
", err)
		return types.ExitErr
	}
	format := types.OutputFormat(args["format"])
	if format == "" {
		format = types.FormatTABLE
	}

	tsDB, err := openDB(tsDSN)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error connecting to TS database: %v\n", err)
		return types.ExitErr
	}
	defer tsDB.Close()

	goDB, err := openDB(goDSN)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error connecting to Go database: %v\n", err)
		return types.ExitErr
	}
	defer goDB.Close()

	tsTables, err := listAllTables(tsDB)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error listing TS tables: %v\n", err)
		return types.ExitErr
	}
	goTables, err := listAllTables(goDB)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error listing Go tables: %v\n", err)
		return types.ExitErr
	}

	result := types.SchemaAuditResult{}
	result.TablesInCommon = tableIntersection(tsTables, goTables)

	result.TablesInTSOnly = tableDiff(tsTables, goTables)
	result.TablesInGoOnly = tableDiff(goTables, tsTables)

	// Compare columns for tables that exist in both databases
	for _, table := range result.TablesInCommon {
		tsCols, err := tableColumns(tsDB, table)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warning: cannot read columns for %s (TS): %v\n", table, err)
			continue
		}
		goCols, err := tableColumns(goDB, table)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warning: cannot read columns for %s (Go): %v\n", table, err)
			continue
		}

		colDiff := compareColumns(table, tsCols, goCols)
		result.ColumnDiffs = append(result.ColumnDiffs, colDiff...)
	}

	// Compare indexes for tables that exist in both databases
	for _, table := range result.TablesInCommon {
		tsIdx, err := tableIndexes(tsDB, table)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warning: cannot read indexes for %s (TS): %v\n", table, err)
			continue
		}
		goIdx, err := tableIndexes(goDB, table)
		if err != nil {
			// Not an error; indexes may differ
			continue
		}
		idxDiff := compareIndexes(table, tsIdx, goIdx)
		result.IndexDiffs = append(result.IndexDiffs, idxDiff...)
	}

	out := output.Format(types.DimSchema, &result, format)
	fmt.Println(out)

	if len(result.TablesInTSOnly) > 0 || len(result.TablesInGoOnly) > 0 ||
		len(result.ColumnDiffs) > 0 || len(result.IndexDiffs) > 0 {
		return types.ExitDiff
	}
	return types.ExitPass
}

// tableIntersection returns tables present in both slices.
func tableIntersection(a, b []string) []string {
	set := make(map[string]struct{})
	for _, t := range b {
		set[t] = struct{}{}
	}
	var out []string
	for _, t := range a {
		if _, ok := set[t]; ok {
			out = append(out, t)
		}
	}
	return out
}

// tableDiff returns tables in a but not in b.
func tableDiff(a, b []string) []string {
	set := make(map[string]struct{})
	for _, t := range b {
		set[t] = struct{}{}
	}
	var out []string
	for _, t := range a {
	 if _, ok := set[t]; !ok {
			out = append(out, t)
	 }
	}
	return out
}

// tableColumns returns column name -> data type mapping for a table.
func tableColumns(db *sql.DB, table string) (map[string]string, error) {
	rows, err := db.Query(`
		SELECT column_name, data_type
		FROM information_schema.columns
		WHERE table_name = $1
		ORDER BY ordinal_position
	`, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cols := make(map[string]string)
	for rows.Next() {
		var name, dtype string
		if err := rows.Scan(&name, &dtype); err != nil {
			return nil, err
		}
		cols[name] = dtype
	}
	return cols, rows.Err()
}

// compareColumns returns ColumnDiff entries for columns that differ.
func compareColumns(table string, tsCols, goCols map[string]string) []types.ColumnDiff {
	var diff []types.ColumnDiff

	// Columns in TS only
	for col, tsType := range tsCols {
		if _, ok := goCols[col]; !ok {
			diff = append(diff, types.ColumnDiff{
				Table:    table,
				Column:   col,
				TypeTS:   tsType,
				OnlyInTS: true,
			})
		}
	}

	// Columns in Go only or with different type
	for col, goType := range goCols {
		tsType, inTS := tsCols[col]
		if !inTS {
			diff = append(diff, types.ColumnDiff{
				Table:    table,
				Column:   col,
				TypeGo:   goType,
				OnlyInGo: true,
			})
		} else if normalizeType(tsType) != normalizeType(goType) {
			diff = append(diff, types.ColumnDiff{
				Table:  table,
				Column: col,
				TypeTS: tsType,
				TypeGo: goType,
			})
		}
	}
	return diff
}

// normalizeType lowercases and removes whitespace for comparison.
func normalizeType(t string) string {
	return strings.ToLower(strings.TrimSpace(t))
}

// tableIndexes returns the list of index names for a table.
func tableIndexes(db *sql.DB, table string) ([]string, error) {
	rows, err := db.Query(`
		SELECT indexname
		FROM pg_indexes
		WHERE tablename = $1 AND schemaname NOT IN ('pg_catalog', 'information_schema')
		ORDER BY indexname
	`, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var indexes []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		indexes = append(indexes, name)
	}
	return indexes, rows.Err()
}

// compareIndexes returns IndexDiff entries for indexes that differ.
func compareIndexes(table string, tsIdx, goIdx []string) []types.IndexDiff {
	goSet := make(map[string]struct{})
	for _, idx := range goIdx {
		goSet[idx] = struct{}{}
	}
	var diff []types.IndexDiff
	for _, idx := range tsIdx {
		if _, ok := goSet[idx]; !ok {
			diff = append(diff, types.IndexDiff{
				Table:    table,
				Index:    idx,
				OnlyInTS: true,
			})
		}
	}
	for _, idx := range goIdx {
		inTS := false
		for _, t := range tsIdx {
			if t == idx {
				inTS = true
				break
			}
		}
		if !inTS {
			diff = append(diff, types.IndexDiff{
				Table:    table,
				Index:    idx,
				OnlyInGo: true,
			})
		}
	}
	return diff
}

// SchemaCheckHelp prints help text for the schema-check command.
func SchemaCheckHelp() {
	fmt.Println(`schema-check: Compare DB schemas between TS and Go databases.

Usage:
  audit-cli schema-check --ts-dsn <postgres-dsn> --go-dsn <postgres-dsn> [--format json|csv|table]

Flags:
  --ts-dsn   PostgreSQL DSN for the TS monolith database (required)
  --go-dsn   PostgreSQL DSN for the Go service database (required)
  --format   Output format: json (default for CI), csv, table (default for interactive)
  --help     Show this help text

Exit codes:
  0 = schemas match
  1 = discrepancies found
  2 = execution error

Example:
  audit-cli schema-check --ts-dsn "postgres://user:pass@host/orion-ts" \
                         --go-dsn "postgres://user:pass@host/orion-go"`)
}

// SchemaCheckParseArgs parses flag arguments into a map.
func SchemaCheckParseArgs(args []string) (map[string]string, bool) {
	flags := make(map[string]string)
	for i := 0; i < len(args); i++ {
		if args[i] == "--help" || args[i] == "-h" {
			SchemaCheckHelp()
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
