package repository

import (
	"context"
	"database/sql/driver"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/ai/gateway/models"
)

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

// newRawConn builds a sqlx connection that is not wrapped in a Repository, so
// the positive control can exercise sqlx itself with a deliberately wrong
// statement or destination struct.
func newRawConn(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return sqlx.NewDb(db, "postgres"), mock
}

var requestCols = []string{"id", "tenant_id", "model", "provider", "input", "output", "tokens", "latency_ms", "created_at"}

// TestCreateBindsTenantByIdAndDbTag pins the value bound to each placeholder.
// The statement used to bind :tenantId, :latencyMs and :createdAt — the json
// tags — which match no db tag and no lowercased Go field, so POST /ai-gateway
// failed every request with "could not find name tenantId". The tenantID
// parameter was never read either, so the NOT NULL tenant column would have
// been written as the empty string.
func TestCreateBindsTenantByIdAndDbTag(t *testing.T) {
	repo, mock := newMockRepo(t)
	seen := time.Date(2026, 8, 26, 12, 0, 0, 0, time.UTC)
	mock.ExpectExec(`INSERT INTO ai_gateway_requests`).WithArgs(
		sqlmock.AnyArg(), "t1", "gpt-4", "openai", "hi", "hello", int64(12), int64(35), seen,
	).WillReturnResult(sqlmock.NewResult(1, 1))

	resp, err := repo.Create(context.Background(), "t1", &models.GatewayResponse{
		Model: "gpt-4", Provider: "openai", Input: "hi", Output: "hello",
		Tokens: 12, LatencyMs: 35, CreatedAt: seen,
	})
	if err != nil {
		t.Fatalf("Create returned an error: %v", err)
	}
	if resp == nil {
		t.Fatal("Create returned nil")
	}
	if resp.ID == "" {
		t.Error("Create did not assign an ID")
	}
	if resp.TenantID != "t1" {
		t.Errorf("TenantID = %q, want t1 (the tenant must come from the request context)", resp.TenantID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestListBuildsTheProviderFilterAndLimitPositions pins the generated query text
// and the number bound to each position, for both the COUNT and the items
// query. The old code did " AND provider = $" + string(rune(idx)) + "s" and
// " LIMIT $"+string(rune(len(args))): both emitted U+0002 (STX) rather than the
// digit, so every filtered request and every limited request answered 500.
func TestListBuildsTheProviderFilterAndLimitPositions(t *testing.T) {
	cases := []struct {
		name      string
		q         models.ListQuery
		wantCount string
		wantItems string
		countArgs []driver.Value
		itemsArgs []driver.Value
	}{
		{
			"no filter, default limit",
			models.ListQuery{},
			`SELECT COUNT\(\*\) FROM ai_gateway_requests WHERE tenant_id = \$1`,
			`SELECT \* FROM ai_gateway_requests WHERE tenant_id = \$1 ORDER BY created_at DESC LIMIT \$2`,
			[]driver.Value{"t1"},
			[]driver.Value{"t1", 20},
		},
		{
			"provider filter, explicit limit",
			models.ListQuery{Provider: "openai", Limit: 10},
			`SELECT COUNT\(\*\) FROM ai_gateway_requests WHERE tenant_id = \$1 AND provider = \$2`,
			`SELECT \* FROM ai_gateway_requests WHERE tenant_id = \$1 AND provider = \$2 ORDER BY created_at DESC LIMIT \$3`,
			[]driver.Value{"t1", "openai"},
			[]driver.Value{"t1", "openai", 10},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo, mock := newMockRepo(t)
			mock.ExpectQuery(tc.wantCount).WithArgs(tc.countArgs...).WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
			mock.ExpectQuery(tc.wantItems).WithArgs(tc.itemsArgs...).WillReturnRows(sqlmock.NewRows(requestCols))

			items, total, err := repo.List(context.Background(), "t1", tc.q)
			if err != nil {
				t.Fatalf("List(%s) returned an error: %v", tc.name, err)
			}
			if len(items) != 0 {
				t.Errorf("List(%s) returned %d rows, want 0", tc.name, len(items))
			}
			if total != 0 {
				t.Errorf("List(%s) total = %d, want 0", tc.name, total)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("unmet expectations: %v", err)
			}
		})
	}
}

// TestListHonoursTheRequestedLimit pins that an explicit limit reaches the LIMIT
// placeholder instead of being replaced by the default of 20.
func TestListHonoursTheRequestedLimit(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(`SELECT COUNT\(\*\)`).WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(`LIMIT \$2`).WithArgs("t1", 7).WillReturnRows(sqlmock.NewRows(requestCols))

	items, total, err := repo.List(context.Background(), "t1", models.ListQuery{Limit: 7})
	if err != nil {
		t.Fatalf("List returned an error: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(items) != 0 {
		t.Errorf("List returned %d rows, want 0", len(items))
	}
}

// TestListScansEveryColumn pins the column-to-field mapping. ai_gateway_requests
// has tenant_id NOT NULL, plus latency_ms and created_at with underscores, and
// SELECT * returns all of them: GatewayResponse needed a TenantID destination
// and snake_case db tags, because sqlx v1.4.0 maps an untagged field by its
// LOWERCASED Go name — "latencyms" and "createdat" — which match no column.
func TestListScansEveryColumn(t *testing.T) {
	repo, mock := newMockRepo(t)
	seen := time.Date(2026, 8, 26, 9, 30, 0, 0, time.UTC)
	mock.ExpectQuery(`SELECT COUNT\(\*\)`).WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery(`SELECT \* FROM ai_gateway_requests`).WillReturnRows(sqlmock.NewRows(requestCols).
		AddRow("r-1", "t1", "gpt-4", "openai", "hi", "hello world", int64(12), int64(35), seen))

	items, total, err := repo.List(context.Background(), "t1", models.ListQuery{})
	if err != nil {
		t.Fatalf("List returned an error: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(items) != 1 {
		t.Fatalf("List returned %d rows, want 1", len(items))
	}
	r := items[0]
	if r.ID != "r-1" {
		t.Errorf("ID = %q, want r-1", r.ID)
	}
	if r.TenantID != "t1" {
		t.Errorf("TenantID = %q, want t1", r.TenantID)
	}
	if r.Model != "gpt-4" {
		t.Errorf("Model = %q, want gpt-4", r.Model)
	}
	if r.Provider != "openai" {
		t.Errorf("Provider = %q, want openai", r.Provider)
	}
	if r.Input != "hi" {
		t.Errorf("Input = %q, want hi", r.Input)
	}
	if r.Output != "hello world" {
		t.Errorf("Output = %q, want hello world", r.Output)
	}
	if r.Tokens != 12 {
		t.Errorf("Tokens = %d, want 12", r.Tokens)
	}
	if r.LatencyMs != 35 {
		t.Errorf("LatencyMs = %d, want 35 (the underscore column must map to its db tag)", r.LatencyMs)
	}
	if !r.CreatedAt.Equal(seen) {
		t.Errorf("CreatedAt = %v, want %v", r.CreatedAt, seen)
	}
}

// TestGetByIDReturnsNotFoundAndScansEveryColumn covers the single-row reader on
// both paths. The sentinel is pinned: the route answers 404 from it, so any
// other error would turn an empty request log into a 500.
func TestGetByIDReturnsNotFoundAndScansEveryColumn(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM ai_gateway_requests`).WithArgs("r-1", "t1").WillReturnRows(sqlmock.NewRows(requestCols))
	got, err := repo.GetByID(context.Background(), "t1", "r-1")
	if err != sentinel.NotFound {
		t.Fatalf("GetByID err = %v, want sentinel.NotFound", err)
	}
	if got != nil {
		t.Errorf("GetByID returned %v, want nil", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}

	repo2, mock2 := newMockRepo(t)
	seen := time.Date(2026, 8, 26, 8, 0, 0, 0, time.UTC)
	mock2.ExpectQuery(`SELECT \* FROM ai_gateway_requests`).WithArgs("r-2", "t1").
		WillReturnRows(sqlmock.NewRows(requestCols).
			AddRow("r-2", "t1", "claude-3", "anthropic", "bye", "goodbye", int64(4), int64(12), seen))
	got, err = repo2.GetByID(context.Background(), "t1", "r-2")
	if err != nil {
		t.Fatalf("GetByID returned an error: %v", err)
	}
	if got == nil {
		t.Fatal("GetByID returned nil on a matching row")
	}
	if got.TenantID != "t1" || got.Model != "claude-3" || got.Provider != "anthropic" {
		t.Errorf("scanned row = %+v", got)
	}
	if got.Output != "goodbye" || got.Tokens != 4 || got.LatencyMs != 12 {
		t.Errorf("scanned row = %+v", got)
	}
	if !got.CreatedAt.Equal(seen) {
		t.Errorf("CreatedAt = %v, want %v", got.CreatedAt, seen)
	}
}

// TestListPropagatesACountFailure pins that a failed COUNT is not swallowed: all
// four list routes answer {"data": items, "total": total}, so discarding the
// error would report total: 0 while still returning rows.
func TestListPropagatesACountFailure(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(`SELECT COUNT\(\*\)`).WillReturnError(errors.New("count blew up"))
	// The items expectation must be set: with MatchExpectationsInOrder(false) an
	// unmet expectation is itself an error, so leaving it out makes the test pass
	// even when the COUNT error is discarded — the discard mutant would then "fail"
	// on the items query instead, and err would still be non-nil. COUNT has to be
	// the only failure source for this assertion to mean anything.
	mock.ExpectQuery(`LIMIT \$2`).WithArgs("t1", 20).WillReturnRows(sqlmock.NewRows(requestCols))

	items, total, err := repo.List(context.Background(), "t1", models.ListQuery{})
	if err == nil {
		t.Fatal("List returned no error when the COUNT query failed")
	}
	// Pin the message: the error must be the COUNT's, not a later query's.
	if !strings.Contains(err.Error(), "count blew up") {
		t.Fatalf("List err = %q, want the COUNT error", err)
	}
	if items != nil {
		t.Errorf("items = %v, want nil on a count failure", items)
	}
	if total != 0 {
		t.Errorf("total = %d, want 0 on a count failure", total)
	}
}

// TestTheDriversObservePlaceholdersAndColumnsIsThePositiveControl proves each
// fix above is observable at all. sqlmock never runs sqlx's named-arg
// resolution and never runs struct-tag mapping, so a reviewer could argue those
// tests pass regardless of the code. sqlmock DOES hand the raw row values to
// database/sql's scan machinery, which is how the column-mapping arms are
// visible. Without every arm failing here the fixes would be unverified.
func TestTheDriversObservePlaceholdersAndColumnsIsThePositiveControl(t *testing.T) {
	t.Run("camelCase tenant placeholder", func(t *testing.T) {
		conn, mock := newRawConn(t)
		mock.ExpectExec(`INSERT INTO ai_gateway_requests`).WillReturnResult(sqlmock.NewResult(1, 1))
		_, err := conn.NamedExecContext(context.Background(),
			"INSERT INTO ai_gateway_requests (id, tenant_id, model, provider, input, output, tokens, latency_ms, created_at) VALUES (:id, :tenantId, :model, :provider, :input, :output, :tokens, :latency_ms, :created_at)",
			&models.GatewayResponse{ID: "r-1", TenantID: "t1", Model: "gpt-4", Provider: "openai", Input: "hi"})
		if err == nil {
			t.Fatal("mutant placeholder unexpectedly bound; the binding test above is vacuous")
		}
		if want := "could not find name tenantId"; !strings.Contains(err.Error(), want) {
			t.Fatalf("err = %q, want it to contain %q", err.Error(), want)
		}
	})

	t.Run("camelCase latency and created placeholders", func(t *testing.T) {
		conn, mock := newRawConn(t)
		mock.ExpectExec(`INSERT INTO ai_gateway_requests`).WillReturnResult(sqlmock.NewResult(1, 1))
		_, err := conn.NamedExecContext(context.Background(),
			"INSERT INTO ai_gateway_requests (id, tenant_id, model, provider, input, output, tokens, latency_ms, created_at) VALUES (:id, :tenant_id, :model, :provider, :input, :output, :tokens, :latencyMs, :createdAt)",
			&models.GatewayResponse{ID: "r-1", TenantID: "t1", Model: "gpt-4", Provider: "openai", Input: "hi"})
		if err == nil {
			t.Fatal("mutant placeholder unexpectedly bound; the binding test above is vacuous")
		}
		if want := "could not find name latencyMs"; !strings.Contains(err.Error(), want) {
			t.Fatalf("err = %q, want it to contain %q", err.Error(), want)
		}
	})

	t.Run("untagged struct drops the tenant column", func(t *testing.T) {
		conn, mock := newRawConn(t)
		mock.ExpectQuery(`SELECT`).WillReturnRows(sqlmock.NewRows(requestCols).
			AddRow("r-1", "t1", "gpt-4", "openai", "hi", "out", int64(1), int64(1), time.Now().UTC()))
		var untagged struct {
			ID        string
			Model     string
			Provider  string
			Input     string
			Output    string
			Tokens    int
			LatencyMs int64
			CreatedAt time.Time
		}
		err := conn.GetContext(context.Background(), &untagged,
			"SELECT id, tenant_id, model, provider, input, output, tokens, latency_ms, created_at FROM ai_gateway_requests WHERE id=$1 AND tenant_id=$2", "r-1", "t1")
		if err == nil {
			t.Fatal("untagged struct unexpectedly scanned; the column-mapping test above is vacuous")
		}
		if want := "missing destination name tenant_id"; !strings.Contains(err.Error(), want) {
			t.Fatalf("err = %q, want it to contain %q", err.Error(), want)
		}
	})

	t.Run("lowercased fallback misses the underscore columns", func(t *testing.T) {
		// LatencyMs and CreatedAt keep no db tag here: sqlx falls back to the
		// lowercased Go name, "latencyms" and "createdat", neither of which is a
		// column. This is the exact regression that broke every read of
		// ai_gateway_requests before the snake_case tags were added.
		conn, mock := newRawConn(t)
		mock.ExpectQuery(`SELECT`).WillReturnRows(sqlmock.NewRows(requestCols).
			AddRow("r-1", "t1", "gpt-4", "openai", "hi", "out", int64(1), int64(1), time.Now().UTC()))
		var dest struct {
			ID        string `db:"id"`
			TenantID  string `db:"tenant_id"`
			Model     string `db:"model"`
			Provider  string `db:"provider"`
			Input     string `db:"input"`
			Output    string `db:"output"`
			Tokens    int    `db:"tokens"`
			LatencyMs int64
			CreatedAt time.Time
		}
		err := conn.GetContext(context.Background(), &dest,
			"SELECT id, tenant_id, model, provider, input, output, tokens, latency_ms, created_at FROM ai_gateway_requests WHERE id=$1 AND tenant_id=$2", "r-1", "t1")
		if err == nil {
			t.Fatal("lowercased fallback unexpectedly scanned; the snake_case tags above are vacuous")
		}
		if want := "missing destination name latency_ms"; !strings.Contains(err.Error(), want) {
			t.Fatalf("err = %q, want it to contain %q", err.Error(), want)
		}
	})
}
