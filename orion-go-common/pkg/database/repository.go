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
	db *sqlx.DB
}

// NewBaseRepository creates a new BaseRepository.
func NewBaseRepository(db *sqlx.DB) BaseRepository {
	return BaseRepository{db: db}
}

// DB returns the underlying sqlx.DB.
func (r *BaseRepository) DB() *sqlx.DB {
	return r.db
}

// Exists checks if a row exists in the given table matching the WHERE clause.
// The table parameter must be a valid SQL identifier (alphanumeric + underscore).
// The where parameter should use positional placeholders ($1, $2, ...) for values.
func (r *BaseRepository) Exists(ctx context.Context, table, where string, args ...interface{}) (bool, error) {
	if err := validateIdentifier(table); err != nil {
		return false, err
	}
	var exists bool
	query := fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM %s WHERE %s)", table, where)
	err := r.db.GetContext(ctx, &exists, query, args...)
	return exists, err
}

// Count returns the count of rows matching the WHERE clause.
// The table parameter must be a valid SQL identifier (alphanumeric + underscore).
// The where parameter should use positional placeholders ($1, $2, ...) for values.
func (r *BaseRepository) Count(ctx context.Context, table, where string, args ...interface{}) (int, error) {
	if err := validateIdentifier(table); err != nil {
		return 0, err
	}
	var count int
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s", table, where)
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

// SoftDelete sets status='deleted' and updated_at=now() for the given row.
// The table parameter must be a valid SQL identifier.
func (r *BaseRepository) SoftDelete(ctx context.Context, table, id string) error {
	if err := validateIdentifier(table); err != nil {
		return err
	}
	query := fmt.Sprintf("UPDATE %s SET status = 'deleted', updated_at = now() WHERE id = $1", table)
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// UpdateStatus updates the status column for the given row.
// The table parameter must be a valid SQL identifier.
func (r *BaseRepository) UpdateStatus(ctx context.Context, table, id, status string) error {
	if err := validateIdentifier(table); err != nil {
		return err
	}
	query := fmt.Sprintf("UPDATE %s SET status = $1, updated_at = now() WHERE id = $2", table)
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
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
