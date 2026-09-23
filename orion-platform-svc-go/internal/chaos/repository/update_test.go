package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func newMockChaosRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

// Update used to issue "UPDATE chaos_experiments SET updated_at=NOW() WHERE ..."
// regardless of the map, so PUT /chaos/experiments/:id accepted name/faults/
// scope and changed nothing while returning 200.
func TestUpdate_WritesTheCallerColumns(t *testing.T) {
	mock, repo := newMockChaosRepo(t)
	mock.ExpectQuery(`SELECT * FROM chaos_experiments WHERE id=$1 AND tenant_id=$2`).
		WithArgs("e-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("e-1", "t-1"))
	mock.ExpectExec(`UPDATE chaos_experiments SET name = $1, status = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5`).
		WithArgs("Packet loss on edge", "draft", sqlmock.AnyArg(), "e-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.Update(context.Background(), "t-1", "e-1", map[string]interface{}{
		"name":   "Packet loss on edge",
		"status": "draft",
	}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpdate_RejectsColumnsOutsideTheWhitelist(t *testing.T) {
	mock, repo := newMockChaosRepo(t)
	mock.ExpectQuery(`SELECT * FROM chaos_experiments WHERE id=$1 AND tenant_id=$2`).
		WithArgs("e-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("e-1", "t-1"))
	if err := repo.Update(context.Background(), "t-1", "e-1", map[string]interface{}{
		"id": "attacker-controlled",
	}); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpdate_MissingRowReportsNotFound(t *testing.T) {
	mock, repo := newMockChaosRepo(t)
	mock.ExpectQuery(`SELECT * FROM chaos_experiments WHERE id=$1 AND tenant_id=$2`).
		WithArgs("missing", "t-1").WillReturnError(sql.ErrNoRows)
	err := repo.Update(context.Background(), "t-1", "missing", map[string]interface{}{"name": "x"})
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("err = %v, want ErrNoRows", err)
	}
}
