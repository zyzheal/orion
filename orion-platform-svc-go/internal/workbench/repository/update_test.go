package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func newMockUpdateWorkbench(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

// Update used to write updates[updated_at] and then run a bare SET updated_at=NOW() that never read the map, so PUT /items/:id renamed nothing.
func TestUpdateWorkbench_WritesTheCallerColumns(t *testing.T) {
	mock, repo := newMockUpdateWorkbench(t)
	mock.ExpectQuery(`SELECT * FROM workbenches WHERE id=$1 AND tenant_id=$2`).
		WithArgs("w-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("w-1", "t-1"))
	mock.ExpectExec(`UPDATE workbenches SET name = $1, updated_at = $2 WHERE id = $3 AND tenant_id = $4`).
		WithArgs("release bench", sqlmock.AnyArg(), "w-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	if err := repo.Update(context.Background(), "t-1", "w-1", map[string]interface{}{"name": "release bench"}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

// tenant_id is the row key and must never be written by an update call.
func TestUpdateWorkbench_RejectsColumnsOutsideTheWhitelist(t *testing.T) {
	mock, repo := newMockUpdateWorkbench(t)
	mock.ExpectQuery(`SELECT * FROM workbenches WHERE id=$1 AND tenant_id=$2`).
		WithArgs("w-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("w-1", "t-1"))
	if err := repo.Update(context.Background(), "t-1", "w-1", map[string]interface{}{"tenant_id": "attacker-controlled"}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateWorkbench_MissingRowReportsNotFound(t *testing.T) {
	mock, repo := newMockUpdateWorkbench(t)
	mock.ExpectQuery(`SELECT * FROM workbenches WHERE id=$1 AND tenant_id=$2`).
		WithArgs("missing", "t-1").WillReturnError(sql.ErrNoRows)
	if err := repo.Update(context.Background(), "t-1", "missing", map[string]interface{}{"name": "x"}); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("err = %v, want ErrNoRows", err)
	}
}
