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

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
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
	//
	// The return type is TxOperations rather than *sqlx.Tx. Returning the
	// concrete transaction type made BatchUpdate and BatchCreate impossible to
	// exercise in a test — no fake can supply a *sqlx.Tx — and it left
	// TxOperations declared but never implemented. The batch paths are the ones
	// that changed the most in the tenant-scoping pass, so they have to be
	// testable.
	BeginTxx(ctx context.Context, cfg *sql.TxOptions) (TxOperations, error)
}

// TxOperations mirrors DBOperations but operates on an in-flight transaction.
// *sqlx.Tx satisfies it, which is what lets DBFromGoCommon return the real
// transaction through BeginTxx.
type TxOperations interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	GetContext(ctx context.Context, dest any, query string, args ...any) error
	SelectContext(ctx context.Context, dest any, query string, args ...any) error
	NamedExecContext(ctx context.Context, query string, arg any) (sql.Result, error)
	Commit() error
	Rollback() error
}

// DBFromGoCommon wraps the sqlx connection held by orion/go-common/pkg/database.DB
// and satisfies DBOperations. It is a thin adapter so the editor does not
// hard-code the shared package.
//
// The field is *sqlx.DB rather than DBOperations because BeginTxx returns
// TxOperations, which *sqlx.DB does not satisfy — its BeginTxx hands back a
// concrete *sqlx.Tx. Holding the connection directly keeps the adapter in step
// with the interface.
type DBFromGoCommon struct {
	db *sqlx.DB
}

// NewDBFromGoCommon builds the adapter.
func NewDBFromGoCommon(db *sqlx.DB) *DBFromGoCommon {
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

// BeginTxx delegates to the wrapped DB. *sqlx.Tx implements TxOperations, so
// the concrete transaction can be returned through the interface.
func (w *DBFromGoCommon) BeginTxx(ctx context.Context, cfg *sql.TxOptions) (TxOperations, error) {
	return w.db.BeginTxx(ctx, cfg)
}
