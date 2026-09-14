package repository

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

var ws = regexp.MustCompile(`\s+`)

func normSQL(s string) string {
	return strings.TrimSpace(ws.ReplaceAllString(s, " "))
}

func mockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", expected, actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock
}

const activeAssignmentsQuery = `SELECT COUNT(*) FROM worker_assignments WHERE worker_id=$1 AND tenant_id=$2 AND status IN ($3, $4)`

func TestGetActiveAssignmentsReturnsTheCount(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(activeAssignmentsQuery).
		WithArgs("w-1", "t-1", "assigned", "in_progress").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(7))

	got, err := NewRepository(db).GetActiveAssignments(context.Background(), "t-1", "w-1")
	if err != nil {
		t.Fatalf("GetActiveAssignments: %v", err)
	}
	if got != 7 {
		t.Fatalf("active assignments = %d, want 7", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("%v", err)
	}
}

// The method used to return a bare int and drop the GetContext error, so an
// unreachable worker_assignments table produced 0 at GET /worker/load/:workerId.
// That is the "worker is idle" signal a scheduler reads in order to hand the
// worker more work: the failure pointed at oversubscription.
func TestGetActiveAssignmentsPropagatesAFailedCount(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(activeAssignmentsQuery).
		WithArgs("w-1", "t-1", "assigned", "in_progress").
		WillReturnError(errors.New("connection refused"))

	got, err := NewRepository(db).GetActiveAssignments(context.Background(), "t-1", "w-1")
	if err == nil {
		t.Fatalf("a failed count must not be swallowed, got %d", got)
	}
	if got != 0 {
		t.Fatalf("the count must be zero when the query failed, got %d", got)
	}
	if !strings.Contains(err.Error(), "w-1") {
		t.Fatalf("error %q does not name the worker it queried", err.Error())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("%v", err)
	}
}
