package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func newMockPolicyRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

// UpdatePolicy used to do "_ = updates; ExecContext(SET updated_at=NOW() ...)".
// The update map was literally discarded, so PUT /policies/:id always returned
// 200 with the untouched row.
func TestUpdatePolicy_WritesTheCallerColumns(t *testing.T) {
	mock, repo := newMockPolicyRepo(t)
	mock.ExpectQuery(`SELECT * FROM worker_policies WHERE id=$1 AND tenant_id=$2`).
		WithArgs("p-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("p-1", "t-1"))
	mock.ExpectExec(`UPDATE worker_policies SET enabled = $1, name = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5`).
		WithArgs(true, "round robin", sqlmock.AnyArg(), "p-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.UpdatePolicy(context.Background(), "t-1", "p-1", map[string]interface{}{
		"name":    "round robin",
		"enabled": true,
	}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpdatePolicy_RejectsColumnsOutsideTheWhitelist(t *testing.T) {
	mock, repo := newMockPolicyRepo(t)
	mock.ExpectQuery(`SELECT * FROM worker_policies WHERE id=$1 AND tenant_id=$2`).
		WithArgs("p-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("p-1", "t-1"))
	if err := repo.UpdatePolicy(context.Background(), "t-1", "p-1", map[string]interface{}{
		"id": "attacker-controlled",
	}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpdatePolicy_MissingRowReportsNotFound(t *testing.T) {
	mock, repo := newMockPolicyRepo(t)
	mock.ExpectQuery(`SELECT * FROM worker_policies WHERE id=$1 AND tenant_id=$2`).
		WithArgs("missing", "t-1").WillReturnError(sql.ErrNoRows)
	err := repo.UpdatePolicy(context.Background(), "t-1", "missing", map[string]interface{}{"name": "x"})
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("err = %v, want ErrNoRows", err)
	}
}
