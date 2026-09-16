package repository

import (
	"context"
	"database/sql"
	"fmt"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/llm-trace/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// harness wires a recording sqlmock into a repository. seen collects the
// normalised statements actually issued, so a test can prove that nothing
// reached the database at all.
type harness struct {
	mock sqlmock.Sqlmock
	seen []string
	repo *Repository
}

var reInsertColumns = regexp.MustCompile(`(?is)INSERT INTO llm_traces \(([\s\S]*?)\)\s+VALUES`)
var reNamedParam = regexp.MustCompile(`:[A-Za-z_][A-Za-z0-9_]*`)

func newHarness(t *testing.T) *harness {
	t.Helper()
	h := &harness{}
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		h.seen = append(h.seen, normSQL(actual))
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", normSQL(expected), normSQL(actual))
		}
		return nil
	})))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	h.mock = mock
	h.repo = NewRepository(sqlx.NewDb(raw, "postgres"))
	return h
}

func (h *harness) assertNoStatements(t *testing.T) {
	t.Helper()
	if len(h.seen) != 0 {
		t.Fatalf("expected no statement, but %d was issued: %v", len(h.seen), h.seen)
	}
}

func insertColumns(stmt string) []string {
	m := reInsertColumns.FindStringSubmatch(stmt)
	if m == nil {
		return nil
	}
	parts := strings.Split(m[1], ",")
	cols := make([]string, 0, len(parts))
	for _, p := range parts {
		cols = append(cols, strings.TrimSpace(p))
	}
	return cols
}

func namedParams(stmt string) []string {
	out := make([]string, 0, 8)
	for _, p := range reNamedParam.FindAllString(stmt, -1) {
		out = append(out, strings.TrimPrefix(p, ":"))
	}
	return out
}

// The column list and the VALUES list must line up positionally.
func TestCreateTraceSQL_ColumnsLineUpWithPlaceholders(t *testing.T) {
	cols := insertColumns(createTraceSQL)
	params := namedParams(createTraceSQL)
	if len(cols) == 0 {
		t.Fatalf("could not parse the INSERT column list from createTraceSQL")
	}
	if len(cols) != len(params) {
		t.Fatalf("%d columns but %d placeholders: %v vs %v", len(cols), len(params), cols, params)
	}
	for i := range cols {
		if cols[i] != params[i] {
			t.Errorf("column %d: %q has placeholder %q", i, cols[i], params[i])
		}
	}
}

// Every parameter must be the db tag on models.LLMTrace, not a Go field name.
// sqlx maps a field to its db tag when present and otherwise to
// strings.ToLower(GoFieldName), so a camelCase parameter matches nothing and the
// insert fails with "could not find name tenantId in &models.LLMTrace{...}".
func TestCreateTraceSQL_EveryParameterIsAnLLMTraceDbTag(t *testing.T) {
	typ := reflect.TypeOf(models.LLMTrace{})
	tags := make(map[string]bool, typ.NumField())
	for i := 0; i < typ.NumField(); i++ {
		f := typ.Field(i)
		tag := f.Tag.Get("db")
		if tag == "" {
			t.Fatalf("models.LLMTrace.%s has no db tag, so it cannot be named in a sqlx query", f.Name)
		}
		if tags[tag] {
			t.Errorf("db tag %q is used by two fields of models.LLMTrace", tag)
		}
		tags[tag] = true
	}

	for _, p := range namedParams(createTraceSQL) {
		if !tags[p] {
			t.Errorf("parameter :%s is not a db tag on models.LLMTrace", p)
		}
	}
	// The reverse direction: a dropped column would not be seen by the loop
	// above, because it only inspects names that are present.
	cols := insertColumns(createTraceSQL)
	for _, c := range cols {
		if !tags[c] {
			t.Errorf("insert column %q is not a db tag on models.LLMTrace", c)
		}
	}
	if len(tags) != len(cols) {
		t.Fatalf("models.LLMTrace has %d db tags but the INSERT writes %d columns", len(tags), len(cols))
	}
}

// sqlx.Named resolves the named parameters against the struct with no database
// at all. The old statement failed here twice over: ":requestContext::jsonb"
// aborts with "unexpected `:` while reading named param", and the camelCase
// names abort with "could not find name".
func TestCreateTraceSQL_BindsAgainstModelsLLMTrace(t *testing.T) {
	tr := &models.LLMTrace{
		TenantID:         "tenant-1",
		ModelID:          "gpt-4",
		PromptContent:    sql.NullString{String: "hello", Valid: true},
		RequestStartedAt: time.Now().UTC(),
	}

	bound, args, err := sqlx.Named(createTraceSQL, tr)
	if err != nil {
		t.Fatalf("sqlx.Named failed, so POST /api/v1/llm/traces could never bind: %v", err)
	}
	if strings.Contains(bound, ":") {
		t.Fatalf("an unbound named parameter survives in the statement: %s", bound)
	}
	want := len(namedParams(createTraceSQL))
	if n := strings.Count(bound, "?"); n != want {
		t.Fatalf("bound %d placeholders, want %d: %s", n, want, bound)
	}
	if len(args) != want {
		t.Fatalf("bound %d arguments, want %d", len(args), want)
	}
}

// CreateTrace must send exactly the statement the tests above pinned. Binding
// the const alone would not notice a second statement inlined in the method.
func TestCreateTrace_SendsThePinnedStatement(t *testing.T) {
	h := newHarness(t)
	tr := &models.LLMTrace{TenantID: "tenant-1", ModelID: "gpt-4"}

	h.mock.ExpectExec(normSQL(`INSERT INTO llm_traces (id, tenant_id, user_id, scenario_id, provider_id, model_id, prompt_content, prompt_hash, output_content, output_hash, input_tokens, output_tokens, total_tokens, input_cost, output_cost, total_cost, currency, status, request_started_at, request_completed_at, duration_ms, parent_trace_id, error_message, request_context, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)`)).
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := h.repo.CreateTrace(context.Background(), tr); err != nil {
		t.Fatalf("CreateTrace: %v", err)
	}
	if err := h.mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
	if tr.ID == "" {
		t.Error("CreateTrace did not generate an id")
	}
	if tr.Status != models.TraceStatusPending {
		t.Errorf("status = %q, want pending", tr.Status)
	}
	if tr.Currency != "CNY" {
		t.Errorf("currency = %q, want CNY", tr.Currency)
	}

	// Rebind the same const against the struct and require the executed
	// statement and argument count to match. This is what catches a column
	// disappearing from the executed statement while the const looked intact.
	// Argument values are not compared: CreateTrace binds the row before it
	// generates the UUID, so argument 0 is empty when bound from the test struct
	// but populated when executed. Adding an id-injection seam to production for
	// that one value was judged disproportionate testability debt.
	bound, args, err := sqlx.Named(createTraceSQL, tr)
	if err != nil {
		t.Fatalf("sqlx.Named: %v", err)
	}
	if len(h.seen) == 0 {
		t.Fatalf("no statement was recorded, so the harness is not observing the database")
	}
	if got := normSQL(placeholdersToDollar(bound)); got != h.seen[0] {
		t.Fatalf("executed statement differs from the pinned statement:\n want %s\n  got %s", h.seen[0], got)
	}
	if len(args) != len(namedParams(createTraceSQL)) {
		t.Fatalf("bound %d arguments, want %d", len(args), len(namedParams(createTraceSQL)))
	}
}

func TestUpdateTrace_EmptyFieldsIsANoOp(t *testing.T) {
	h := newHarness(t)
	if err := h.repo.UpdateTrace(context.Background(), "trace-1", "tenant-1", map[string]interface{}{}); err != nil {
		t.Fatalf("UpdateTrace: %v", err)
	}
	h.assertNoStatements(t)
}

func TestUpdateTrace_WritesEveryAllowedColumnInSortedOrder(t *testing.T) {
	h := newHarness(t)
	completedAt := time.Date(2026, 8, 26, 10, 0, 0, 0, time.UTC)
	fields := map[string]interface{}{
		// Deliberately unordered, to prove the statement does not depend on
		// map iteration order.
		"total_cost":           0.57,
		"output_content":       "hello",
		"input_tokens":         int64(100),
		"duration_ms":          int64(123),
		"status":               "completed",
		"error_message":        "boom",
		"output_tokens":        int64(50),
		"request_completed_at": completedAt,
		"input_cost":           0.12,
		"total_tokens":         int64(150),
		"output_hash":          "abc123",
		"output_cost":          0.45,
	}

	h.mock.ExpectExec("UPDATE llm_traces SET duration_ms = $1, error_message = $2, input_cost = $3, "+
		"input_tokens = $4, output_content = $5, output_cost = $6, output_hash = $7, output_tokens = $8, "+
		"request_completed_at = $9, status = $10, total_cost = $11, total_tokens = $12 "+
		"WHERE id=$13 AND tenant_id=$14").
		WithArgs(int64(123), "boom", 0.12, int64(100), "hello", 0.45, "abc123", int64(50),
			completedAt, "completed", 0.57, int64(150), "trace-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := h.repo.UpdateTrace(context.Background(), "trace-1", "tenant-1", fields); err != nil {
		t.Fatalf("UpdateTrace: %v", err)
	}
	if err := h.mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestUpdateTrace_OnlyWritesTheRequestedColumns(t *testing.T) {
	h := newHarness(t)
	h.mock.ExpectExec("UPDATE llm_traces SET status = $1 WHERE id=$2 AND tenant_id=$3").
		WithArgs("completed", "trace-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := h.repo.UpdateTrace(context.Background(), "trace-1", "tenant-1",
		map[string]interface{}{"status": "completed"}); err != nil {
		t.Fatalf("UpdateTrace: %v", err)
	}
	if err := h.mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestUpdateTrace_RejectsUnwritableColumns(t *testing.T) {
	h := newHarness(t)
	for _, bad := range []string{"foo", "id", "tenant_id", "created_at", "prompt_content"} {
		err := h.repo.UpdateTrace(context.Background(), "trace-1", "tenant-1",
			map[string]interface{}{bad: "x"})
		if err == nil {
			t.Errorf("%s: err = nil, want the key rejected", bad)
			continue
		}
		if !strings.Contains(err.Error(), bad) {
			t.Errorf("%s: error = %q, want the offending key named", bad, err.Error())
		}
	}
	h.assertNoStatements(t)

	// Sanity-check the recorder itself, so the empty h.seen above proves
	// something: a valid update does reach the database and is recorded.
	h.mock.ExpectExec("UPDATE llm_traces SET status = $1 WHERE id=$2 AND tenant_id=$3").
		WithArgs("completed", "trace-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	if err := h.repo.UpdateTrace(context.Background(), "trace-1", "tenant-1",
		map[string]interface{}{"status": "completed"}); err != nil {
		t.Fatalf("UpdateTrace: %v", err)
	}
	if len(h.seen) != 1 {
		t.Fatalf("harness recorded %d statements after one update, want 1: %v", len(h.seen), h.seen)
	}
}

// CompleteTrace builds exactly these keys, so the whitelist has to stay in
// lockstep: a key the service writes but the whitelist forbids would make every
// completion fail, and a key in the whitelist that nothing sends is dead weight.
func TestUpdateTrace_WhitelistMatchesTheColumnsCompleteTraceSends(t *testing.T) {
	want := []string{
		"output_content", "output_hash", "input_tokens", "output_tokens",
		"total_tokens", "input_cost", "output_cost", "total_cost", "status",
		"request_completed_at", "duration_ms", "error_message",
	}
	sort.Strings(want)
	got := make([]string, 0, len(traceUpdateColumns))
	for k := range traceUpdateColumns {
		got = append(got, k)
	}
	sort.Strings(got)
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("whitelist = %v, want %v", got, want)
	}
}

// sqlx.Named hands back []interface{}; sqlmock expects driver.Value. The
// conversion is element-wise, so the values themselves are untouched.
// sqlx binds against the driver named in NewDb, which is postgres here, so
// the statement it executes carries $n placeholders rather than ?. Apply
// the same substitution the binder does so the test compares like with like.
func placeholdersToDollar(stmt string) string {
	var b strings.Builder
	i := 0
	for _, c := range stmt {
		if c != '?' {
			b.WriteRune(c)
			continue
		}
		i++
		b.WriteString(fmt.Sprintf("$%d", i))
	}
	return b.String()
}

func normSQL(s string) string {
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
}
