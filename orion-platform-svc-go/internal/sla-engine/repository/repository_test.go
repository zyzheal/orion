package repository

import (
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strings"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/sla-engine/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("expected non-nil repository")
	}
}

func Test_RepositoryImplementsRepositoryInterface(t *testing.T) {
	// Compile-time check: *Repository implements RepositoryInterface.
	var _ RepositoryInterface = (*Repository)(nil)
}

func Test_RepositoryImplementsViolationRepository(t *testing.T) {
	// Compile-time check: *Repository implements ViolationRepository.
	var _ ViolationRepository = (*Repository)(nil)
}

func Test_NewRepository_ReturnsDistinctPointers(t *testing.T) {
	r1 := NewRepository(nil)
	r2 := NewRepository(nil)
	if r1 == r2 {
		t.Fatal("NewRepository should return distinct pointers")
	}
}

// --- updateRows -------------------------------------------------------------
//
// The sqlmock matcher below compares statements after collapsing whitespace, so
// an expectation written against "UPDATE sla_profiles SET name=$1, ..." will
// not quietly satisfy a statement that sends a different column order. sqlx.NewDb
// never calls Unsafe, which is how go-common builds the production handle.

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

func TestUpdateProfile_RendersSortedSetClauseScopedToTheTenant(t *testing.T) {
	// Go maps iterate in unspecified order, so the sorted assertion is only
	// meaningful if the walk is repeated: a single pass can land on the sorted
	// order by accident.
	for i := 0; i < 40; i++ {
		db, mock := mockDB(t)
		updates := map[string]interface{}{
			"priority":       "P1",
			"name":           "payment-latency",
			"resolution_sla": "24h",
			"business_hours": true,
			"status":         "active",
		}
		want := `UPDATE sla_profiles SET business_hours=$1, name=$2, priority=$3, resolution_sla=$4, status=$5, updated_at=$6 WHERE id=$7 AND tenant_id=$8`
		mock.ExpectExec(want).
			WithArgs(true, "payment-latency", "P1", "24h", "active", sqlmock.AnyArg(), "p-1", "t-1").
			WillReturnResult(sqlmock.NewResult(1, 1))

		if err := NewRepository(db).UpdateProfile(context.Background(), "t-1", "p-1", updates); err != nil {
			t.Fatalf("iteration %d: UpdateProfile: %v", i, err)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("iteration %d: %v", i, err)
		}
	}
}

// The caller's map must come back exactly as it was sent. updateRows used to
// stamp updated_at into it and delete id and tenant_id from it; calculator's
// tracker lifecycle reuses the same map across calls, so it would have seen its
// own keys disappear and its updated_at already filled in.
func TestUpdateRowsDoesNotMutateTheCallerMap(t *testing.T) {
	db, mock := mockDB(t)
	updates := map[string]interface{}{
		"status":        "paused",
		"paused_reason": "investigation",
		"id":            "attacker-id",
		"tenant_id":     "attacker-tenant",
	}
	mock.ExpectExec(`UPDATE sla_trackers SET paused_reason=$1, status=$2, updated_at=$3 WHERE id=$4 AND tenant_id=$5`).
		WithArgs("investigation", "paused", sqlmock.AnyArg(), "trk-1", "t-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := NewRepository(db).UpdateTracker(context.Background(), "t-1", "trk-1", updates); err != nil {
		t.Fatalf("UpdateTracker: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
	if updates["id"] != "attacker-id" || updates["tenant_id"] != "attacker-tenant" {
		t.Fatalf("the caller's map lost keys it had sent: %v", updates)
	}
	if _, ok := updates["updated_at"]; ok {
		t.Fatalf("updated_at must not be stamped into the caller's map: %v", updates)
	}
}

// id, tenant_id and updated_at are the ones updateRows drops rather than
// refusing, because a caller echoing a whole row back would otherwise get a hard
// failure. Everything else the table has must still be refused.
func TestUpdateProfileRejectsAColumnOutsideTheWhitelist(t *testing.T) {
	db, mock := mockDB(t)
	for _, tc := range []struct {
		column string
		value  string
	}{
		{"created_at", "2020-01-01"},
		{"tenent_id", "other"},  // typo of a real column
		{"response_slaa", "1h"}, // typo of a real column
		{"password", "secret"},  // a column that could exist on another table
	} {
		err := NewRepository(db).UpdateProfile(context.Background(), "t-1", "p-1",
			map[string]interface{}{tc.column: tc.value})
		if !errors.Is(err, sentinel.BadRequest) {
			t.Fatalf("column %q: error = %v, want sentinel.BadRequest", tc.column, err)
		}
		if !strings.Contains(err.Error(), tc.column) {
			t.Fatalf("column %q: error %q does not name the rejected column", tc.column, err.Error())
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("a rejected update must not reach the database: %v", err)
	}
}

func TestUpdateTrackerRejectsAColumnOutsideTheWhitelist(t *testing.T) {
	db, mock := mockDB(t)
	err := NewRepository(db).UpdateTracker(context.Background(), "t-1", "trk-1",
		map[string]interface{}{"created_at": "2020-01-01"})
	if !errors.Is(err, sentinel.BadRequest) {
		t.Fatalf("error = %v, want sentinel.BadRequest", err)
	}
	if !strings.Contains(err.Error(), `"created_at"`) {
		t.Fatalf("error %q does not name the rejected column", err.Error())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("a rejected update must not reach the database: %v", err)
	}
}

func TestUpdateTrackerEmptyUpdatesWritesNothing(t *testing.T) {
	db, mock := mockDB(t)
	if err := NewRepository(db).UpdateTracker(context.Background(), "t-1", "trk-1", nil); err != nil {
		t.Fatalf("an empty update is a no-op: error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("an empty update must not reach the database: %v", err)
	}
}

func TestUpdateRowsReportsAMissingRowAsNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(normSQL(`UPDATE sla_trackers SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`)).
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := NewRepository(db).UpdateTracker(context.Background(), "t-1", "trk-1", map[string]interface{}{"status": "paused"})
	if err == nil {
		t.Fatalf("an UPDATE that matched no row reported success")
	}
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("error = %v, want sentinel.NotFound so the handler can answer 404", err)
	}
	if !strings.Contains(err.Error(), "trk-1") || !strings.Contains(err.Error(), "t-1") {
		t.Fatalf("error %q must name the id and tenant it missed", err.Error())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("%v", err)
	}
}

// --- GetTrackerStatistics ---------------------------------------------------

func TestGetTrackerStatisticsPropagatesAFailedCount(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1`).
		WithArgs("t-1").WillReturnError(errors.New("connection refused"))

	got, err := NewRepository(db).GetTrackerStatistics(context.Background(), "t-1")
	if err == nil {
		t.Fatalf("a failed count must not be swallowed, stats = %+v", got)
	}
	if got != (models.TrackerStatistics{}) {
		t.Fatalf("a failed count must return an empty statistics struct, got %+v", got)
	}
	if !strings.Contains(err.Error(), "total") {
		t.Fatalf("error %q does not name the count that failed", err.Error())
	}
}

func TestGetTrackerStatisticsReturnsEveryCountAndTheBreachRate(t *testing.T) {
	db, mock := mockDB(t)
	count := func(n int) *sqlmock.Rows {
		return sqlmock.NewRows([]string{"count"}).AddRow(n)
	}
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1`).
		WithArgs("t-1").WillReturnRows(count(10))
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1 AND status=$2`).
		WithArgs("t-1", "active").WillReturnRows(count(4))
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1 AND status=$2`).
		WithArgs("t-1", "responded").WillReturnRows(count(1))
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1 AND status=$2`).
		WithArgs("t-1", "resolved").WillReturnRows(count(5))
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1 AND status=$2`).
		WithArgs("t-1", "breached").WillReturnRows(count(2))
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1 AND status=$2`).
		WithArgs("t-1", "paused").WillReturnRows(count(1))

	got, err := NewRepository(db).GetTrackerStatistics(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("GetTrackerStatistics: %v", err)
	}
	want := models.TrackerStatistics{
		Total: 10, Active: 4, Responded: 1, Resolved: 5, Breached: 2, Paused: 1,
		BreachRate: 2.0 / 7.0,
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

func TestGetTrackerStatisticsHasNoBreachRateForAnEmptyTenant(t *testing.T) {
	db, mock := mockDB(t)
	count := func() *sqlmock.Rows {
		return sqlmock.NewRows([]string{"count"}).AddRow(0)
	}
	mock.ExpectQuery(`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1`).
		WithArgs("t-1").WillReturnRows(count())
	for _, status := range []string{"active", "responded", "resolved", "breached", "paused"} {
		mock.ExpectQuery(`SELECT COUNT(*) FROM sla_trackers WHERE tenant_id=$1 AND status=$2`).
			WithArgs("t-1", status).WillReturnRows(count())
	}

	got, err := NewRepository(db).GetTrackerStatistics(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("GetTrackerStatistics: %v", err)
	}
	if got.BreachRate != 0 {
		t.Fatalf("breach rate = %v, want 0 (0/0 must not be NaN)", got.BreachRate)
	}
	if math.IsNaN(got.BreachRate) || math.IsInf(got.BreachRate, 0) {
		t.Fatalf("breach rate %v is not JSON-encodable", got.BreachRate)
	}
}
