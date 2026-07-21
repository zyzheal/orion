// Package commands implements the data-compare subcommand for audit-cli.
// It compares row counts, checksums, and optional foreign key integrity.
package commands

import (
	"crypto/sha256"
	"database/sql"
	"fmt"
	"os"
	"strings"

	"orion/platform-svc-go/cmd/audit-cli/output"
	"orion/platform-svc-go/cmd/audit-cli/types"
)

// DataCompareCommand compares row counts and checksums between two databases.
func DataCompareCommand(args map[string]string) int {
	tsDSN, err := requireFlag(args, "ts-dsn")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return types.ExitErr
	}
	goDSN, err := requireFlag(args, "go-dsn")
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return types.ExitErr
	}
	tableArg := args["tables"]
	checkFK := args["fk"] == "true"
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

	tables := parseTables(tableArg)
	if tables == nil {
		tsAll, err := listAllTables(tsDB)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error listing tables: %v\n", err)
			return types.ExitErr
		}
		goAll, err := listAllTables(goDB)
		if err != nil {
			// ignore
			fmt.Fprintf(os.Stderr, "error listing tables: %v\n", err)
			return types.ExitErr
		}
		tables = tableIntersection(tsAll, goAll)
	}

	result := types.DataCompareResult{}
	for _, table := range tables {
		rowCountTS, err := countRows(tsDB, table)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warning: cannot count rows in %s (TS): %v\n", table, err)
			continue
		}
		rowCountGo, err := countRows(goDB, table)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warning: cannot count rows in %s (Go): %v\n", table, err)
			_ = err
			continue
		}

		checksumTS := ""
		checksumGo := ""
		if rowCountTS <= 10000 {
			checksumTS, err = checksumRows(tsDB, table)
			if err != nil {
				fmt.Fprintf(os.Stderr, "warning: cannot checksum %s (TS): %v\n", table, err)
			}
		}
		if rowCountGo <= 10000 {
			checksumGo, err = checksumRows(goDB, table)
			if err != nil {
				fmt.Fprintf(os.Stderr, "warning: cannot checksum %s (Go): %v\n", table, err)
			}
		}

		matched := rowCountTS == rowCountGo && checksumTS == checksumGo
		result.Tables = append(result.Tables, types.TableDataCompare{
			Table:      table,
			RowCountTS: rowCountTS,
			RowCountGo: rowCountGo,
			ChecksumTS: checksumTS,
			ChecksumGo: checksumGo,
			Matched:    matched,
		})
	}

	out := output.Format(types.DimData, &result, format)
	fmt.Println(out)

	if checkFK {
		fmt.Println("\n--- Referential Integrity Check ---")
		fkResults := checkFKIntegrity(tsDB, goDB, tables)
		fkOut := output.Format(types.DimRefIntegrity, &fkResults, format)
		fmt.Println(fkOut)
	}

	hasDiff := false
	for _, t := range result.Tables {
		if !t.Matched {
			hasDiff = true
			break
		}
	}
	if hasDiff {
		return types.ExitDiff
	}
	return types.ExitPass
}

// countRows returns the number of rows in a table.
func countRows(db *sql.DB, table string) (int64, error) {
	var count int64
	err := db.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&count)
	return count, err
}

// checksumRows returns a SHA256 hex checksum of all rows.
func checksumRows(db *sql.DB, table string) (string, error) {
	rows, err := db.Query(
		"SELECT column_name FROM information_schema.columns "+
			"WHERE table_name = $1 ORDER BY ordinal_position", table)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	var columns []string
	for rows.Next() {
		var col string
		if err := rows.Scan(&col); err != nil {
			return "", err
		}
		columns = append(columns, col)
	}

	if len(columns) == 0 {
		return "", fmt.Errorf("no columns found in table %s", table)
	}

	colList := strings.Join(columns, ", ")
	dataRows, err := db.Query("SELECT " + colList + " FROM " + table)
	if err != nil {
		return "", err
	}
	defer dataRows.Close()

	hasher := sha256.New()
	for dataRows.Next() {
		var nulls []interface{}
		for range columns {
			nulls = append(nulls, interface{}(nil))
		}
		if err := dataRows.Scan(nulls...); err != nil {
			return "", err
		}
		hasher.Write([]byte(fmt.Sprintf("%v", nulls)))
	}
	return fmt.Sprintf("%x", hasher.Sum(nil)), dataRows.Err()
}

// fkConstraint holds a foreign key constraint definition.
type fkConstraint struct {
	Table      string
	ForeignKey string
	RefTable   string
	Cols       string
	RefCols    string
}

// listForeignKeys returns foreign key constraints using information_schema.
func listForeignKeys(db *sql.DB) ([]fkConstraint, error) {
	rows, err := db.Query(`
		SELECT
			cu.table_name AS table_name,
			cu.constraint_name AS fk_name,
			cu2.table_name AS ref_table,
			string_agg(cu.column_name, ', ' ORDER BY cu.ordinal_position) AS cols,
			string_agg(cu2.column_name, ', ' ORDER BY cu2.ordinal_position) AS ref_cols
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage cu
			ON tc.constraint_name = cu.constraint_name
			AND tc.table_schema = cu.table_schema
		JOIN information_schema.referential_constraints rc
			ON tc.constraint_name = rc.constraint_name
			AND tc.table_schema = rc.constraint_schema
		JOIN information_schema.key_column_usage cu2
			ON rc.unique_constraint_name = cu2.constraint_name
			AND rc.unique_constraint_schema = cu2.table_schema
		WHERE tc.constraint_type = 'FOREIGN KEY'
		AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
		GROUP BY cu.table_name, cu.constraint_name, cu2.table_name
		ORDER BY cu.table_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var fks []fkConstraint
	for rows.Next() {
		var fk fkConstraint
		if err := rows.Scan(&fk.Table, &fk.ForeignKey, &fk.RefTable, &fk.Cols, &fk.RefCols); err != nil {
			return nil, err
		}
		_ = fk
		fks = append(fks, fk)
	}
	return fks, rows.Err()
}

// countOrphans counts rows referencing non-existent parent rows.
func countOrphans(db *sql.DB, fk fkConstraint) (int64, error) {
	if fk.Cols == "" || fk.RefCols == "" {
		return 0, fmt.Errorf("no column info for FK %s", fk.ForeignKey)
	}
	query := "SELECT COUNT(*) FROM " + fk.Table + " child WHERE child." +
		fk.Cols + " IS NOT NULL AND NOT EXISTS (SELECT 1 FROM " +
		fk.RefTable + " parent WHERE parent." + fk.RefCols + " = child." + fk.Cols + ")"
	var count int64
	err := db.QueryRow(query).Scan(&count)
	return count, err
}

// checkFKIntegrity checks for orphaned rows in both databases.
func checkFKIntegrity(tsDB, goDB *sql.DB, tables []string) []types.FKOrphanResult {
	var results []types.FKOrphanResult
	dbs := map[string]*sql.DB{"TS": tsDB, "Go": goDB}
	for _, db := range dbs {
		fks, err := listForeignKeys(db)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warning: cannot list FKs: %v\n", err)
			continue
		}
		for _, c := range fks {
			if !containsTable(tables, c.Table) {
				continue
			}
			orphanCount, err := countOrphans(db, c)
			if err != nil {
				fmt.Fprintf(os.Stderr, "warning: cannot count orphans for %s.%s: %v\n", c.Table, c.ForeignKey, err)
				continue
			}
			if orphanCount > 0 {
				results = append(results, types.FKOrphanResult{
					Table:       c.Table,
					ForeignKey:  c.ForeignKey,
					RefTable:    c.RefTable,
					OrphanCount: orphanCount,
				})
			}
		}
	}
	return results
}

// containsTable checks if a table name is in a list. Empty list means all.
func containsTable(tables []string, name string) bool {
	if len(tables) == 0 {
		return true
	}
	for _, t := range tables {
		if t == name {
			return true
		}
	}
	return false
}

// DataCompareHelp prints help text.
func DataCompareHelp() {
	fmt.Println(`data-compare: Compare row counts and checksums between TS and Go databases.

Usage:
  audit-cli data-compare --ts-dsn <postgres-dsn> --go-dsn <postgres-dsn>
                         [--tables "t1,t2"] [--fk] [--format json|csv|table]

Flags:
  --ts-dsn   PostgreSQL DSN for the TS monolith database (required)
  --go-dsn   PostgreSQL DSN for the Go service database (required)
  --tables   Comma-separated list of tables to compare, or "all" (default: all)
  --fk       Also check referential integrity (orphan rows)
  --format   Output format: json, csv, table (default)
  --help     Show this help text

Exit codes:
  0 = data matches
  1 = discrepancies found
  2 = execution error

Example:
  audit-cli data-compare --ts-dsn "postgres://u:p@h/ts" --go-dsn "postgres://u:p@h/go" \
                         --tables "tickets,approvals,feature_flags" --fk`)
}

// DataCompareParseArgs parses flag arguments into a map.
func DataCompareParseArgs(args []string) (map[string]string, bool) {
	flags := make(map[string]string)
	for i := 0; i < len(args); i++ {
		if args[i] == "--help" || args[i] == "-h" {
			DataCompareHelp()
			return nil, true
		}
		if args[i] == "--fk" {
			flags["fk"] = "true"
		} else if strings.HasPrefix(args[i], "--") && i+1 < len(args) {
			key := strings.TrimPrefix(args[i], "--")
			flags[key] = args[i+1]
			i++
		}
	}
	return flags, false
}
