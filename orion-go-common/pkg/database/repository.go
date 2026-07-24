package database

import (
	"context"
	"fmt"
	"regexp"

	"github.com/jmoiron/sqlx"
)

// validIdentifier matches safe SQL identifiers (alphanumeric + underscore, optionally dotted).
var validIdentifier = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_.]*$`)

// validateIdentifier checks that a string is a safe SQL identifier (table name, column name).
// Allows dotted names like "schema.table".
func validateIdentifier(name string) error {
	if !validIdentifier.MatchString(name) {
		return fmt.Errorf("invalid SQL identifier: %q", name)
	}
	return nil
}

// BaseRepository provides common database operations for all repositories.
// Embed this in service-specific repositories.
type BaseRepository struct {
	db *DB
}

// NewBaseRepository creates a new BaseRepository.
func NewBaseRepository(db *DB) BaseRepository {
	return BaseRepository{db: db}
}

// DB returns the underlying database.DB.
func (r *BaseRepository) DB() *DB {
	return r.db
}

// Exists checks if a row exists in the given table for a specific tenant.
// The table parameter must be a valid SQL identifier (alphanumeric + underscore).
// tenantID is mandatory for multi-tenant isolation.
// The where parameter should use positional placeholders ($3, $4, ...) for additional conditions.
func (r *BaseRepository) Exists(ctx context.Context, table, tenantID, where string, args ...interface{}) (bool, error) {
	if err := validateIdentifier(table); err != nil {
		return false, err
	}
	var exists bool
	query := fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM %s WHERE tenant_id = $1 AND %s)", table, where)
	allArgs := append([]interface{}{tenantID}, args...)
	err := r.db.GetContext(ctx, &exists, query, allArgs...)
	return exists, err
}

// Count returns the count of rows matching the WHERE clause for a specific tenant.
// The table parameter must be a valid SQL identifier (alphanumeric + underscore).
// tenantID is mandatory for multi-tenant isolation.
// The where parameter should use positional placeholders ($3, $4, ...) for additional conditions.
func (r *BaseRepository) Count(ctx context.Context, table, tenantID, where string, args ...interface{}) (int, error) {
	if err := validateIdentifier(table); err != nil {
		return 0, err
	}
	var count int
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE tenant_id = $1 AND %s", table, where)
	allArgs := append([]interface{}{tenantID}, args...)
	err := r.db.GetContext(ctx, &count, query, allArgs...)
	return count, err
}

// SoftDelete sets status='deleted' and updated_at=now() for a specific tenant's row.
// The table parameter must be a valid SQL identifier.
// tenantID is mandatory for multi-tenant isolation.
func (r *BaseRepository) SoftDelete(ctx context.Context, table, tenantID, id string) error {
	if err := validateIdentifier(table); err != nil {
		return err
	}
	query := fmt.Sprintf("UPDATE %s SET status = 'deleted', updated_at = now() WHERE id = $1 AND tenant_id = $2", table)
	_, err := r.db.ExecContext(ctx, query, id, tenantID)
	return err
}

// UpdateStatus updates the status column for a specific tenant's row.
// The table parameter must be a valid SQL identifier.
// tenantID is mandatory for multi-tenant isolation.
func (r *BaseRepository) UpdateStatus(ctx context.Context, table, tenantID, id, status string) error {
	if err := validateIdentifier(table); err != nil {
		return err
	}
	query := fmt.Sprintf("UPDATE %s SET status = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3", table)
	_, err := r.db.ExecContext(ctx, query, status, id, tenantID)
	return err
}

// FindOne retrieves a single row by ID with tenant isolation.
// The dest parameter must be a pointer to the target struct.
func (r *BaseRepository) FindOne(ctx context.Context, table, tenantID, id string, dest interface{}) error {
	if err := validateIdentifier(table); err != nil {
		return err
	}
	query := fmt.Sprintf("SELECT * FROM %s WHERE id = $1 AND tenant_id = $2 AND status != 'deleted'", table)
	return r.db.GetContext(ctx, dest, query, id, tenantID)
}

// FindList retrieves rows matching a WHERE clause with tenant isolation.
// The where parameter should use positional placeholders ($3, $4, ...) for additional conditions.
// The dest parameter must be a pointer to a slice of the target struct.
func (r *BaseRepository) FindList(ctx context.Context, table, tenantID, where string, dest interface{}, args ...interface{}) error {
	if err := validateIdentifier(table); err != nil {
		return err
	}
	query := fmt.Sprintf("SELECT * FROM %s WHERE tenant_id = $1 AND status != 'deleted' AND %s", table, where)
	allArgs := append([]interface{}{tenantID}, args...)
	return r.db.SelectContext(ctx, dest, query, allArgs...)
}

// Tx executes fn within a database transaction.
func (r *BaseRepository) Tx(ctx context.Context, fn func(tx *sqlx.Tx) error) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}
