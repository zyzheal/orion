package repository

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/approval/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// sqlmock's default matcher is strings.Contains, so a statement that dropped a
// column or reordered the placeholders would still satisfy an expectation. The
// matcher below collapses whitespace first and then compares exactly.

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

func countRows(n int) *sqlmock.Rows {
	return sqlmock.NewRows([]string{"count"}).AddRow(n)
}

// GetStatistics used to drop all six count errors into `_ =` and then return a
// zero-valued body with nil. GET /approvals/statistics is the approval-volume
// feed, so an outage answered "this tenant has no approvals at all".
func TestGetStatisticsReturnsEveryCount(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1`).
		WithArgs("t-1").WillReturnRows(countRows(12))
	mock.ExpectQuery(`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1 AND status=$2`).
		WithArgs("t-1", "pending").WillReturnRows(countRows(3))
	mock.ExpectQuery(`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1 AND status=$2`).
		WithArgs("t-1", "approved").WillReturnRows(countRows(5))
	mock.ExpectQuery(`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1 AND status=$2`).
		WithArgs("t-1", "rejected").WillReturnRows(countRows(2))
	mock.ExpectQuery(`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1 AND status=$2`).
		WithArgs("t-1", "withdrawn").WillReturnRows(countRows(1))
	mock.ExpectQuery(`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1 AND status=$2`).
		WithArgs("t-1", "cancelled").WillReturnRows(countRows(1))

	got, err := NewRepository(db).GetStatistics(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("GetStatistics: %v", err)
	}
	want := models.ApprovalStatistics{
		Total: 12, Pending: 3, Approved: 5, Rejected: 2, Withdrawn: 1, Cancelled: 1,
	}
	if got != want {
		t.Fatalf("statistics = %+v\n  want %+v", got, want)
	}
	// Six separate statements: dropping one into a blank identifier leaves the
	// expectation unmet.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("not every count was queried: %v", err)
	}
}

func TestGetStatisticsPropagatesAFailedFirstCount(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1`).
		WithArgs("t-1").WillReturnError(errors.New("connection refused"))

	got, err := NewRepository(db).GetStatistics(context.Background(), "t-1")
	if err == nil {
		t.Fatalf("a failed count must not be swallowed, statistics = %+v", got)
	}
	if got != (models.ApprovalStatistics{}) {
		t.Fatalf("a failed count must return an empty statistics body, got %+v", got)
	}
	if !strings.Contains(err.Error(), "total") {
		t.Fatalf("error %q does not name the count that failed", err.Error())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("%v", err)
	}
}

// A failure on the last count is the interesting case: five of the six values
// are already in the struct. Publishing them anyway would answer with a body
// that is five-sixths right and one-sixth invented (cancelled == 0).
func TestGetStatisticsDoesNotPublishPartialStatistics(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1`).
		WithArgs("t-1").WillReturnRows(countRows(9))
	// sqlmock matches expectations in enqueue order, so the counts must be
	// listed in the order the probes run.
	for _, probe := range []struct {
		status string
		n      int
	}{
		{"pending", 4}, {"approved", 3}, {"rejected", 1}, {"withdrawn", 1},
	} {
		mock.ExpectQuery(`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1 AND status=$2`).
			WithArgs("t-1", probe.status).WillReturnRows(countRows(probe.n))
	}
	mock.ExpectQuery(`SELECT COUNT(*) FROM approval_requests WHERE tenant_id=$1 AND status=$2`).
		WithArgs("t-1", "cancelled").WillReturnError(errors.New("connection refused"))

	got, err := NewRepository(db).GetStatistics(context.Background(), "t-1")
	if err == nil {
		t.Fatalf("a failed count must not be swallowed, statistics = %+v", got)
	}
	if got != (models.ApprovalStatistics{}) {
		t.Fatalf("a partial statistics body must not be published: %+v", got)
	}
	if !strings.Contains(err.Error(), "cancelled") {
		t.Fatalf("error %q does not name the count that failed", err.Error())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("%v", err)
	}
}
