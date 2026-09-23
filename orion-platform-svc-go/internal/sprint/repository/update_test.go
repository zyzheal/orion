package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func newMockUpdateSprint(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

// Update used to write updates[updated_at] and then run a bare SET updated_at=NOW() that never read the map, so PUT /:id could not change goal, dates, status or capacity.
func TestUpdateSprint_WritesTheCallerColumns(t *testing.T) {
	mock, repo := newMockUpdateSprint(t)
	mock.ExpectQuery(`SELECT * FROM sprints WHERE id=$1 AND tenant_id=$2`).
		WithArgs("s-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("s-1", "t-1"))
	mock.ExpectExec(`UPDATE sprints SET name = $1, status = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5`).
		WithArgs("S9", "done", sqlmock.AnyArg(), "s-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	if err := repo.Update(context.Background(), "t-1", "s-1", map[string]interface{}{"name": "S9", "status": "done"}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

// tenant_id is the row key and must never be written by an update call.
func TestUpdateSprint_RejectsColumnsOutsideTheWhitelist(t *testing.T) {
	mock, repo := newMockUpdateSprint(t)
	mock.ExpectQuery(`SELECT * FROM sprints WHERE id=$1 AND tenant_id=$2`).
		WithArgs("s-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("s-1", "t-1"))
	if err := repo.Update(context.Background(), "t-1", "s-1", map[string]interface{}{"tenant_id": "attacker-controlled"}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateSprint_MissingRowReportsNotFound(t *testing.T) {
	mock, repo := newMockUpdateSprint(t)
	mock.ExpectQuery(`SELECT * FROM sprints WHERE id=$1 AND tenant_id=$2`).
		WithArgs("missing", "t-1").WillReturnError(sql.ErrNoRows)
	if err := repo.Update(context.Background(), "t-1", "missing", map[string]interface{}{"name": "x"}); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("err = %v, want ErrNoRows", err)
	}
}
