package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func newMockUpdatePortal(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

// Update used to run UPDATE developer_portals SET updated_at=NOW() and discard the map, so PUT :id returned 200 with the old name.
func TestUpdatePortal_WritesTheCallerColumns(t *testing.T) {
	mock, repo := newMockUpdatePortal(t)
	mock.ExpectQuery(`SELECT * FROM developer_portals WHERE id=$1 AND tenant_id=$2`).
		WithArgs("p-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("p-1", "t-1"))
	mock.ExpectExec(`UPDATE developer_portals SET name = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`).
		WithArgs("dev hub", sqlmock.AnyArg(), "p-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	if err := repo.Update(context.Background(), "t-1", "p-1", map[string]any{"name": "dev hub"}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

// tenant_id is the row key and must never be written by an update call.
func TestUpdatePortal_RejectsColumnsOutsideTheWhitelist(t *testing.T) {
	mock, repo := newMockUpdatePortal(t)
	mock.ExpectQuery(`SELECT * FROM developer_portals WHERE id=$1 AND tenant_id=$2`).
		WithArgs("p-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("p-1", "t-1"))
	if err := repo.Update(context.Background(), "t-1", "p-1", map[string]any{"tenant_id": "attacker-controlled"}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpdatePortal_MissingRowReportsNotFound(t *testing.T) {
	mock, repo := newMockUpdatePortal(t)
	mock.ExpectQuery(`SELECT * FROM developer_portals WHERE id=$1 AND tenant_id=$2`).
		WithArgs("missing", "t-1").WillReturnError(sql.ErrNoRows)
	if err := repo.Update(context.Background(), "t-1", "missing", map[string]any{"name": "x"}); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("err = %v, want ErrNoRows", err)
	}
}
