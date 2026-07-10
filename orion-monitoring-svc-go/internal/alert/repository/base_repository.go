package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"orion/go-common/pkg/database"
)

// BaseRepository wraps go-common DB with alert-specific convenience methods.
type BaseRepository struct {
	db *database.DB
}

// NewBaseRepository creates a new BaseRepository.
func NewBaseRepository(db *database.DB) *BaseRepository {
	return &BaseRepository{db: db}
}

// DB returns the underlying database.DB.
func (r *BaseRepository) DB() *database.DB {
	return r.db
}

// Now returns the current database time as a sql.NullTime (used for UPDATE SET).
func (r *BaseRepository) Now() sql.NullTime {
	now := time.Now()
	return sql.NullTime{Time: now, Valid: true}
}

// ZeroTime returns the zero time value for comparison.
func (r *BaseRepository) ZeroTime() time.Time {
	return time.Time{}
}

// Get executes a query expected to return at most one row.
func (r *BaseRepository) Get(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	return r.db.GetContext(ctx, dest, query, args...)
}

// Select executes a query expected to return multiple rows.
func (r *BaseRepository) Select(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	return r.db.SelectContext(ctx, dest, query, args...)
}

// Exec executes a query without returning any rows.
func (r *BaseRepository) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return r.db.ExecContext(ctx, query, args...)
}

// NamedExec executes a query with named parameters (uses sqlx.Named).
func (r *BaseRepository) NamedExec(ctx context.Context, query string, param interface{}) error {
	_, err := r.db.NamedExecContext(ctx, query, param)
	return err
}

// QueryRow executes a query that returns a single row.
func (r *BaseRepository) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	return r.db.DB.QueryRowContext(ctx, query, args...)
}

// Scan scans a single row into dest.
func (r *BaseRepository) Scan(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	return r.Get(ctx, dest, query, args...)
}

// SelectWithNamed executes a SELECT with named parameters.
func (r *BaseRepository) SelectWithNamed(ctx context.Context, dest interface{}, query string, param interface{}) error {
	_, err := r.db.NamedQueryContext(ctx, query, param)
	if err != nil {
		return err
	}
	return nil
}

// ValidateIdentifier checks that a table name is a safe SQL identifier.
func (r *BaseRepository) ValidateIdentifier(name string) error {
	if name == "" || len(name) > 64 {
		return fmt.Errorf("invalid table name: %q", name)
	}
	return nil
}
