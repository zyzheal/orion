package advisor

import (
	"context"
	"strings"
	"testing"

	dba_models "orion/platform-svc-go/internal/dba/models"
)

// ---- inferTables ----

func TestInferTables_SimpleFrom(t *testing.T) {
	out := inferTables([]SlowQueryRow{
		{Query: "SELECT * FROM orders WHERE id = 1"},
		{Query: "SELECT * FROM users WHERE id = 2"},
	})
	if len(out) != 2 {
		t.Errorf("expected 2 tables, got %d: %v", len(out), out)
	}
}

func TestInferTables_JoinAndFrom(t *testing.T) {
	out := inferTables([]SlowQueryRow{
		{Query: "SELECT * FROM orders JOIN users ON orders.user_id = users.id WHERE orders.status = 'x'"},
	})
	seen := map[string]bool{}
	for _, t := range out {
		seen[strings.ToLower(t)] = true
	}
	if !seen["orders"] || !seen["users"] {
		t.Errorf("expected orders + users, got %v", out)
	}
}

func TestInferTables_SchemaPrefixStripped(t *testing.T) {
	out := inferTables([]SlowQueryRow{
		{Query: "SELECT * FROM public.orders WHERE id = 1"},
	})
	if len(out) != 1 || out[0] != "orders" {
		t.Errorf("expected [orders], got %v", out)
	}
}

// ---- hasCoveringIndex ----

func TestHasCoveringIndex_Match(t *testing.T) {
	existing := []ExistingIndex{{Name: "idx_users_email", Table: "users", Columns: []string{"email"}}}
	if !hasCoveringIndex(existing, "users", []string{"email", "id"}) {
		t.Error("expected covering match on first column")
	}
}

func TestHasCoveringIndex_NoMatch(t *testing.T) {
	existing := []ExistingIndex{{Name: "idx_users_email", Table: "users", Columns: []string{"email"}}}
	if hasCoveringIndex(existing, "users", []string{"id", "email"}) {
		t.Error("expected no match when first column differs")
	}
}

func TestHasCoveringIndex_DifferentTable(t *testing.T) {
	existing := []ExistingIndex{{Name: "idx_users_email", Table: "users", Columns: []string{"id"}}}
	if hasCoveringIndex(existing, "orders", []string{"id"}) {
		t.Error("expected no match for different table")
	}
}

// ---- quoteIdent ----

func TestQuoteIdent_Postgres(t *testing.T) {
	got := quoteIdent("postgres", "orders")
	want := `"orders"`
	if got != want {
		t.Errorf("expected %q got %q", want, got)
	}
}

func TestQuoteIdent_MySQL(t *testing.T) {
	got := quoteIdent("mysql", "orders")
	want := "`orders`"
	if got != want {
		t.Errorf("expected %q got %q", want, got)
	}
}

func TestQuoteIdent_EscapesQuotes(t *testing.T) {
	got := quoteIdent("postgres", `a"b`)
	want := `"a""b"`
	if got != want {
		t.Errorf("expected %q got %q", want, got)
	}
}

// ---- extractFilterColumns ----

func TestExtractFilterColumns_WHERE(t *testing.T) {
	out := extractFilterColumns("SELECT * FROM orders WHERE status = 'x' AND created_at > NOW()", "orders")
	seen := map[string]bool{}
	for _, c := range out {
		seen[c] = true
	}
	if !seen["status"] {
		t.Errorf("expected status in filter columns, got %v", out)
	}
	if !seen["created_at"] {
		t.Errorf("expected created_at in filter columns, got %v", out)
	}
}

func TestExtractFilterColumns_JoinTable(t *testing.T) {
	out := extractFilterColumns("SELECT * FROM orders WHERE orders.status = 'x'", "orders")
	for _, c := range out {
		if c == "orders" {
			t.Error("should not include the table name as a column")
		}
	}
}

// ---- buildIndexSuggestion ----

func TestBuildIndexSuggestion_SQL(t *testing.T) {
	colUsage := map[string]int{"id": 3, "status": 1}
	rows := []SlowQueryRow{
		{Query: "SELECT * FROM orders WHERE id = 1", TotalTime: 1000, CallCount: 3},
		{Query: "SELECT * FROM orders WHERE status = 'x'", TotalTime: 500, CallCount: 1},
	}
	s := buildIndexSuggestion("orders", []string{"id", "status"}, "postgres", rows, colUsage)
	if !strings.Contains(s.SQL, "CREATE INDEX") {
		t.Errorf("expected CREATE INDEX in SQL, got %q", s.SQL)
	}
	if !strings.Contains(s.SQL, `"orders"`) {
		t.Errorf("expected quoted table name, got %q", s.SQL)
	}
	if s.Columns[0] != "id" {
		t.Errorf("expected id to be first column (highest usage), got %v", s.Columns)
	}
	if s.Impact <= 0 {
		t.Errorf("expected positive impact, got %g", s.Impact)
	}
}

func TestBuildIndexSuggestion_MySQLQuoting(t *testing.T) {
	s := buildIndexSuggestion("orders", []string{"id"}, "mysql", nil, map[string]int{"id": 1})
	if !strings.Contains(s.SQL, "`orders`") {
		t.Errorf("expected backtick quoting for mysql, got %q", s.SQL)
	}
}

// ---- SuggestIndexes ----

type stubSlowLookup struct{ rows []SlowQueryRow }

func (s stubSlowLookup) TopN(ctx context.Context, tenantID, dsID string, limit int) ([]SlowQueryRow, error) {
	return s.rows, nil
}

func TestSuggestIndexes_NoRepo(t *testing.T) {
	svc := &IndexAdvisorService{}
	_, err := svc.SuggestIndexes(nil, "tenant-1", SuggestIndexesRequest{})
	if err == nil {
		t.Fatal("expected error when repo is nil")
	}
	if err.Error() != "advisor: dependencies not wired" {
		t.Errorf("unexpected error: %v", err)
	}
}

// stubDataSourceLookup returns a fixed data source; used to exercise
// tenant-mismatch rejection without a real resolver.
type stubDataSourceLookup struct{ ds *dba_models.DataSource }

func (s *stubDataSourceLookup) GetDataSource(ctx context.Context, id string) (*dba_models.DataSource, error) {
	return s.ds, nil
}

// TestSuggestIndexes_TenantMismatch ensures a data source owned by a
// different tenant is rejected before any work happens.
func TestSuggestIndexes_TenantMismatch(t *testing.T) {
	dsLookup := &stubDataSourceLookup{ds: &dba_models.DataSource{ID: "ds-1", TenantID: "tenant-other"}}
	svc := NewIndexAdvisorService(&Repository{dsLookup: dsLookup}, nil, nil)
	_, err := svc.SuggestIndexes(context.Background(), "tenant-1", SuggestIndexesRequest{DataSourceID: "ds-1"})
	if err == nil {
		t.Fatal("expected tenant mismatch error")
	}
}
