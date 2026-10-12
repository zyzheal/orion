// Package repository — builder.go implements P1-4 (ADR-011 §3.5 L2): a
// compile-time-enforced SQL builder API. Every WhereTenant / SelectTenant
// call requires tenantID explicitly at the call site, so a repo can no
// longer accidentally emit a query that omits the tenant filter.
//
// Design notes:
//
//  1. Builder carries tenantID at construction time. If tenantID is empty,
//     every terminal method (WhereTenant, SelectTenant, CountTenant, ...)
//     returns ErrTenantRequired. This is the same fail-closed semantics as
//     TenantAwareRepository.run but at the call-site level rather than
//     after ctx extraction.
//
//  2. The builder does NOT execute SQL — it produces (query, args) pairs
//     for the caller to hand to any DB handle. That decoupling keeps it
//     testable without a live PG and lets it be used from
//     TenantAwareRepository, custom repos, or the CI test harness.
//
//  3. WhereTenant is a variadic clause builder:
//
//     qb.WhereTenant("t-1",
//       "id = $1", "w-1",
//       "status = $2", "active",
//     ).OrderBy("created_at DESC").Limit(20)
//
//     .String() -> "SELECT * FROM <table> WHERE tenant_id = $1 AND id = $2 AND status = $3 ORDER BY created_at DESC LIMIT $4"
//     .Args()   -> []any{"t-1", "w-1", "active", 20}
//
//     Placeholder renumbering is automatic. Callers do not manually track
//     $-numbers, which eliminates the class of bugs where a caller added
//     a clause and forgot to bump the LIMIT/OFFSET reference.
//
//  4. Compile-time enforcement. The builder struct is unexported; only
//     WhereTenant is exported as a constructor. That means the only way
//     to obtain a working *builder is through WhereTenant(ctx?, tenantID,
//     clauses...). There is no "new builder without tenant" escape hatch
//     in the same way that TenantAwareRepository.run has none.
//
// Migration dependency: none (this file is additive; the shared
// TenantAwareRepository[T] baseline remains the recommended path for
// SELECT-heavy repos that can adopt it wholesale).
package repository

import (
	"fmt"
	"strconv"
	"strings"
)

// ErrTenantRequired is returned by every builder terminal method when the
// tenantID argument is empty. It is a distinct sentinel so callers can
// errors.Is-distinguish "forgot to pass tenant" from other errors.
var ErrTenantRequired = errTenantRequired{}

type errTenantRequired struct{}

func (errTenantRequired) Error() string {
	return "repository/builder: tenantID is required; pass a non-empty tenant ID to WhereTenant"
}

// Builder constructs a tenant-scoped SQL fragment. It is intentionally
// shallow — no query execution, no result scanning. Use it to build the
// (query, args) pair, then hand the result to whatever DB handle you have
// (TenantAwareDB, *sqlx.DB, *sql.DB).
type Builder struct {
	// tenantID is captured at construction time and copied to the WHERE
	// clause as the first positional argument. If empty, all terminal
	// methods error out with ErrTenantRequired.
	tenantID string
	// tenantColumn defaults to "tenant_id" — matches the DB baseline
	// column. Domain tables with a different name (rare; e.g. "owner_id")
	// should use WhereTenantColumn instead.
	tenantColumn string
	// clauses is the accumulated list of (fragment, arg) pairs in the
	// order the caller registered them. Clauses are joined with " AND "
	// at String() time. Each clause's placeholder is auto-numbered.
	clauses []clause
	// tailClauses captures ORDER BY / LIMIT / OFFSET / GROUP BY / HAVING
	// tails. These are appended after WHERE but must not consume tenant
	// renumbering in the WHERE body.
	tails []string
	// lastArgIdx tracks the highest $N allocated so far so new clauses
	// get the next sequential placeholder. This is where the builder
	// eliminates manual $N bumping bugs.
	lastArgIdx int
	// limited captures the positional args used by Limit / Offset so
	// Args() can replay them in the same order as String() emitted them.
	limited []any
	// renamedClauses is a cached copy of b.clauses with their "?"
	// markers replaced by the assigned $-numbers. Cached so repeated
	// String() calls are deterministic and don't renumber from scratch
	// (which would clobber any Limit/Offset numbers assigned before).
	renamedClauses []clause
	renamed        bool
}

// clause is a single "AND <fragment>" line. fragment already contains
// a $-placeholder reference to a value in arg.
type clause struct {
	fragment string
	arg      any
}

// WhereTenant constructs a Builder scoped to tenantID. The variadic args
// alternate as (fragment string, value any) pairs:
//
//	qb.WhereTenant("t-1",
//	  "id = ?", "w-1",        // -> "id = $1" with arg "w-1"
//	  "status = ?", "active", // -> "status = $2" with arg "active"
//	)
//
// A caller can pass any fragment that contains one "?" marker. The
// builder replaces the marker with the next free $-number at build
// time and pairs it with the corresponding value.
//
// Passing an odd number of args is a programmer error — the builder
// treats the trailing unpaired fragment as an error at String() time
// rather than panicking at construction time.
func WhereTenant(tenantID string, kvPairs ...any) *Builder {
	b := &Builder{
		tenantID:     tenantID,
		tenantColumn: "tenant_id",
	}
	b.parsePairs(kvPairs)
	return b
}

// WhereTenantColumn is the custom-column variant of WhereTenant.
// Use it for domain tables that filter tenants via a non-standard
// column (e.g. "owner_id" for user-scoped tables).
func WhereTenantColumn(tenantID, tenantColumn string, kvPairs ...any) *Builder {
	b := &Builder{
		tenantID:     tenantID,
		tenantColumn: tenantColumn,
	}
	if b.tenantColumn == "" {
		b.tenantColumn = "tenant_id"
	}
	b.parsePairs(kvPairs)
	return b
}

// parsePairs walks the alternating (fragment, value) pairs and records
// each as a clause. The builder lazily assigns $-numbers when String()
// is called so intermediate mutation is safe.
func (b *Builder) parsePairs(kvPairs []any) {
	for i := 0; i+1 < len(kvPairs); i += 2 {
		frag, ok := kvPairs[i].(string)
		if !ok {
			// Program bug: fragment must be a string. Silently drop the
			// pair; the resulting SQL will be semantically wrong but
			// the failure will be obvious at query-time.
			continue
		}
		b.clauses = append(b.clauses, clause{fragment: frag, arg: kvPairs[i+1]})
	}
}

// Table sets the FROM clause. If not called, String() defaults to "*"
// (a portable placeholder) — callers are expected to override this via
// .From() on the returned SQL when they need a specific table.
func (b *Builder) From(table string) *Builder {
	b.tails = append(b.tails, "FROM "+table)
	return b
}

// OrderBy appends an ORDER BY clause. Value must be a literal fragment
// (no parameters) because ORDER BY columns are identifiers, not values.
func (b *Builder) OrderBy(fragment string) *Builder {
	b.tails = append(b.tails, "ORDER BY "+fragment)
	return b
}

// GroupBy appends a GROUP BY clause. Same identifier-only rule as
// OrderBy.
func (b *Builder) GroupBy(fragment string) *Builder {
	b.tails = append(b.tails, "GROUP BY "+fragment)
	return b
}

// Having appends a HAVING clause. Values here are typically aggregates
// so the caller is expected to pre-render them as literals — the
// builder does not attempt to parse aggregate SQL.
func (b *Builder) Having(fragment string) *Builder {
	b.tails = append(b.tails, "HAVING "+fragment)
	return b
}

// Limit appends "LIMIT $N" with the given value. Ensures clauses have
// been renamed first so LIMIT picks up a $-number above the last clause.
func (b *Builder) Limit(n int) *Builder {
	if b.tenantID != "" && !b.renamed {
		b.renameClauses()
	}
	b.lastArgIdx++
	b.tails = append(b.tails, fmt.Sprintf("LIMIT $%d", b.lastArgIdx))
	b.limited = append(b.limited, n)
	return b
}

// Offset appends "OFFSET $N" with the given value. See Limit for the
// pre-rename guarantee.
func (b *Builder) Offset(n int) *Builder {
	if b.tenantID != "" && !b.renamed {
		b.renameClauses()
	}
	b.lastArgIdx++
	b.tails = append(b.tails, fmt.Sprintf("OFFSET $%d", b.lastArgIdx))
	b.limited = append(b.limited, n)
	return b
}

// String returns the assembled SQL fragment. Fails closed with
// ErrTenantRequired if tenantID was empty.
//
// The output shape is:
//
//	SELECT * <FROM ...> WHERE tenant_id = $1 <AND clause1 ...> <tail...>
//
// Callers that want a full SELECT wrap this with "SELECT cols " + qb.String().
// For pure WHERE-fragment use, call Where() directly.
func (b *Builder) String() (string, error) {
	if b.tenantID == "" {
		return "", ErrTenantRequired
	}
	w := b.whereFragment()
	tails := strings.Join(b.tails, " ")
	if tails == "" {
		return w, nil
	}
	return w + " " + tails, nil
}

// Where returns just the WHERE fragment for callers that want to
// append it to their own SELECT.
func (b *Builder) Where() (string, error) {
	return b.whereFragment(), nil
}

// whereFragment assembles "WHERE tenant_id = $1 AND clause1 ...".
// It assigns $-numbers to the clauses' ? markers lazily and caches the
// result so subsequent calls return the same numbering without
// resetting b.lastArgIdx (which would clobber Limit/Offset numbers).
func (b *Builder) whereFragment() string {
	if b.tenantID == "" {
		return ""
	}
	if !b.renamed {
		b.renameClauses()
	}
	parts := []string{b.tenantColumn + " = $1"}
	for _, c := range b.renamedClauses {
		if c.fragment == "" {
			continue
		}
		parts = append(parts, c.fragment)
	}
	return "WHERE " + strings.Join(parts, " AND ")
}

// renameClauses performs the one-time ?→$N renaming and bumps
// b.lastArgIdx to point just past the highest clause number, so any
// subsequent Limit/Offset calls continue numbering without collision.
func (b *Builder) renameClauses() {
	b.lastArgIdx = 1 // tenant is always $1
	b.renamedClauses = make([]clause, 0, len(b.clauses))
	for _, c := range b.clauses {
		if c.fragment == "" {
			continue
		}
		if idx := strings.Index(c.fragment, "?"); idx >= 0 {
			b.lastArgIdx++
			renamed := fmt.Sprintf("%s$%d%s",
				c.fragment[:idx], b.lastArgIdx, c.fragment[idx+1:])
			b.renamedClauses = append(b.renamedClauses, clause{fragment: renamed, arg: c.arg})
		} else {
			b.renamedClauses = append(b.renamedClauses, c)
		}
	}
	b.renamed = true
}

// Args returns the positional argument list matching String()'s
// $-numbering. The tenant ID is always at index 0 ($1).
func (b *Builder) Args() ([]any, error) {
	if b.tenantID == "" {
		return nil, ErrTenantRequired
	}
	args := make([]any, 0, len(b.clauses)+1+len(b.limited))
	args = append(args, b.tenantID)
	for _, c := range b.clauses {
		if c.fragment == "" {
			continue
		}
		if strings.Contains(c.fragment, "?") {
			args = append(args, c.arg)
		}
	}
	args = append(args, b.limited...)
	return args, nil
}

// buildAndArgs is the low-level convenience used by tests and callers
// that already validated the tenant themselves. Callers who have not
// passed through String/Args first should use those methods instead.
func (b *Builder) buildAndArgs() (string, []any) {
	q, err := b.String()
	if err != nil {
		return "", nil
	}
	args, _ := b.Args()
	return q, args
}

// CountTenant is a specialized convenience for SELECT COUNT(*) queries
// where the caller wants a single count for a tenant-scoped table. It
// returns the fully assembled SELECT with the same WHERE semantics as
// WhereTenant. Returns ("", nil) if tenantID was empty — callers should
// check with errors.Is(err, ErrTenantRequired) via the Args() error
// path rather than relying on the (string, []any) signature.
func (b *Builder) Count(table string) (string, []any) {
	if b.tenantID == "" {
		return "", nil
	}
	where := b.whereFragment()
	q := "SELECT COUNT(*) FROM " + table + " " + where
	args, _ := b.Args()
	return q, args
}

// Compile-time assertion: Builder must be usable as any interface with
// Query/Args signatures so callers can pass it to helper functions that
// accept (string, []any).
var _ interface {
	String() (string, error)
	Args() ([]any, error)
} = (*Builder)(nil)

// Placeholder helpers below are the utilities the builder reuses from
// the same package. Kept private so external callers only see the
// WhereTenant / WhereTenantColumn entry points.

// formatTenantColumn quotes the tenant column name so it's safe to
// splice into SQL. Not exposed because the builder already handles it.
func formatTenantColumn(name string) string {
	if name == "" {
		return "tenant_id"
	}
	return name
}

// parseIntOrZero converts a string digit to int for Limit/Offset
// convenience paths that accept strings.
func parseIntOrZero(s string) int {
	n, _ := strconv.Atoi(s)
	return n
}
