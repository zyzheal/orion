// Package integration provides test helpers for database-backed integration
// tests.
package integration

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"
)

// TestDB is the recommended way to open a database connection for a test.
// If no DSN is configured, it skips the test via t.Skip().
func TestDB(t *testing.T) *DBProvider {
	t.Helper()
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	cfg := NewConfig()
	provider, err := NewDBProvider(cfg)
	if err != nil {
		t.Skipf("skipping integration test: %v", err)
	}
	return provider
}

// TxWithRollback begins a transaction and registers automatic rollback via
// t.Cleanup. This ensures tests are isolated and no data leaks between runs.
// The caller MUST NOT commit the transaction.
func TxWithRollback(ctx context.Context, t *testing.T, provider *DBProvider) *sql.Tx {
	t.Helper()
	tx, err := provider.BeginTx(ctx)
	if err != nil {
		t.Fatalf("failed to begin test transaction: %v", err)
	}
	t.Cleanup(func() {
		// Rollback the test transaction to clean up any data.
		if rbErr := tx.Rollback(); rbErr != nil && rbErr != sql.ErrTxDone {
			fmt.Printf("test cleanup: rollback error: %v\n", rbErr)
		}
	})
	return tx
}

// TxWithRollbackSqlx begins a transaction on a sqlx.DB and registers rollback.
// Use this when you need sqlx query helpers (Get, Select, NamedExec).
func TxWithRollbackSqlx(ctx context.Context, t *testing.T, db *sql.DB) *sql.Tx {
	t.Helper()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("failed to begin test transaction: %v", err)
	}
	t.Cleanup(func() {
		if rbErr := tx.Rollback(); rbErr != nil && rbErr != sql.ErrTxDone {
			fmt.Printf("test cleanup: rollback error: %v\n", rbErr)
		}
	})
	return tx
}

// ExecTx runs a statement on the given transaction.
func ExecTx(ctx context.Context, tx *sql.Tx, stmt string, args ...interface{}) error {
	_, err := tx.ExecContext(ctx, stmt, args...)
	return err
}

// QueryRowTx runs a single-row query on the given transaction.
func QueryRowTx(ctx context.Context, tx *sql.Tx, stmt string, args ...interface{}) *sql.Row {
	return tx.QueryRowContext(ctx, stmt, args...)
}

// QueryTx runs a multi-row query on the given transaction.
func QueryTx(ctx context.Context, tx *sql.Tx, stmt string, args ...interface{}) (*sql.Rows, error) {
	return tx.QueryContext(ctx, stmt, args...)
}

// MustUUID generates a v4 UUID string for test data.
func MustUUID() string {
	// Use a deterministic-ish but unique enough value for test IDs.
	return fmt.Sprintf("test-%d", time.Now().UnixNano())
}

// CreateTableIfNotExists creates a table only if it does not exist,
// returning false if it already exists. Useful for test setup.
func CreateTableIfNotExists(ctx context.Context, provider *DBProvider, stmt string) error {
	stmt = fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s", stmt)
	_, err := provider.DB().ExecContext(ctx, stmt)
	return err
}

// DropAndRecreateTable drops a table if it exists, then creates it.
func DropAndRecreateTable(ctx context.Context, provider *DBProvider, createStmt string) error {
	// Extract table name from CREATE TABLE statement for DROP.
	// This is a simple heuristic: the next word after "CREATE TABLE".
	var tableName string
	_, err := fmt.Sscanf(createStmt, "CREATE TABLE %s", &tableName)
	if err != nil {
		return fmt.Errorf("could not extract table name from create statement")
	}

	_, err = provider.DB().ExecContext(ctx, fmt.Sprintf("DROP TABLE IF EXISTS %s", tableName))
	if err != nil {
		return fmt.Errorf("failed to drop table %s: %w", tableName, err)
	}

	_, err = provider.DB().ExecContext(ctx, createStmt)
	if err != nil {
		return fmt.Errorf("failed to create table %s: %w", tableName, err)
	}

	return err
}
