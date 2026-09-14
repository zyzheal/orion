package repository

import (
	"context"
	"errors"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/sla-engine/models"

	"github.com/DATA-DOG/go-sqlmock"
)

// Before the fix each of the four counts was discarded into a blank
// identifier, so a database outage answered with an empty struct and a nil
// error. GET /violation-statistics then reported that the tenant had never
// breached an SLA while the table was unreachable.
func TestGetViolationStatisticsPropagatesAFailedCount(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_violations WHERE tenant_id=$1`).
		WithArgs("t-1").WillReturnError(errors.New("connection refused"))

	got, err := NewRepository(db).GetViolationStatistics(context.Background(), "t-1")
	if err == nil {
		t.Fatalf("a failed count must not be swallowed, stats = %+v", got)
	}
	if got != (models.ViolationStatistics{}) {
		t.Fatalf("a failed count must return an empty statistics struct, got %+v", got)
	}
	if !strings.Contains(err.Error(), "total") {
		t.Fatalf("error %q does not name the count that failed", err.Error())
	}
}

func TestGetViolationStatisticsReturnsEveryCount(t *testing.T) {
	db, mock := mockDB(t)
	count := func(n int) *sqlmock.Rows {
		return sqlmock.NewRows([]string{"count"}).AddRow(n)
	}
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_violations WHERE tenant_id=$1`).
		WithArgs("t-1").WillReturnRows(count(9))
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_violations WHERE tenant_id=$1 AND violation_type=$2`).
		WithArgs("t-1", "response").WillReturnRows(count(3))
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_violations WHERE tenant_id=$1 AND violation_type=$2`).
		WithArgs("t-1", "resolution").WillReturnRows(count(4))
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_violations WHERE tenant_id=$1 AND notified=$2`).
		WithArgs("t-1", true).WillReturnRows(count(2))

	got, err := NewRepository(db).GetViolationStatistics(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("GetViolationStatistics: %v", err)
	}
	want := models.ViolationStatistics{
		TotalViolations: 9, ResponseBreach: 3, ResolutionBreach: 4, Notified: 2,
	}
	if got != want {
		t.Fatalf("statistics = %+v\n  want %+v", got, want)
	}
	// Four separate statements: dropping one into a blank identifier leaves the
	// expectation unmet.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("not every count was queried: %v", err)
	}
}
