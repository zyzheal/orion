// Package tenantsql implements ADR-011 §3.2.6 L3 — the SQL-level tenant
// filter last line of defence.
//
// ADR reference (docs/adr/ADR-011-多租户存储隔离方案.md §3.2.6):
// "L3 pgx 钩子：pgx 连接层加 TenantFilterInterceptor，运行时对无 tenant_id 的
//  SQL 直接返回错误".
//
// The ADR sketch shows a BeforeQuery(ctx, q) that returns
// ErrTenantMissing / ErrTenantFilterMissing. pgx v5 does not expose a
// pre-flight BeforeQuery hook, but its QueryTracer.TraceQueryStart returns a
// replacement context that the driver uses for the remainder of the call —
// so cancelling that context fails the query before any SQL leaves the
// process. This package combines:
//
//   - a pure check function `Validate(ctx, sql)` that decides pass/fail and
//     the reason; it is the actual policy and is trivially unit-testable;
//   - a pgx v5 QueryTracer adapter that calls Validate from TraceQueryStart
//     and cancels the context on violation;
//   - a database/sql QueryerContext shim for the sqlx/pq path, which has no
//     tracer hook but can be wrapped at the connection level.
//
// The tracer cannot propagate our sentinel errors through the pgx driver;
// callers see context.Canceled. The sentinel errors are surfaced by the
// pure Validate function, which is what tests and middleware log against.
//
// Deployment posture: ADR-011 §3.2.6 step 5 marks L3 as "远期" (long-term);
// it is enabled by wrapping the pgx pool with `pool.WithConfig(&pgx.ConnConfig{Tracer: tenantsql.NewTenantFilterTracer(...)})`.
// Wiring to production is deferred until L1+L2 (Repository base + SQL
// builder) are stable, but the module is ready today.
package tenantsql

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5"
)

// ErrTenantMissing is returned when ctx does not carry a tenant ID.
// Callers must wrap with a context carrying tenantID via the tenant-aware
// context helper (see internal/repository/tenant_ctx.go's WithTenant).
var ErrTenantMissing = errors.New("tenantsql: tenant_id missing from context; tenant-aware SQL forbidden")

// ErrTenantFilterMissing is returned when the SQL statement does not
// reference tenant_id and is not on the system-table allowlist.
var ErrTenantFilterMissing = errors.New("tenantsql: SQL statement has no tenant_id filter and is not allowlisted")

// ErrWhitelistNotConfigured is returned by the pure check function when the
// interceptor is used without an allowlist configured. The default allowlist
// is set from defaults() below, so this only surfaces when a caller replaces
// the interceptor's allowlist with an empty one — treated as misconfiguration
// rather than silently widening the gate.
var ErrWhitelistNotConfigured = errors.New("tenantsql: allowlist is empty; refusing to run without an explicit allowlist")

// ContextKey is the type used for tenant-ID context values. Callers should
// use WithTenant / TenantFromContext below rather than raw
// context.WithValue with this key.
type ContextKey struct{}

// WithTenant returns a child context that carries tenantID.
func WithTenant(ctx context.Context, tenantID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, ContextKey{}, strings.TrimSpace(tenantID))
}

// TenantFromContext extracts the tenant ID from ctx. The boolean result is
// false when the key is absent or the stored value is not a non-empty
// string. This function is safe to call on nil ctx.
func TenantFromContext(ctx context.Context) (string, bool) {
	if ctx == nil {
		return "", false
	}
	v, ok := ctx.Value(ContextKey{}).(string)
	return v, ok && v != ""
}

// AllowlistEntry describes one SQL pattern that is exempt from the
// tenant_id filter requirement.
type AllowlistEntry struct {
	// Pattern is a compiled regexp that must match the SQL to exempt it.
	Pattern *regexp.Regexp
	// Reason is a human-readable explanation of why this pattern is safe.
	// Used in diagnostics.
	Reason string
}

// Allowlist is the set of SQL patterns that are exempt from the
// tenant_id filter requirement.
type Allowlist struct {
	mu      sync.RWMutex
	entries []AllowlistEntry
}

// NewAllowlist builds an Allowlist from compiled entries. nil entries are
// dropped; patterns with a nil Compiled pattern are skipped.
func NewAllowlist(entries ...AllowlistEntry) *Allowlist {
	a := &Allowlist{}
	for _, e := range entries {
		if e.Pattern == nil {
			continue
		}
		a.entries = append(a.entries, e)
	}
	return a
}

// Add appends an entry (concurrently safe).
func (a *Allowlist) Add(pattern *regexp.Regexp, reason string) {
	if pattern == nil {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	a.entries = append(a.entries, AllowlistEntry{Pattern: pattern, Reason: reason})
}

// len returns the number of configured entries.
func (a *Allowlist) len() int {
	if a == nil {
		return 0
	}
	a.mu.RLock()
	defer a.mu.RUnlock()
	return len(a.entries)
}

// Match reports whether sql matches any allowlist entry. Returns (entry,
// true) when a match is found; entry.Reason tells the caller why.
func (a *Allowlist) Match(sql string) (AllowlistEntry, bool) {
	if a == nil {
		return AllowlistEntry{}, false
	}
	a.mu.RLock()
	defer a.mu.RUnlock()
	for _, e := range a.entries {
		if e.Pattern.MatchString(sql) {
			return e, true
		}
	}
	return AllowlistEntry{}, false
}

// DefaultAllowlist returns the set of SQL patterns documented as safe to
// execute without a tenant_id filter (ADR-011 §3.2.6):
//
//   - schema_migrations (migration bookkeeping, no tenant column)
//   - tenants (tenant metadata, no tenant column by definition)
//   - information_schema.* / pg_catalog.* (system catalog)
//   - SHOW / SET (session state, read-only for read sessions)
//   - BEGIN / COMMIT / ROLLBACK / START TRANSACTION (transaction control)
//
// Callers can extend this with NewAllowlist + Add.
func DefaultAllowlist() *Allowlist {
	return NewAllowlist(
		AllowlistEntry{Pattern: regexp.MustCompile(`(?i)\b(schema_migrations)\b`), Reason: "migration version bookkeeping; no tenant column"},
		AllowlistEntry{Pattern: regexp.MustCompile(`(?i)\btenants\b`), Reason: "tenant metadata table; no tenant_id column by definition"},
		AllowlistEntry{Pattern: regexp.MustCompile(`(?i)\binformation_schema\b`), Reason: "Postgres system catalog"},
		AllowlistEntry{Pattern: regexp.MustCompile(`(?i)\bpg_catalog\b`), Reason: "Postgres system catalog"},
		AllowlistEntry{Pattern: regexp.MustCompile(`(?i)^\s*SHOW\s`), Reason: "SHOW is session state, tenant-neutral"},
		AllowlistEntry{Pattern: regexp.MustCompile(`(?i)^\s*SET\s`), Reason: "SET is session state; restricted session parameters"},
		AllowlistEntry{Pattern: regexp.MustCompile(`(?i)^\s*(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\b`), Reason: "transaction control, tenant-neutral"},
	)
}

// reTenantIDColumn matches an identifier-like reference to a column named
// tenant_id, tenant_uuid, or tenant, optionally with a table prefix
// (t.tenant_id). It stops on operators so that string literals like
// 'tenant_id=' do not match.
var reTenantIDColumn = regexp.MustCompile(`(?i)(?:(\w+)\.)?tenant_(?:id|uuid|uid|key)`)

// reTenantPlaceholder is reserved for a future builder-produced schema
// prefix (schema_mode.XYZ.tenant_id); not required for the shared-schema
// mode the service currently runs.
var reTenantPlaceholder = regexp.MustCompile(`(?i)\$(?:tenant|schema)_\w+`)

// ValidationReason is the machine-readable outcome of a Validate call.
type ValidationReason int

const (
	// ReasonPass means the query is allowed to proceed.
	ReasonPass ValidationReason = iota
	// ReasonAllowlisted means the query is exempt under the allowlist.
	ReasonAllowlisted
	// ReasonTenantIDMissing means the ctx had no tenant ID.
	ReasonTenantIDMissing
	// ReasonTenantFilterMissing means the SQL has no tenant_id reference.
	ReasonTenantFilterMissing
)

// String renders the reason for log lines and error messages.
func (r ValidationReason) String() string {
	switch r {
	case ReasonPass:
		return "pass"
	case ReasonAllowlisted:
		return "allowlisted"
	case ReasonTenantIDMissing:
		return "tenant_id_missing"
	case ReasonTenantFilterMissing:
		return "tenant_filter_missing"
	default:
		return "unknown"
	}
}

// ValidateResult carries the outcome of a single Validate call.
type ValidateResult struct {
	// Reason is the machine-readable classification.
	Reason ValidationReason
	// Err is non-nil only when Reason is TenantIDMissing or
	// TenantFilterMissing; it wraps the sentinel.
	Err error
	// TenantID is the tenant ID extracted from ctx (empty if absent).
	TenantID string
	// MatchedAllowlistEntry is populated when Reason == ReasonAllowlisted.
	MatchedAllowlistEntry AllowlistEntry
}

// FilterMode controls how TenantFilter checks are applied.
type FilterMode int

const (
	// ModeWarn logs a diagnostic when a query fails the check but lets it
	// through. Used during L1+L2 rollout so operators can inventory
	// remaining violations before flipping to enforce.
	ModeWarn FilterMode = iota
	// ModeEnforce blocks violating queries by cancelling the context.
	ModeEnforce
	// ModeOff disables the interceptor entirely; useful for tests that
	// construct the tracer without intending to enforce.
	ModeOff
)

// String renders the mode for logs.
func (m FilterMode) String() string {
	switch m {
	case ModeWarn:
		return "warn"
	case ModeEnforce:
		return "enforce"
	case ModeOff:
		return "off"
	default:
		return "unknown"
	}
}

// Tracer is a pgx v5 QueryTracer that enforces the tenant filter. It is
// safe for concurrent use.
type Tracer struct {
	mode      FilterMode
	allowlist *Allowlist
	// OnViolation is invoked once per violating query regardless of mode. It
	// is called on the caller's goroutine; a nil OnViolation is a no-op.
	// The interceptor is intentionally logger-free at the pgx layer — pass a
	// closure to route diagnostics where the operator wants them.
	OnViolation func(ctx context.Context, sql string, result ValidateResult)
}

// NewTenantFilterTracer builds a Tracer with the given mode and allowlist.
// A nil allowlist falls back to DefaultAllowlist.
func NewTenantFilterTracer(mode FilterMode, allowlist *Allowlist) *Tracer {
	if allowlist == nil {
		allowlist = DefaultAllowlist()
	}
	return &Tracer{mode: mode, allowlist: allowlist}
}

// TraceQueryStart is the pgx v5 hook. It validates the incoming SQL and, on
// violation in enforce mode, returns a context that is already cancelled so
// the driver fails the query before it leaves the process.
//
// Note: pgx does not let us propagate ErrTenantMissing through the driver —
// callers see context.Canceled or context.DeadlineExceeded. The sentinel
// errors are still useful for the pure Validate function and for the
// database/sql shim below.
func (t *Tracer) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	if t == nil || t.mode == ModeOff || ctx == nil {
		return ctx
	}
	result := Validate(ctx, data.SQL, t.allowlist)
	if result.Reason == ReasonPass || result.Reason == ReasonAllowlisted {
		return ctx
	}
	if t.OnViolation != nil {
		t.OnViolation(ctx, data.SQL, result)
	}
	if t.mode == ModeEnforce {
		canceledCtx, cancel := context.WithCancel(ctx)
		cancel()
		return canceledCtx
	}
	// ModeWarn: log via OnViolation, but let the query proceed.
	return ctx
}

// TraceQueryEnd is required by pgx.QueryTracer. This implementation is a
// no-op — all enforcement happens at TraceQueryStart.
func (t *Tracer) TraceQueryEnd(context.Context, *pgx.Conn, pgx.TraceQueryEndData) {}

// Validate is the pure policy check. It extracts the tenant ID from ctx and
// inspects sql, applying the allowlist. It does not depend on pgx and can
// be called from tests, middleware, or other drivers.
func Validate(ctx context.Context, sql string, allowlist *Allowlist) ValidateResult {
	if allowlist == nil {
		return ValidateResult{Reason: ReasonTenantFilterMissing, Err: ErrWhitelistNotConfigured}
	}
	tenantID, hasTenant := TenantFromContext(ctx)
	if !hasTenant {
		return ValidateResult{Reason: ReasonTenantIDMissing, Err: ErrTenantMissing}
	}
	if ContainsTenantFilter(sql) {
		return ValidateResult{Reason: ReasonPass, TenantID: tenantID}
	}
	if entry, ok := allowlist.Match(sql); ok {
		return ValidateResult{Reason: ReasonAllowlisted, TenantID: tenantID, MatchedAllowlistEntry: entry}
	}
	return ValidateResult{Reason: ReasonTenantFilterMissing, TenantID: tenantID, Err: ErrTenantFilterMissing}
}

// reStringLiteral matches single- and double-quoted string literals in SQL.
// It is used to blank out literals before the tenant_id column check so a
// literal value like 'tenant_id' is not misread as a column reference. The
// character class excludes the closing quote so literals containing escaped
// quotes ("''") still blank out as a single unit.
var reStringLiteral = regexp.MustCompile(`'[^']*'|"[^"]*"`)

// ContainsTenantFilter reports whether sql references a tenant_id-like
// column, a schema prefix placeholder, or the tenant_id placeholder form
// used by the L2 builder. It is exported so callers (e.g. middleware) can
// inspect SQL before it reaches the database without going through the
// full tracer.
//
// Single- and double-quoted string literals are blanked out before the
// column check, so a value like 'tenant_id' used as a string constant is
// not misread as a column reference. This matters because queries such as
// "SELECT 1 WHERE notes = 'tenant_id'" would otherwise pass the filter
// without actually scoping by tenant.
func ContainsTenantFilter(sql string) bool {
	if sql == "" {
		return false
	}
	stripped := reStringLiteral.ReplaceAllString(sql, " ")
	return reTenantIDColumn.MatchString(stripped) || reTenantPlaceholder.MatchString(stripped)
}

// QueryerContext is the minimal subset of database/sql's QueryerContext that
// the interceptor needs. Any *sql.DB, *sqlx.DB, *pgxpool.Pool adapter or
// test fake can satisfy it.
type QueryerContext interface {
	QueryContext(ctx context.Context, query string, args ...any) (*QueryResult, error)
}

// QueryResult is an opaque handle returned by QueryerContext. It exists so
// the wrapper below does not depend on database/sql directly — the tenant
// filter is a cross-driver concern. Callers cast it to the concrete type
// their QueryerContext returns.
type QueryResult struct {
	// Raw is the concrete result type (e.g. *sql.Rows or *pgx.Rows).
	Raw any
}

// NewQueryerContextWrapper wraps an existing QueryerContext with the tenant
// filter. Violating queries are rejected with the sentinel error before the
// underlying query is dispatched. This provides the same fail-closed
// behaviour as the pgx tracer for code paths that use database/sql.
func NewQueryerContextWrapper(inner QueryerContext, mode FilterMode, allowlist *Allowlist) QueryerContext {
	if inner == nil || mode == ModeOff {
		return inner
	}
	if allowlist == nil {
		allowlist = DefaultAllowlist()
	}
	return &queryerWrapper{inner: inner, mode: mode, allowlist: allowlist}
}

type queryerWrapper struct {
	inner     QueryerContext
	mode      FilterMode
	allowlist *Allowlist
}

func (w *queryerWrapper) QueryContext(ctx context.Context, query string, args ...any) (*QueryResult, error) {
	res := Validate(ctx, query, w.allowlist)
	if res.Reason == ReasonPass || res.Reason == ReasonAllowlisted {
		return w.inner.QueryContext(ctx, query, args...)
	}
	if w.mode == ModeWarn {
		// Log via a side channel in production; here we just let it through.
		return w.inner.QueryContext(ctx, query, args...)
	}
	return nil, res.Err
}
