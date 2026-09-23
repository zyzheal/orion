package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func newMockUpdateAccount(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

// UpdateAccount used to run UPDATE cloud_accounts SET updated_at=NOW() and ignore the map, so PUT /providers/:id returned 200 with the stale account.
func TestUpdateAccount_WritesTheCallerColumns(t *testing.T) {
	mock, repo := newMockUpdateAccount(t)
	mock.ExpectQuery(`SELECT * FROM cloud_accounts WHERE id=$1 AND tenant_id=$2`).
		WithArgs("a-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("a-1", "t-1"))
	mock.ExpectExec(`UPDATE cloud_accounts SET account_name = $1, status = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5`).
		WithArgs("prod-eu", "active", sqlmock.AnyArg(), "a-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`SELECT * FROM cloud_accounts WHERE id=$1 AND tenant_id=$2`).
		WithArgs("a-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "account_name", "status"}).
			AddRow("a-1", "t-1", "prod-eu", "active"))
	got, err := repo.UpdateAccount(context.Background(), "t-1", "a-1", map[string]interface{}{
		"account_name": "prod-eu",
		"status":       "active",
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.AccountName != "prod-eu" || got.Status != "active" {
		t.Fatalf("row = %v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

// account_id is a real cloud_accounts column but identifies the credential and is not writable here.
func TestUpdateAccount_RejectsColumnsOutsideTheWhitelist(t *testing.T) {
	mock, repo := newMockUpdateAccount(t)
	mock.ExpectQuery(`SELECT * FROM cloud_accounts WHERE id=$1 AND tenant_id=$2`).
		WithArgs("a-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("a-1", "t-1"))
	got, err := repo.UpdateAccount(context.Background(), "t-1", "a-1", map[string]interface{}{"account_id": "attacker-controlled"})
	if err != nil {
		t.Fatal(err)
	}
	if got.AccountID != "" {
		t.Fatalf("row = %v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateAccount_MissingRowReportsNotFound(t *testing.T) {
	mock, repo := newMockUpdateAccount(t)
	mock.ExpectQuery(`SELECT * FROM cloud_accounts WHERE id=$1 AND tenant_id=$2`).
		WithArgs("missing", "t-1").WillReturnError(sql.ErrNoRows)
	if _, err := repo.UpdateAccount(context.Background(), "t-1", "missing", map[string]interface{}{"account_name": "x"}); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("err = %v, want ErrNoRows", err)
	}
}
