// Package commands provides shared utilities for audit CLI commands.
package commands

import (
	"database/sql"
	"fmt"
	"strings"
)

// openDB opens a PostgreSQL connection given a DSN.
func openDB(dsn string) (*sql.DB, error) {
	if dsn == "" {
		return nil, fmt.Errorf("DSN is required")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	return db, nil
}

// requireFlag returns the value for the given flag or an error if absent.
func requireFlag(args map[string]string, flag string) (string, error) {
	v := args[flag]
	if v == "" {
		return "", fmt.Errorf("--%s is required", flag)
	}
	return v, nil
}

// parseTables parses a comma-separated table list. If value is "all", returns
// nil to signal the caller should enumerate all tables.
func parseTables(value string) []string {
	if strings.TrimSpace(value) == "all" {
		return nil
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		t := strings.TrimSpace(p)
		if t != "" {
			result = append(result, t)
		}
	}
	return result
}

// listAllTables returns all user tables in the database (non-system schemas).
func listAllTables(db *sql.DB) ([]string, error) {
	rows, err := db.Query(`
		SELECT tablename FROM pg_catalog.pg_tables
		WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
		ORDER BY tablename
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		tables = append(tables, name)
	}
	return tables, rows.Err()
}
