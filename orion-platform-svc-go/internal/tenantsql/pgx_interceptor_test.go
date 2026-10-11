package tenantsql

import (
	"context"
	"errors"
	"regexp"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/jackc/pgx/v5"
)

// fakeQueryer is a QueryerContext implementation for unit testing the wrapper.
type fakeQueryer struct {
	calls int
	lastQuery string
	lastArgs []any
	err error
}

func (f *fakeQueryer) QueryContext(_ context.Context, query string, args ...any) (*QueryResult, error) {
	if f.err != nil {
		return nil, f.err
	}
	f.calls++
	f.lastQuery = query
	f.lastArgs = args
	return &QueryResult{Raw: "fake rows"}, nil
}

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

func TestWithTenantThenFromContext(t *testing.T) {
	ctx := WithTenant(context.Background(), "t-001")
	got, ok := TenantFromContext(ctx)
	if !ok || got != "t-001" {
		t.Errorf("got (%q, %v), want (t-001, true)", got, ok)
	}
}

func TestTenantFromContextNilContext(t *testing.T) {
	if _, ok := TenantFromContext(nil); ok {
		t.Error("nil ctx should return false")
	}
}

func TestTenantFromContextEmptyValue(t *testing.T) {
	ctx := context.WithValue(context.Background(), ContextKey{}, "")
	if _, ok := TenantFromContext(ctx); ok {
		t.Error("empty string should be treated as absent")
	}
}

func TestTenantFromContextWrongType(t *testing.T) {
	ctx := context.WithValue(context.Background(), ContextKey{}, 42)
	if _, ok := TenantFromContext(ctx); ok {
		t.Error("non-string value should be treated as absent")
	}
}

func TestWithTenantNilContextFallsBackToBackground(t *testing.T) {
	ctx := WithTenant(nil, "t-001")
	got, ok := TenantFromContext(ctx)
	if !ok || got != "t-001" {
		t.Errorf("nil-ctx WithTenant should fall back to Background; got (%q, %v)", got, ok)
	}
}

func TestWithTenantTrimsWhitespace(t *testing.T) {
	ctx := WithTenant(context.Background(), "  t-001  ")
	got, _ := TenantFromContext(ctx)
	if got != "t-001" {
		t.Errorf("got %q, want t-001 (trimmed)", got)
	}
}

// ---------------------------------------------------------------------------
// ContainsTenantFilter — the pure SQL sniffer
// ---------------------------------------------------------------------------

func TestContainsTenantFilterMatchesVariousForms(t *testing.T) {
	positive := []string{
		"SELECT * FROM users WHERE tenant_id = $1",
		"UPDATE users SET name = $1 WHERE tenant_id = $2",
		"DELETE FROM orders WHERE t.tenant_id = $1",
		"SELECT * FROM accounts WHERE tenant_uuid = $1",
		"SELECT * FROM accounts WHERE tenant_uid = $1",
		"SELECT * FROM accounts WHERE tenant_key = $1",
		// bare `tenant` (no _id suffix) is intentionally NOT a match: ADR-011
		// names tenant_id / tenant_uuid / tenant_uid / tenant_key.
		// (bare `tenant` is retained only as an allowlist exemption for the
		// `tenants` metadata table, tested in TestDefaultAllowlistMatchesDocumentedPatterns.)
		"SELECT * FROM accounts WHERE TENANT_ID = $1",   // case-insensitive
		"INSERT INTO logs (tenant_id, payload) VALUES ($1, $2)",
		"SELECT COUNT(*) FROM (SELECT * FROM x WHERE tenant_id = $1) sub",
	}
	for _, sql := range positive {
		if !ContainsTenantFilter(sql) {
			t.Errorf("ContainsTenantFilter(%q) = false, want true", sql)
		}
	}
}

func TestContainsTenantFilterRejectsNonTenantSQL(t *testing.T) {
	negative := []string{
		"SELECT * FROM users WHERE user_id = $1",
		"SELECT * FROM users WHERE name = 'tenant'",
		"",
		"SELECT * FROM information_schema.tables",
		"SHOW search_path",
		"SET application_name = 'app'",
		"BEGIN",
		"SELECT id FROM schema_migrations",
	}
	for _, sql := range negative {
		if ContainsTenantFilter(sql) {
			t.Errorf("ContainsTenantFilter(%q) = true, want false", sql)
		}
	}
}

func TestContainsTenantFilterDoesNotMatchStringLiteral(t *testing.T) {
	// The value 'tenant_id' inside a string literal must NOT be misread as
	// a column reference. This is why the regex uses identifier boundaries.
	if ContainsTenantFilter("SELECT * FROM users WHERE notes = 'tenant_id'") {
		t.Error("string literal 'tenant_id' must not match as a column")
	}
}

func TestContainsTenantFilterMatchesSchemaPlaceholder(t *testing.T) {
	sql := "SELECT * FROM x WHERE $tenant_schema = $1"
	if !ContainsTenantFilter(sql) {
		t.Error("schema placeholder must match")
	}
}

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------

func TestDefaultAllowlistMatchesDocumentedPatterns(t *testing.T) {
	al := DefaultAllowlist()
	tests := []struct {
		name string
		sql  string
		want bool
	}{
		{"schema_migrations", "SELECT version FROM schema_migrations", true},
		{"tenants table", "SELECT * FROM tenants WHERE id = $1", true},
		{"information_schema", "SELECT * FROM information_schema.tables", true},
		{"pg_catalog", "SELECT * FROM pg_catalog.pg_tables", true},
		{"SHOW statement", "SHOW search_path", true},
		{"SET statement", "SET application_name = 'app'", true},
		{"BEGIN", "BEGIN", true},
		{"COMMIT", "COMMIT", true},
		{"ROLLBACK", "ROLLBACK", true},
		{"START TRANSACTION", "START TRANSACTION ISOLATION LEVEL SERIALIZABLE", true},
		// Non-allowlist patterns:
		{"business table", "SELECT * FROM users WHERE id = $1", false},
		{"tenant_id table not allowlisted", "SELECT * FROM users WHERE tenant_id = $1", false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, got := al.Match(tc.sql)
			if got != tc.want {
				t.Errorf("al.Match(%q) = %v, want %v", tc.sql, got, tc.want)
			}
		})
	}
}

func TestAllowlistAddIsConcurrentSafe(t *testing.T) {
	al := NewAllowlist()
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			al.Add(regexp.MustCompile(`(?i)pattern`+string(rune('0'+i%10))), "added")
		}(i)
	}
	wg.Wait()
	if al.len() == 0 {
		t.Error("allowlist should have entries after concurrent Add")
	}
}

func TestAllowlistMatchNilIsSafe(t *testing.T) {
	var al *Allowlist
	if _, ok := al.Match("anything"); ok {
		t.Error("nil allowlist must not match")
	}
}

func TestNewAllowlistDropsNilPatterns(t *testing.T) {
	al := NewAllowlist(
		AllowlistEntry{Pattern: nil, Reason: "skip"},
		AllowlistEntry{Pattern: regexp.MustCompile(`^X$`), Reason: "keep"},
	)
	if al.len() != 1 {
		t.Errorf("NewAllowlist dropped non-nil entries: len=%d", al.len() + 1)
	}
	_, ok := al.Match("X")
	if !ok {
		t.Error("kept entry should match")
	}
}

// ---------------------------------------------------------------------------
// Validate — the pure policy check
// ---------------------------------------------------------------------------

func TestValidateRequiresAllowlist(t *testing.T) {
	ctx := WithTenant(context.Background(), "t-1")
	res := Validate(ctx, "SELECT 1", nil)
	if res.Reason != ReasonTenantFilterMissing || !errors.Is(res.Err, ErrWhitelistNotConfigured) {
		t.Errorf("Validate with nil allowlist: reason=%v err=%v", res.Reason, res.Err)
	}
}

func TestValidateMissingTenantID(t *testing.T) {
	al := DefaultAllowlist()
	res := Validate(context.Background(), "SELECT 1", al)
	if res.Reason != ReasonTenantIDMissing {
		t.Errorf("reason=%v, want ReasonTenantIDMissing", res.Reason)
	}
	if !errors.Is(res.Err, ErrTenantMissing) {
		t.Errorf("err=%v, want ErrTenantMissing", res.Err)
	}
}

func TestValidateTenantFilterPresentPasses(t *testing.T) {
	ctx := WithTenant(context.Background(), "t-1")
	al := DefaultAllowlist()
	res := Validate(ctx, "SELECT * FROM users WHERE tenant_id = $1", al)
	if res.Reason != ReasonPass {
		t.Errorf("reason=%v, want ReasonPass", res.Reason)
	}
	if res.TenantID != "t-1" {
		t.Errorf("tenantID=%q, want t-1", res.TenantID)
	}
}

func TestValidateMissingTenantFilter(t *testing.T) {
	ctx := WithTenant(context.Background(), "t-1")
	al := DefaultAllowlist()
	res := Validate(ctx, "SELECT * FROM users WHERE id = $1", al)
	if res.Reason != ReasonTenantFilterMissing {
		t.Errorf("reason=%v, want ReasonTenantFilterMissing", res.Reason)
	}
	if !errors.Is(res.Err, ErrTenantFilterMissing) {
		t.Errorf("err=%v, want ErrTenantFilterMissing", res.Err)
	}
}

func TestValidateAllowlistedSkipsTenantFilterCheck(t *testing.T) {
	ctx := WithTenant(context.Background(), "t-1")
	al := DefaultAllowlist()
	res := Validate(ctx, "SELECT * FROM information_schema.tables", al)
	if res.Reason != ReasonAllowlisted {
		t.Errorf("reason=%v, want ReasonAllowlisted", res.Reason)
	}
	if res.MatchedAllowlistEntry.Reason == "" {
		t.Error("matched allowlist entry should carry a reason")
	}
}

func TestValidationReasonString(t *testing.T) {
	tests := []struct {
		reason ValidationReason
		want   string
	}{
		{ReasonPass, "pass"},
		{ReasonAllowlisted, "allowlisted"},
		{ReasonTenantIDMissing, "tenant_id_missing"},
		{ReasonTenantFilterMissing, "tenant_filter_missing"},
		{ValidationReason(99), "unknown"},
	}
	for _, tc := range tests {
		if tc.reason.String() != tc.want {
			t.Errorf("ValidationReason(%d).String() = %q, want %q", tc.reason, tc.reason.String(), tc.want)
		}
	}
}

func TestFilterModeString(t *testing.T) {
	tests := []struct {
		mode FilterMode
		want string
	}{
		{ModeWarn, "warn"},
		{ModeEnforce, "enforce"},
		{ModeOff, "off"},
		{FilterMode(99), "unknown"},
	}
	for _, tc := range tests {
		if tc.mode.String() != tc.want {
			t.Errorf("FilterMode(%d).String() = %q, want %q", tc.mode, tc.mode.String(), tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// Tracer — pgx QueryTracer adapter
// ---------------------------------------------------------------------------

func TestTracerEnforceCancelsContext(t *testing.T) {
	tracer := NewTenantFilterTracer(ModeEnforce, DefaultAllowlist())
	ctx := context.Background() // no tenant
	out := tracer.TraceQueryStart(ctx, nil, traceData("SELECT * FROM users WHERE id = $1"))
	if out.Err() == nil {
		t.Error("enforce mode must return a canceled context when tenant is missing")
	}
}

func TestTracerEnforcePassesWhenTenantFilterPresent(t *testing.T) {
	tracer := NewTenantFilterTracer(ModeEnforce, DefaultAllowlist())
	ctx := WithTenant(context.Background(), "t-1")
	out := tracer.TraceQueryStart(ctx, nil, traceData("SELECT * FROM users WHERE tenant_id = $1"))
	if out.Err() != nil {
		t.Errorf("enforce mode with tenant filter should pass through, got err=%v", out.Err())
	}
	if out != ctx {
		t.Error("non-violating query should return the same ctx unchanged")
	}
}

func TestTracerWarnDoesNotCancel(t *testing.T) {
	tracer := NewTenantFilterTracer(ModeWarn, DefaultAllowlist())
	ctx := context.Background()
	out := tracer.TraceQueryStart(ctx, nil, traceData("SELECT * FROM users WHERE id = $1"))
	if out.Err() != nil {
		t.Error("warn mode must not cancel the context")
	}
}

func TestTracerOffIsNoop(t *testing.T) {
	tracer := NewTenantFilterTracer(ModeOff, DefaultAllowlist())
	ctx := context.Background()
	out := tracer.TraceQueryStart(ctx, nil, traceData("SELECT * FROM users WHERE id = $1"))
	if out != ctx {
		t.Error("off mode must return ctx unchanged")
	}
}

func TestTracerNilReceiverIsSafe(t *testing.T) {
	var tracer *Tracer
	ctx := context.Background()
	out := tracer.TraceQueryStart(ctx, nil, traceData("SELECT 1"))
	if out != ctx {
		t.Error("nil tracer must return ctx unchanged")
	}
	tracer.TraceQueryEnd(ctx, nil, traceEndData(nil))
}

func TestTracerNilContextReturnsNilContext(t *testing.T) {
	tracer := NewTenantFilterTracer(ModeEnforce, DefaultAllowlist())
	out := tracer.TraceQueryStart(nil, nil, traceData("SELECT 1"))
	if out != nil {
		t.Error("nil ctx must return nil ctx")
	}
}

func TestTracerAllowlistedQueryPasses(t *testing.T) {
	tracer := NewTenantFilterTracer(ModeEnforce, DefaultAllowlist())
	ctx := WithTenant(context.Background(), "t-1")
	out := tracer.TraceQueryStart(ctx, nil, traceData("SELECT version FROM schema_migrations"))
	if out.Err() != nil {
		t.Errorf("allowlisted query must pass, got err=%v", out.Err())
	}
}

func TestTracerOnViolationCallback(t *testing.T) {
	var count atomic.Int32
	var gotReason atomic.Value
	tracer := NewTenantFilterTracer(ModeEnforce, DefaultAllowlist())
	tracer.OnViolation = func(_ context.Context, _ string, res ValidateResult) {
		count.Add(1)
		gotReason.Store(res.Reason)
	}
	ctx := context.Background() // no tenant
	tracer.TraceQueryStart(ctx, nil, traceData("SELECT * FROM users WHERE id = $1"))
	if got := count.Load(); got != 1 {
		t.Errorf("OnViolation called %d times, want 1", got)
	}
	if got := gotReason.Load().(ValidationReason); got != ReasonTenantIDMissing {
		t.Errorf("OnViolation reason=%v, want ReasonTenantIDMissing", got)
	}
}

func TestTracerOnViolationNotCalledOnPass(t *testing.T) {
	var count atomic.Int32
	tracer := NewTenantFilterTracer(ModeEnforce, DefaultAllowlist())
	tracer.OnViolation = func(context.Context, string, ValidateResult) { count.Add(1) }
	ctx := WithTenant(context.Background(), "t-1")
	tracer.TraceQueryStart(ctx, nil, traceData("SELECT * FROM users WHERE tenant_id = $1"))
	if got := count.Load(); got != 0 {
		t.Errorf("OnViolation called %d times on pass, want 0", got)
	}
}

func TestTracerCustomAllowlist(t *testing.T) {
	al := NewAllowlist(
		AllowlistEntry{Pattern: regexp.MustCompile(`(?i)\bmy_system_table\b`), Reason: "custom"},
	)
	tracer := NewTenantFilterTracer(ModeEnforce, al)
	ctx := WithTenant(context.Background(), "t-1")
	out := tracer.TraceQueryStart(ctx, nil, traceData("SELECT * FROM my_system_table"))
	if out.Err() != nil {
		t.Error("custom allowlisted query must pass")
	}
	// But schema_migrations is NOT in the custom allowlist:
	out = tracer.TraceQueryStart(ctx, nil, traceData("SELECT version FROM schema_migrations"))
	if out.Err() == nil {
		t.Error("custom allowlist must not silently fall back to defaults")
	}
}

func TestNewTenantFilterTracerNilAllowlistFallsBackToDefaults(t *testing.T) {
	tracer := NewTenantFilterTracer(ModeEnforce, nil)
	ctx := WithTenant(context.Background(), "t-1")
	// Default allowlist covers schema_migrations.
	out := tracer.TraceQueryStart(ctx, nil, traceData("SELECT version FROM schema_migrations"))
	if out.Err() != nil {
		t.Errorf("nil allowlist should fall back to defaults; got err=%v", out.Err())
	}
}

func TestTracerIsConcurrentSafe(t *testing.T) {
	tracer := NewTenantFilterTracer(ModeEnforce, DefaultAllowlist())
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ctx := WithTenant(context.Background(), "t-1")
			tracer.TraceQueryStart(ctx, nil, traceData("SELECT * FROM users WHERE tenant_id = $1"))
		}()
	}
	wg.Wait()
}

// traceData builds a pgx.TraceQueryStartData value.
func traceData(sql string) pgx.TraceQueryStartData {
	return pgx.TraceQueryStartData{SQL: sql, Args: []any{"x"}}
}

// traceEndData builds a pgx.TraceQueryEndData value.
func traceEndData(err error) pgx.TraceQueryEndData {
	return pgx.TraceQueryEndData{Err: err}
}

// ---------------------------------------------------------------------------
// QueryerContext wrapper (database/sql shim)
// ---------------------------------------------------------------------------

func TestQueryerWrapperEnforceBlocksMissingTenant(t *testing.T) {
	inner := &fakeQueryer{}
	w := NewQueryerContextWrapper(inner, ModeEnforce, DefaultAllowlist())
	_, err := w.QueryContext(context.Background(), "SELECT * FROM users WHERE id = $1")
	if !errors.Is(err, ErrTenantMissing) {
		t.Errorf("err=%v, want ErrTenantMissing", err)
	}
	if inner.calls != 0 {
		t.Errorf("inner calls = %d, want 0 (query must not reach DB)", inner.calls)
	}
}

func TestQueryerWrapperEnforceBlocksMissingFilter(t *testing.T) {
	inner := &fakeQueryer{}
	w := NewQueryerContextWrapper(inner, ModeEnforce, DefaultAllowlist())
	ctx := WithTenant(context.Background(), "t-1")
	_, err := w.QueryContext(ctx, "SELECT * FROM users WHERE id = $1")
	if !errors.Is(err, ErrTenantFilterMissing) {
		t.Errorf("err=%v, want ErrTenantFilterMissing", err)
	}
}

func TestQueryerWrapperPassesWhenTenantFilterPresent(t *testing.T) {
	inner := &fakeQueryer{}
	w := NewQueryerContextWrapper(inner, ModeEnforce, DefaultAllowlist())
	ctx := WithTenant(context.Background(), "t-1")
	res, err := w.QueryContext(ctx, "SELECT * FROM users WHERE tenant_id = $1", "foo")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if res == nil {
		t.Fatal("expected non-nil result")
	}
	if inner.calls != 1 || inner.lastQuery != "SELECT * FROM users WHERE tenant_id = $1" {
		t.Errorf("inner not called correctly: calls=%d last=%q", inner.calls, inner.lastQuery)
	}
}

func TestQueryerWrapperWarnModeLetsThrough(t *testing.T) {
	inner := &fakeQueryer{}
	w := NewQueryerContextWrapper(inner, ModeWarn, DefaultAllowlist())
	_, err := w.QueryContext(context.Background(), "SELECT * FROM users WHERE id = $1")
	if err != nil {
		t.Errorf("warn mode must not return error, got %v", err)
	}
	if inner.calls != 1 {
		t.Errorf("inner calls = %d, want 1 (warn mode must let through)", inner.calls)
	}
}

func TestQueryerWrapperOffModeIsIdentity(t *testing.T) {
	inner := &fakeQueryer{}
	w := NewQueryerContextWrapper(inner, ModeOff, DefaultAllowlist())
	if w != inner {
		t.Error("ModeOff must return the underlying queryer unchanged")
	}
}

func TestQueryerWrapperNilInnerReturnsNil(t *testing.T) {
	if got := NewQueryerContextWrapper(nil, ModeEnforce, DefaultAllowlist()); got != nil {
		t.Errorf("nil inner should return nil, got %v", got)
	}
}

func TestQueryerWrapperPropagatesInnerErrors(t *testing.T) {
	innerErr := errors.New("db down")
	inner := &fakeQueryer{err: innerErr}
	w := NewQueryerContextWrapper(inner, ModeEnforce, DefaultAllowlist())
	ctx := WithTenant(context.Background(), "t-1")
	_, err := w.QueryContext(ctx, "SELECT * FROM users WHERE tenant_id = $1")
	if !errors.Is(err, innerErr) {
		t.Errorf("err=%v, want propagated inner error %v", err, innerErr)
	}
}

func TestQueryerWrapperAllowlistedQueryPasses(t *testing.T) {
	inner := &fakeQueryer{}
	w := NewQueryerContextWrapper(inner, ModeEnforce, DefaultAllowlist())
	ctx := WithTenant(context.Background(), "t-1")
	_, err := w.QueryContext(ctx, "SELECT version FROM schema_migrations")
	if err != nil {
		t.Errorf("allowlisted query must pass: %v", err)
	}
	if inner.calls != 1 {
		t.Errorf("inner calls = %d, want 1", inner.calls)
	}
}
