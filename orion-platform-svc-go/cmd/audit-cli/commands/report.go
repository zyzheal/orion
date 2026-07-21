// Package commands implements the report subcommand for audit-cli.
// It generates a comprehensive JSON audit report.
package commands

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"orion/platform-svc-go/cmd/audit-cli/types"
)

// ReportCommand generates a full audit report.
func ReportCommand(args map[string]string) int {
	dsn, err := requireFlag(args, "dsn")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return types.ExitErr
	}
	outputFile := args["output"]

	db, err := openDB(dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error connecting to database: %v\n", err)
		return types.ExitErr
	}
	defer db.Close()

	report := &types.FullReport{
		Overall:       "pass",
		TablesChecked: 0,
		Discrepancies: 0,
	}

	// 1. Source audit (single database)
	sourceResult := runSourceAudit(db)
	report.Source = sourceResult
	if sourceResult != nil {
		report.TablesChecked += len(sourceResult.Tables)
	}

	// 2. Migration status
	report.Migrations = runMigrationAudit(db)

	// 3. FK integrity
	fkResults := runFKAudit(db)
	report.Referential = fkResults

	// Determine overall status
	if len(report.Referential) > 0 {
		report.Discrepancies += len(report.Referential)
		report.Overall = "warning"
	}

	// Output report
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error marshaling report: %v\n", err)
		return types.ExitErr
	}

	if outputFile != "" {
		if err := os.WriteFile(outputFile, data, 0644); err != nil {
			fmt.Fprintf(os.Stderr, "error writing report to %s: %v\n", outputFile, err)
			return types.ExitErr
		}
		fmt.Printf("Report written to %s\n", outputFile)
	} else {
		fmt.Println(string(data))
	}

	if report.Overall == "pass" {
		return types.ExitPass
	}
	return types.ExitDiff
}

// runSourceAudit runs source column audit on all tables.
func runSourceAudit(db *sql.DB) *types.SourceAuditResult {
	tables, err := listAllTables(db)
	if err != nil {
		return nil
	}

	result := &types.SourceAuditResult{}
	for _, table := range tables {
		dist, err := auditSourceColumn(db, table)
		if err != nil {
			continue // skip tables without _source
		}
		result.Tables = append(result.Tables, types.SourceDist{
			Table:       dist.Table,
			Total:       dist.Total,
			SourceTS:    dist.SourceTS,
			SourceGo:    dist.SourceGo,
			SourceEmpty: dist.SourceEmpty,
		})
	}
	return result
}

// runMigrationAudit checks applied migrations.
func runMigrationAudit(db *sql.DB) []types.MigrationStatus {
	// Try common migration tracking tables
	tables := []string{"schema_migrations", "flyway_schema_history", "alembic_version"}
	for _, tableName := range tables {
		exists, err := tableExists(db, tableName)
		if err == nil && exists {
			return readMigrations(db, tableName)
		}
	}

	// Check for custom migration tracking
	rows, err := db.Query(`
		SELECT tablename FROM pg_catalog.pg_tables
		WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
		AND tablename ILIKE '%migration%'
	`)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var migrationTables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err == nil {
			migrationTables = append(migrationTables, name)
		}
	}

	var result []types.MigrationStatus
	for _, t := range migrationTables {
		statuses := readMigrations(db, t)
		result = append(result, statuses...)
	}
	return result
}

// tableExists checks if a table exists in the database.
func tableExists(db *sql.DB, table string) (bool, error) {
	var exists bool
	err := db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_name = $1
		)
	`, table).Scan(&exists)
	return exists, err
}

// readMigrations reads migration status from a tracking table.
func readMigrations(db *sql.DB, table string) []types.MigrationStatus {
	var result []types.MigrationStatus

	// Common patterns: version/installed_rank, description, installed_on
	// Try a generic query first
	rows, err := db.Query(`
		SELECT
			CASE WHEN column_name ILIKE '%%version%%' OR column_name ILIKE '%%version%%'
				THEN 1 ELSE 0 END
		FROM information_schema.columns
		WHERE table_name = $1
	`, table)
	if err != nil {
		return result
	}
	defer rows.Close()

	// Get column names
	cols, _ := db.Query(fmt.Sprintf("SELECT column_name FROM information_schema.columns WHERE table_name = '%s'", table))
	if cols == nil {
		return result
	}
	defer cols.Close()

	var columns []string
	for cols.Next() {
		var col string
		if err := cols.Scan(&col); err == nil {
			columns = append(columns, col)
		}
	}

	if len(columns) == 0 {
		return result
	}

	dataRows, err := db.Query(fmt.Sprintf("SELECT * FROM %s LIMIT 100", table))
	if err != nil {
		return result
	}
	defer dataRows.Close()

	for dataRows.Next() {
		var nulls []any
		for range columns {
			var nilValue any
			nulls = append(nulls, nilValue)
		}
		if err := dataRows.Scan(nulls...); err != nil {
			continue
		}
		var id string
		for i, val := range nulls {
			ptr := val.(*interface{})
			if ptr != nil && *ptr != nil {
				col := columns[i]
				if strings.Contains(strings.ToLower(col), "version") ||
					strings.Contains(strings.ToLower(col), "id") ||
					strings.Contains(strings.ToLower(col), "name") {
					id = fmt.Sprintf("%v", *ptr)
					break
				}
			}
		}
		if id != "" {
			result = append(result, types.MigrationStatus{
				ID:      id,
				Applied: true,
			})
		}
	}
	return result
}

// runFKAudit runs FK integrity check on all tables.
func runFKAudit(db *sql.DB) []types.FKOrphanResult {
	fks, err := listForeignKeys(db)
	if err != nil {
		return nil
	}

	var results []types.FKOrphanResult
	for _, fk := range fks {
		orphanCount, err := countOrphans(db, fk)
		if err != nil {
			continue
		}
		if orphanCount > 0 {
			results = append(results, types.FKOrphanResult{
				Table:       fk.Table,
				ForeignKey:  fk.ForeignKey,
				RefTable:    fk.RefTable,
				OrphanCount: orphanCount,
			})
		}
	}
	return results
}

// ReportHelp prints help text.
func ReportHelp() {
	fmt.Println(`report: Generate a comprehensive audit report.

Usage:
  audit-cli report --dsn <postgres-dsn> [--output report.json]

Flags:
  --dsn      PostgreSQL DSN (required)
  --output   Output file path (default: stdout)
  --help     Show this help text

Exit codes:
  0 = all checks pass
  1 = discrepancies found
  2 = execution error

Report includes:
  - Source attribution (_source column distribution)
  - Migration status (applied migrations)
  - Referential integrity (orphan rows)

Example:
  audit-cli report --dsn "postgres://u:p@h/orion" --output audit-report.json`)
}

// ReportParseArgs parses flag arguments into a map.
func ReportParseArgs(args []string) (map[string]string, bool) {
	flags := make(map[string]string)
	for i := 0; i < len(args); i++ {
		if args[i] == "--help" || args[i] == "-h" {
			ReportHelp()
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
