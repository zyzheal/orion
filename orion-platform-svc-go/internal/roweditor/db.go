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
	"fmt"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// DBOperations abstracts the database calls the editor needs.  The concrete
// implementation is built from orion/go-common/pkg/database.DB.
type DBOperations interface {
	// ExecContext executes a statement, returning result metadata.
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)

	// SelectRowMap retrieves the first row of a SELECT as a map keyed by column
	// name, or sql.ErrNoRows when the statement matches no row.
	//
	// The destination is fixed here instead of a dest any. Read's SELECT * has no
	// destination type that sqlx will scan: Row is a defined map type, and sqlx
	// refuses a map at every column count — by value it reports "must pass a
	// pointer, not a value, to StructScan destination", and by pointer "scannable
	// dest type map with >1 columns". The previous GetContext took a dest any,
	// which let every test double in this package accept a bare Row by value and
	// pass while the real driver refused the call, so GET /rows/:editor/:row_id
	// answered 500 on every request with the route fully wired. Naming the
	// destination here turns that failure into a compile error instead.
	SelectRowMap(ctx context.Context, query string, args ...any) (Row, error)

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

// TxOperations covers the write side of DBOperations on an in-flight
// transaction. Every batch path only executes statements — none of them reads a
// row inside a transaction — so no row-read method is declared here. Keeping
// the read method off the interface also keeps the map-destination trap out of
// the transactional path. *sqlx.Tx satisfies it, which is what lets
// DBFromGoCommon return the real transaction through BeginTxx.
type TxOperations interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
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

// SelectRowMap runs the query and scans the first row into a map keyed by the
// column names the driver reported.
//
// The map cannot be handed to sqlx as a destination; see DBOperations for the
// two errors sqlx returns. The row is therefore assembled from the result's own
// column list, which is what keeps Read generic across tables whose columns the
// editor spec does not enumerate.
//
// lib/pq hands back []byte for character columns, so those are converted to
// string here. Left as []byte, encoding/json would base64 them and the row
// endpoint would have returned unreadable column values.
func (w *DBFromGoCommon) SelectRowMap(ctx context.Context, query string, args ...any) (Row, error) {
	rows, err := w.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		if rows.Err() != nil {
			return nil, rows.Err()
		}
		return nil, sql.ErrNoRows
	}
	return scanRowMap(rows)
}

// scanRowMap zips the result's column names to the values the driver decoded.
func scanRowMap(rows *sql.Rows) (Row, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	values := make([]any, len(columns))
	pointers := make([]any, len(values))
	for i := range values {
		pointers[i] = &values[i]
	}
	if err := rows.Scan(pointers...); err != nil {
		return nil, fmt.Errorf("scan: %w", err)
	}
	row := make(Row, len(columns))
	for i, col := range columns {
		if b, ok := values[i].([]byte); ok {
			values[i] = string(b)
		}
		row[col] = values[i]
	}
	return row, nil
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
