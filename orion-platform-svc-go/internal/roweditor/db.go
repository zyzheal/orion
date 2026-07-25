// Package roweditor provides a generic, table-level Row Editor that supports
// inline cell/row editing, CRUD and batch operations, validation, and
// automatic rollback on transaction failure.
//
// It is intentionally dependency-light: it only needs a DB interface (from
// go-common/pkg/database) and works with any SQL database via sqlx.
package roweditor

import (
	"context"
	"database/sql"

	_ "github.com/lib/pq"
	"github.com/jmoiron/sqlx"
)

// DBOperations abstracts the database calls the editor needs.  The concrete
// implementation is built from orion/go-common/pkg/database.DB.
type DBOperations interface {
	// ExecContext executes a statement, returning result metadata.
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)

	// GetContext retrieves one row into the destination.
	GetContext(ctx context.Context, dest any, query string, args ...any) error

	// SelectContext retrieves many rows into the destination.
	SelectContext(ctx context.Context, dest any, query string, args ...any) error

	// NamedExecContext executes a statement using named parameters.
	NamedExecContext(ctx context.Context, query string, arg any) (sql.Result, error)

	// BeginTxx starts a transaction (nil config = defaults).
	BeginTxx(ctx context.Context, cfg *sql.TxOptions) (*sqlx.Tx, error)
}

// TxOperations mirrors DBOperations but operates on an in-flight transaction.
type TxOperations interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	GetContext(ctx context.Context, dest any, query string, args ...any) error
	SelectContext(ctx context.Context, dest any, query string, args ...any) error
	NamedExecContext(ctx context.Context, query string, arg any) (sql.Result, error)
	Commit() error
	Rollback()
}

// DBFromGoCommon wraps an orion/go-common/pkg/database.DB to satisfy
// DBOperations.  It is a thin adapter so the editor does not hard-code the
// shared package.
type DBFromGoCommon struct {
	db DBOperations
}

// NewDBFromGoCommon builds the adapter.
func NewDBFromGoCommon(db DBOperations) *DBFromGoCommon {
	return &DBFromGoCommon{db: db}
}

// ExecContext delegates to the wrapped DB.
func (w *DBFromGoCommon) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return w.db.ExecContext(ctx, query, args...)
}

// GetContext delegates to the wrapped DB.
func (w *DBFromGoCommon) GetContext(ctx context.Context, dest any, query string, args ...any) error {
	return w.db.GetContext(ctx, dest, query, args...)
}

// SelectContext delegates to the wrapped DB.
func (w *DBFromGoCommon) SelectContext(ctx context.Context, dest any, query string, args ...any) error {
	return w.db.SelectContext(ctx, dest, query, args...)
}

// NamedExecContext delegates to the wrapped DB.
func (w *DBFromGoCommon) NamedExecContext(ctx context.Context, query string, arg any) (sql.Result, error) {
	return w.db.NamedExecContext(ctx, query, arg)
}

// BeginTxx delegates to the wrapped DB.
func (w *DBFromGoCommon) BeginTxx(ctx context.Context, cfg *sql.TxOptions) (*sqlx.Tx, error) {
	return w.db.BeginTxx(ctx, cfg)
}
