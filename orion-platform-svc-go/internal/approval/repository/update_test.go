package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func newMockApprovalRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

// UpdateApprovalRequest is the single write behind all six workflow transitions
// (review, approve, reject, withdraw, cancel, delegate), so when it silently
// rewrote the status column every one of them reported a success that never
// happened.
func TestUpdateApprovalRequest_WritesTheCallerColumns(t *testing.T) {
	mock, repo := newMockApprovalRepo(t)
	mock.ExpectQuery(`SELECT * FROM approval_requests WHERE id=$1 AND tenant_id=$2`).
		WithArgs("a-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("a-1", "t-1"))
	mock.ExpectExec(`UPDATE approval_requests SET current_level = $1, status = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5`).
		WithArgs(2, "approved", sqlmock.AnyArg(), "a-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.UpdateApprovalRequest(context.Background(), "t-1", "a-1", map[string]interface{}{
		"status":        "approved",
		"current_level": 2,
	}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

// type/total_levels are read-only once submitted; neither may reach the SQL.
func TestUpdateApprovalRequest_RejectsColumnsOutsideTheWhitelist(t *testing.T) {
	mock, repo := newMockApprovalRepo(t)
	mock.ExpectQuery(`SELECT * FROM approval_requests WHERE id=$1 AND tenant_id=$2`).
		WithArgs("a-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("a-1", "t-1"))
	if err := repo.UpdateApprovalRequest(context.Background(), "t-1", "a-1", map[string]interface{}{
		"type":         "change",
		"total_levels": 99,
	}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateApprovalRequest_MissingRowReportsNotFound(t *testing.T) {
	mock, repo := newMockApprovalRepo(t)
	mock.ExpectQuery(`SELECT * FROM approval_requests WHERE id=$1 AND tenant_id=$2`).
		WithArgs("missing", "t-1").WillReturnError(sql.ErrNoRows)
	err := repo.UpdateApprovalRequest(context.Background(), "t-1", "missing", map[string]interface{}{"status": "approved"})
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("err = %v, want ErrNoRows", err)
	}
}
