package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func newMockServerlessRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

// UpdateFunction used to issue "UPDATE serverless_functions SET
// updated_at=NOW() WHERE ..." regardless of the map, so PUT /functions/:id
// accepted memory/runtime/handler/etc and changed nothing while returning 200.
func TestUpdateFunction_WritesTheCallerColumns(t *testing.T) {
	mock, repo := newMockServerlessRepo(t)
	mock.ExpectQuery(`SELECT * FROM serverless_functions WHERE id=$1 AND tenant_id=$2`).
		WithArgs("f-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("f-1", "t-1"))
	mock.ExpectExec(`UPDATE serverless_functions SET memory = $1, name = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5`).
		WithArgs(256, "resize-fn", sqlmock.AnyArg(), "f-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.UpdateFunction(context.Background(), "t-1", "f-1", map[string]interface{}{
		"name":   "resize-fn",
		"memory": 256,
	}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

// id is a real serverless_functions column; it is the key and must never be
// written by the update path.
func TestUpdateFunction_RejectsColumnsOutsideTheWhitelist(t *testing.T) {
	mock, repo := newMockServerlessRepo(t)
	mock.ExpectQuery(`SELECT * FROM serverless_functions WHERE id=$1 AND tenant_id=$2`).
		WithArgs("f-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("f-1", "t-1"))
	if err := repo.UpdateFunction(context.Background(), "t-1", "f-1", map[string]interface{}{
		"id": "attacker-controlled",
	}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateFunction_MissingRowReportsNotFound(t *testing.T) {
	mock, repo := newMockServerlessRepo(t)
	mock.ExpectQuery(`SELECT * FROM serverless_functions WHERE id=$1 AND tenant_id=$2`).
		WithArgs("missing", "t-1").WillReturnError(sql.ErrNoRows)
	err := repo.UpdateFunction(context.Background(), "t-1", "missing", map[string]interface{}{"name": "x"})
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("err = %v, want ErrNoRows", err)
	}
}
