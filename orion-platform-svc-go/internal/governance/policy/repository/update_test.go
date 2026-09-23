package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func newMockUpdatePolicy(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

// Update used to write updates[updated_at] and then run a bare SET updated_at=NOW() that never read the map, so PUT /:id renamed no policy.
func TestUpdatePolicy_WritesTheCallerColumns(t *testing.T) {
	mock, repo := newMockUpdatePolicy(t)
	mock.ExpectQuery(`SELECT * FROM policy WHERE id=$1 AND tenant_id=$2`).
		WithArgs("g-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("g-1", "t-1"))
	mock.ExpectExec(`UPDATE policy SET name = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`).
		WithArgs("no direct prod deploy", sqlmock.AnyArg(), "g-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	if err := repo.Update(context.Background(), "t-1", "g-1", map[string]interface{}{"name": "no direct prod deploy"}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

// tenant_id is the row key and must never be written by an update call.
func TestUpdatePolicy_RejectsColumnsOutsideTheWhitelist(t *testing.T) {
	mock, repo := newMockUpdatePolicy(t)
	mock.ExpectQuery(`SELECT * FROM policy WHERE id=$1 AND tenant_id=$2`).
		WithArgs("g-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("g-1", "t-1"))
	if err := repo.Update(context.Background(), "t-1", "g-1", map[string]interface{}{"tenant_id": "attacker-controlled"}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpdatePolicy_MissingRowReportsNotFound(t *testing.T) {
	mock, repo := newMockUpdatePolicy(t)
	mock.ExpectQuery(`SELECT * FROM policy WHERE id=$1 AND tenant_id=$2`).
		WithArgs("missing", "t-1").WillReturnError(sql.ErrNoRows)
	if err := repo.Update(context.Background(), "t-1", "missing", map[string]interface{}{"name": "x"}); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("err = %v, want ErrNoRows", err)
	}
}
