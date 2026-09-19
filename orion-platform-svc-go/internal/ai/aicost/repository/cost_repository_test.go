package repository

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// newMockRepo builds a repository over sqlmock with exact query matching, so a
// mutation that renames a table or drops a clause changes the text and fails.
func newMockRepo(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return NewRepository(sqlx.NewDb(db, "postgres")), mock
}

// exactSQL collapses every run of whitespace to a single space on both sides,
// the same way sqlmock does before comparing, so a query can be written across
// several lines here and still match the repository's own layout.
func exactSQL(sql string) string {
	return strings.Join(regexp.MustCompile(`\s+`).Split(sql, -1), " ")
}

// TestGetTotalSpendReadsTheSpendTable pins the statement that backs
// GET /ai/cost/summary.
//
// GetTotalSpend used to sum ai_cost_savings -- the savings ledger, not spend --
// and then replaced both an error and a genuine zero with a hardcoded 5000.00,
// so every tenant reported the same spend. Only the ai_cost_records
// expectation is registered here: a query against any other table fails as an
// unexpected call, which is what makes this assertion non-vacuous.
func TestGetTotalSpendReadsTheSpendTable(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(exactSQL(`SELECT COALESCE(SUM(cost), 0) FROM ai_cost_records WHERE tenant_id = $1`)).
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows([]string{"total"}).AddRow(12.5))

	total, err := repo.GetTotalSpend(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetTotalSpend returned an error: %v", err)
	}
	if total != 12.5 {
		t.Errorf("total = %v, want 12.5", total)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestGetTotalSpendReturnsARealZero keeps a tenant with no records at zero
// instead of the old 5000.00 default. The row exists because the statement
// itself aggregates; zero rows would surface as ErrNoRows, which the real
// statement cannot return.
func TestGetTotalSpendReturnsARealZero(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(exactSQL(`SELECT COALESCE(SUM(cost), 0) FROM ai_cost_records WHERE tenant_id = $1`)).
		WithArgs("empty").
		WillReturnRows(sqlmock.NewRows([]string{"total"}).AddRow(0.0))

	total, err := repo.GetTotalSpend(context.Background(), "empty")
	if err != nil {
		t.Fatalf("GetTotalSpend returned an error: %v", err)
	}
	if total != 0.0 {
		t.Errorf("total = %v, want 0.0 for a tenant with no records", total)
	}
}

// TestGetTotalSpendPropagatesError is the anti-fabrication guard: an
// unreachable database used to answer 5000.00, which looked like a real spend
// figure to every caller.
func TestGetTotalSpendPropagatesError(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(exactSQL(`SELECT COALESCE(SUM(cost), 0) FROM ai_cost_records WHERE tenant_id = $1`)).
		WithArgs("t1").
		WillReturnError(errors.New("db down"))

	total, err := repo.GetTotalSpend(context.Background(), "t1")
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if total != 0.0 {
		t.Errorf("total = %v, want 0.0; the old stub answered 5000.00", total)
	}
}

// TestListSpendByModelQueriesTheThirtyDayWindow pins the whole statement,
// including the window that makes EstimatedMonthlySavings true, the tenant
// predicate, and the GROUP BY that turns rows into per-model totals.
func TestListSpendByModelQueriesTheThirtyDayWindow(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(exactSQL(`
		SELECT COALESCE(model_id, '') AS model_id,
		       COALESCE(SUM(cost), 0) AS spend,
		       COUNT(*) AS requests
		 FROM ai_cost_records
		 WHERE tenant_id = $1
		   AND created_at >= NOW() - INTERVAL '30 days'
		 GROUP BY 1
		 ORDER BY spend DESC, model_id`)).
		WithArgs("t1").
		WillReturnRows(sqlmock.NewRows([]string{"model_id", "spend", "requests"}).
			AddRow("gpt-4", 600.0, int64(10)).
			AddRow("claude-3", 400.0, int64(5)))

	rows, err := repo.ListSpendByModel(context.Background(), "t1")
	if err != nil {
		t.Fatalf("ListSpendByModel returned an error: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("got %d rows, want 2", len(rows))
	}
	if rows[0].ModelID != "gpt-4" || rows[0].Spend != 600.0 || rows[0].Requests != 10 {
		t.Errorf("row 0 = %+v, want gpt-4 / 600 / 10", rows[0])
	}
	if rows[1].ModelID != "claude-3" || rows[1].Spend != 400.0 || rows[1].Requests != 5 {
		t.Errorf("row 1 = %+v, want claude-3 / 400 / 5", rows[1])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestListSpendByModelBindsOnlyTheTenant proves the window is a literal and
// not a second bound argument: WithArgs("t1") fails if the statement binds
// anything else, which would shift the placeholders.
func TestListSpendByModelBindsOnlyTheTenant(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(exactSQL(`
		SELECT COALESCE(model_id, '') AS model_id,
		       COALESCE(SUM(cost), 0) AS spend,
		       COUNT(*) AS requests
		 FROM ai_cost_records
		 WHERE tenant_id = $1
		   AND created_at >= NOW() - INTERVAL '30 days'
		 GROUP BY 1
		 ORDER BY spend DESC, model_id`)).
		WithArgs("solo").
		WillReturnRows(sqlmock.NewRows([]string{"model_id", "spend", "requests"}))

	if _, err := repo.ListSpendByModel(context.Background(), "solo"); err != nil {
		t.Fatalf("ListSpendByModel returned an error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestListSpendByModelPropagatesError keeps a broken query from reading as an
// empty analysis.
func TestListSpendByModelPropagatesError(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(exactSQL(`
		SELECT COALESCE(model_id, '') AS model_id,
		       COALESCE(SUM(cost), 0) AS spend,
		       COUNT(*) AS requests
		 FROM ai_cost_records
		 WHERE tenant_id = $1
		   AND created_at >= NOW() - INTERVAL '30 days'
		 GROUP BY 1
		 ORDER BY spend DESC, model_id`)).
		WithArgs("t1").
		WillReturnError(errors.New("relation does not exist"))

	rows, err := repo.ListSpendByModel(context.Background(), "t1")
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if len(rows) != 0 {
		t.Errorf("rows = %d, want 0 on error", len(rows))
	}
}
