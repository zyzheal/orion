package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func newMockChangeRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

func mockChangeRepoForNotFound(t *testing.T) *Repository {
	t.Helper()
	db, _, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return NewRepository(sqlx.NewDb(db, "postgres"))
}

// UpdateRFC used to issue "UPDATE change_rfcs SET updated_at=NOW() WHERE ..."
// regardless of the map, so PUT /change/rfc/:id accepted title/description/status
// and changed nothing while still returning 200 with the stale row.
func TestUpdateRFC_WritesTheCallerColumns(t *testing.T) {
	mock, repo := newMockChangeRepo(t)
	// Pre-existence check, then the update, then the re-read.
	mock.ExpectQuery(`SELECT * FROM change_rfcs WHERE id=$1 AND tenant_id=$2`).
		WithArgs("r-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("r-1", "t-1"))
	mock.ExpectExec(`UPDATE change_rfcs SET status = $1, title = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5`).
		WithArgs("approved", "Restart the cache", sqlmock.AnyArg(), "r-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`SELECT * FROM change_rfcs WHERE id=$1 AND tenant_id=$2`).
		WithArgs("r-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "title", "status"}).
			AddRow("r-1", "t-1", "Restart the cache", "approved"))

	got, err := repo.UpdateRFC(context.Background(), "t-1", "r-1", map[string]interface{}{
		"title":  "Restart the cache",
		"status": "approved",
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Restart the cache" || got.Status != "approved" {
		t.Fatalf("row = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

// rfc_number is a real change_rfcs column; it is immutable here and must not
// reach the SQL string at all.
func TestUpdateRFC_RejectsColumnsOutsideTheWhitelist(t *testing.T) {
	mock, repo := newMockChangeRepo(t)
	mock.ExpectQuery(`SELECT * FROM change_rfcs WHERE id=$1 AND tenant_id=$2`).
		WithArgs("r-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("r-1", "t-1"))
	got, err := repo.UpdateRFC(context.Background(), "t-1", "r-1", map[string]interface{}{
		"rfc_number": "RFC-9",
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != "" {
		t.Fatalf("row = %+v", got)
	}
	// No UPDATE expected: the map held nothing the whitelist allows.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

// UpdateRFC used to ExecContext without checking existence, so a missing id
// returned nil,nil and the handler answered 200.
func TestUpdateRFC_MissingRowReportsNotFound(t *testing.T) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	repo := NewRepository(sqlx.NewDb(db, "postgres"))
	mock.ExpectQuery(`SELECT * FROM change_rfcs WHERE id=$1 AND tenant_id=$2`).
		WithArgs("missing", "t-1").WillReturnError(sql.ErrNoRows)

	if _, err := repo.UpdateRFC(context.Background(), "t-1", "missing", map[string]interface{}{"title": "x"}); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("err = %v, want ErrNoRows", err)
	}
}

func TestUpdateCABMeeting_WritesTheCallerColumns(t *testing.T) {
	mock, repo := newMockChangeRepo(t)
	ts := time.Date(2026, 8, 26, 9, 0, 0, 0, time.UTC)
	mock.ExpectQuery(`SELECT * FROM cab_meetings WHERE id=$1 AND tenant_id=$2`).
		WithArgs("m-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}).AddRow("m-1", "t-1"))
	mock.ExpectExec(`UPDATE cab_meetings SET scheduled_at = $1, status = $2, updated_at = $3 WHERE id = $4 AND tenant_id = $5`).
		WithArgs(ts, "in_progress", sqlmock.AnyArg(), "m-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`SELECT * FROM cab_meetings WHERE id=$1 AND tenant_id=$2`).
		WithArgs("m-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "title", "status", "scheduled_at"}).
			AddRow("m-1", "t-1", "Meeting", "in_progress", ts))

	got, err := repo.UpdateCABMeeting(context.Background(), "t-1", "m-1", map[string]interface{}{
		"status":       "in_progress",
		"scheduled_at": ts,
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != "in_progress" || !got.ScheduledAt.Equal(ts) {
		t.Fatalf("row = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
