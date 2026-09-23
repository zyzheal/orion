package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func newMockUpdateRoute(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

// Update used to interpolate the map keys straight into the SET clause with no whitelist and never refreshed updated_at, so a caller could have named id or tenant_id as a column and it would have been rendered into SQL.
func TestUpdateRoute_WritesTheCallerColumns(t *testing.T) {
	mock, repo := newMockUpdateRoute(t)
	mock.ExpectQuery(`SELECT * FROM gateway_routes WHERE id=$1 AND tenant_id=$2`).
		WithArgs("r-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("r-1", "t-1"))
	mock.ExpectExec(`UPDATE gateway_routes SET path = $1, priority = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5`).
		WithArgs("/api/v1/orders", 7, sqlmock.AnyArg(), "r-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	if err := repo.Update(context.Background(), "t-1", "r-1", map[string]interface{}{"path": "/api/v1/orders", "priority": 7}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

// tenant_id is the row key and must never be written by an update call.
func TestUpdateRoute_RejectsColumnsOutsideTheWhitelist(t *testing.T) {
	mock, repo := newMockUpdateRoute(t)
	mock.ExpectQuery(`SELECT * FROM gateway_routes WHERE id=$1 AND tenant_id=$2`).
		WithArgs("r-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("r-1", "t-1"))
	if err := repo.Update(context.Background(), "t-1", "r-1", map[string]interface{}{"tenant_id": "attacker-controlled"}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateRoute_MissingRowReportsNotFound(t *testing.T) {
	mock, repo := newMockUpdateRoute(t)
	mock.ExpectQuery(`SELECT * FROM gateway_routes WHERE id=$1 AND tenant_id=$2`).
		WithArgs("missing", "t-1").WillReturnError(sql.ErrNoRows)
	if err := repo.Update(context.Background(), "t-1", "missing", map[string]interface{}{"path": "x"}); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("err = %v, want ErrNoRows", err)
	}
}
