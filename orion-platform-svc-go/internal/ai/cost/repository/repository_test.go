package repository

import (
	"context"
	"strings"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/ai/cost/models"
)

// newMockRepo builds a repository over sqlmock with regex query matching.
func newMockRepo(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.MatchExpectationsInOrder(false)
	return NewRepository(sqlx.NewDb(db, "postgres")), mock
}

// TestCreateBindsEveryColumnByItsDbTag pins the value bound to each placeholder.
// The failure this guards is silent at compile time: :tenantId matched the json
// tag and bound to nothing, so sqlx rejected the statement and POST /ai-cost
// returned 500 for every cost entry.
func TestCreateBindsEveryColumnByItsDbTag(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectExec(`INSERT INTO ai_cost_records`).WithArgs(
		sqlmock.AnyArg(), "t1", "gpt-4", int64(1000), int64(250), 0.023, sqlmock.AnyArg(),
	).WillReturnResult(sqlmock.NewResult(1, 1))

	record, err := repo.Create(context.Background(), "t1", &models.CostRecord{
		TenantID: "t1", ModelID: "gpt-4",
		PromptTokens: 1000, CompletionTokens: 250, Cost: 0.023,
	})
	if err != nil {
		t.Fatalf("Create returned an error: %v", err)
	}
	if record == nil {
		t.Fatal("Create returned a nil record")
	}
	if record.ID == "" {
		t.Error("Create did not assign a record ID")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestGetSummaryScansTheAggregateAliases pins the column-to-field mapping.
// CostSummary had no db tags, so sqlx looked for "totalcost" while GetSummary
// aliases SUM(cost) as "total_cost", and GET /ai-cost/summary died in sqlx safe
// mode with "missing destination name total_cost" on every request.
func TestGetSummaryScansTheAggregateAliases(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(`SELECT SUM\(cost\) as total_cost`).WillReturnRows(
		sqlmock.NewRows([]string{"total_cost", "total_requests"}).AddRow(12.5, 4))
	mock.ExpectQuery(`SELECT model_id, SUM\(cost\) as cost_sum`).WillReturnRows(
		sqlmock.NewRows([]string{"model_id", "cost_sum"}).AddRow("gpt-4", 8.0))
	mock.ExpectQuery(`SELECT DATE\(created_at\) as date`).WillReturnRows(
		sqlmock.NewRows([]string{"date", "cost_sum"}).AddRow("2026-08-26", 12.5))

	s, err := repo.GetSummary(context.Background(), "t1", models.CostFilter{})
	if err != nil {
		t.Fatalf("GetSummary returned an error: %v", err)
	}
	if s == nil {
		t.Fatal("GetSummary returned a nil summary")
	}
	if s.TotalCost != 12.5 {
		t.Errorf("TotalCost = %v, want 12.5", s.TotalCost)
	}
	if s.TotalRequests != 4 {
		t.Errorf("TotalRequests = %v, want 4", s.TotalRequests)
	}
	if s.AvgCost != 12.5/4 {
		t.Errorf("AvgCost = %v, want %v", s.AvgCost, 12.5/4)
	}
	if got := s.ByModel["gpt-4"]; got != 8.0 {
		t.Errorf("ByModel[gpt-4] = %v, want 8", got)
	}
	if got := s.ByDate["2026-08-26"]; got != 12.5 {
		t.Errorf("ByDate[2026-08-26] = %v, want 12.5", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestGetSummaryAveragesASingleRequest pins the boundary of the divide-by-zero
// guard. A survivor here (off-by-one on TotalRequests) would only show up for
// exactly one recorded request, so the aggregate test above, which uses four,
// cannot see it.
func TestGetSummaryAveragesASingleRequest(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(`SELECT SUM\(cost\) as total_cost`).WillReturnRows(
		sqlmock.NewRows([]string{"total_cost", "total_requests"}).AddRow(12.5, 1))
	mock.ExpectQuery(`SELECT model_id, SUM\(cost\) as cost_sum`).WillReturnRows(
		sqlmock.NewRows([]string{"model_id", "cost_sum"}))
	mock.ExpectQuery(`SELECT DATE\(created_at\) as date`).WillReturnRows(
		sqlmock.NewRows([]string{"date", "cost_sum"}))

	s, err := repo.GetSummary(context.Background(), "t1", models.CostFilter{})
	if err != nil {
		t.Fatalf("GetSummary returned an error: %v", err)
	}
	if s == nil {
		t.Fatal("GetSummary returned a nil summary")
	}
	if s.TotalRequests != 1 {
		t.Fatalf("TotalRequests = %v, want 1", s.TotalRequests)
	}
	if s.AvgCost != 12.5 {
		t.Errorf("AvgCost = %v, want 12.5 (the guard must trigger at exactly one request)", s.AvgCost)
	}
}

// TestGetSummarySurvivesAnEmptyTable pins the no-rows branch: the route must
// answer an empty summary rather than a 500.
func TestGetSummarySurvivesAnEmptyTable(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(`SELECT SUM\(cost\) as total_cost`).WillReturnRows(
		sqlmock.NewRows([]string{"total_cost", "total_requests"}))

	s, err := repo.GetSummary(context.Background(), "t1", models.CostFilter{})
	if err != nil {
		t.Fatalf("GetSummary returned an error: %v", err)
	}
	if s == nil {
		t.Fatal("GetSummary returned a nil summary")
	}
	if s.TotalCost != 0 || s.TotalRequests != 0 || s.AvgCost != 0 {
		t.Errorf("empty summary is not zero-valued: %+v", s)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestListBuildsAPositionalModelFilter pins the generated query text. The index
// used to be built with string(rune(idx)) plus a literal "s", producing
// " AND model_id = $2s", so GET /ai-cost?modelId=gpt-4 failed for every
// filtered request. The expectation is a regexp, so a trailing "s" no longer
// matches and the call is reported as unexpected.
func TestListBuildsAPositionalModelFilter(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM ai_cost_records WHERE tenant_id = \$1 AND model_id = \$2 ORDER BY created_at DESC`).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "model_id", "prompt_tokens", "completion_tokens", "cost", "created_at",
		}).AddRow("id-1", "t1", "gpt-4", 10, 20, 0.5, time.Now().UTC()))

	records, err := repo.List(context.Background(), "t1", models.CostFilter{ModelID: "gpt-4"})
	if err != nil {
		t.Fatalf("List returned an error: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("List returned %d records, want 1", len(records))
	}
	if records[0].ModelID != "gpt-4" {
		t.Errorf("ModelID = %q, want gpt-4", records[0].ModelID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}

	// Without a filter the query has exactly two positional arguments.
	repo2, mock2 := newMockRepo(t)
	mock2.ExpectQuery(`SELECT \* FROM ai_cost_records WHERE tenant_id = \$1 ORDER BY created_at DESC`).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "model_id", "prompt_tokens", "completion_tokens", "cost", "created_at",
		}))
	records, err = repo2.List(context.Background(), "t1", models.CostFilter{})
	if err != nil {
		t.Fatalf("List without a filter returned an error: %v", err)
	}
	if len(records) != 0 {
		t.Errorf("List returned %d records, want 0", len(records))
	}
	if err := mock2.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestPlaceholdersAndDbTagsAreWhatTheDriversObserveIsThePositiveControl proves
// both tests above observe something real. sqlmock does not resolve sqlx named
// arguments and does not run struct-tag mapping, so a reviewer could argue they
// pass regardless of the code. The camelCase arm must fail to bind, and the
// untagged arm must fail to scan; without both the two fixes above would be
// unverified.
func TestPlaceholdersAndDbTagsAreWhatTheDriversObserveIsThePositiveControl(t *testing.T) {
	t.Run("camelCase placeholder", func(t *testing.T) {
		record := &models.CostRecord{
			ID: "id-1", TenantID: "t1", ModelID: "gpt-4",
			PromptTokens: 1000, CompletionTokens: 250, Cost: 0.023,
		}
		db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer func() { _ = db.Close() }()
		mock.ExpectExec(`INSERT INTO ai_cost_records`).WithArgs(
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
		).WillReturnResult(sqlmock.NewResult(1, 1))
		conn := sqlx.NewDb(db, "postgres")
		_, err = conn.NamedExecContext(context.Background(),
			"INSERT INTO ai_cost_records (id, tenant_id, model_id, prompt_tokens, completion_tokens, cost, created_at) VALUES (:id, :tenantId, :modelId, :promptTokens, :completionTokens, :cost, :createdAt)",
			record)
		if err == nil {
			t.Fatal("mutant placeholder unexpectedly bound; the binding test above is vacuous")
		}
		if want := "could not find name tenantId"; !strings.Contains(err.Error(), want) {
			t.Fatalf("err = %q, want it to contain %q", err.Error(), want)
		}
	})

	// Untagged struct: sqlx maps TotalCost to the column "totalcost", which the
	// aggregate alias total_cost never has.
	t.Run("untagged struct", func(t *testing.T) {
		db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer func() { _ = db.Close() }()
		mock.ExpectQuery(`SELECT SUM\(cost\) as total_cost`).WillReturnRows(
			sqlmock.NewRows([]string{"total_cost", "total_requests"}).AddRow(1.0, 1))
		conn := sqlx.NewDb(db, "postgres")
		var untagged struct {
			TotalCost     float64
			TotalRequests int64
		}
		err = conn.GetContext(context.Background(), &untagged,
			"SELECT SUM(cost) as total_cost, COUNT(*) as total_requests FROM ai_cost_records WHERE tenant_id=$1", "t1")
		if err == nil {
			t.Fatal("untagged struct unexpectedly scanned; the aggregate test above is vacuous")
		}
		if !strings.Contains(err.Error(), "missing destination name total_cost") {
			t.Fatalf("err = %q, want it to contain %q", err.Error(), "missing destination name total_cost")
		}
	})
}
