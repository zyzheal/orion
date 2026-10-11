// Package querybuilder implements the ADR-011 §3.2.6 L2 runtime helpers
// (docs/adr/ADR-011-多租户存储隔离方案.md).
//
// Provides:
//
//   1. Build-time helpers (Builder) that compose tenant-scoped SQL WHERE
//      clauses without hand-rolling tenant_id injection. Build-time
//      errors are returned (not panicked) so callers can bail cleanly.
//
//   2. Static-scanning helpers (ScanSource, Violation patterns) that
//      CI can invoke to detect raw r.db.Query* calls in Go source files.
//      Full linter integration lives in
//      docs/design-constraints/framework/detectors/tenant-sql-builder.ts
//      — this package provides the shared detection logic.
//
// Not a full ORM: it composes string fragments + argument lists. SQL
// composition stays with the caller.
package querybuilder

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

// ErrMissingTenantFilter is returned when BuildWhere produces a WHERE
// clause that has no tenant_id condition.
var ErrMissingTenantFilter = errors.New("querybuilder: missing tenant_id filter")

// ErrNilBuilder is returned when a method is called on a nil *Builder.
var ErrNilBuilder = errors.New("querybuilder: nil builder")

// TenantFromContextKey is the context key for carrying tenant ID.
type TenantFromContextKey struct{}

// TenantFromContext reads the tenant ID from ctx. Returns "" if not set.
func TenantFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if v, ok := ctx.Value(TenantFromContextKey{}).(string); ok {
		return v
	}
	return ""
}

// WithTenantContext returns a new ctx carrying the given tenantID.
func WithTenantContext(ctx context.Context, tenantID string) context.Context {
	return context.WithValue(ctx, TenantFromContextKey{}, tenantID)
}

// Builder composes SQL WHERE clauses with a mandatory tenant_id filter.
// Methods are chainable. Each request should have its own Builder.
type Builder struct {
	table   string
	conds   []string
	args    []any
	argIdx  int
	limit   *int
	offset  *int
	orderBy []string
}

// New returns an empty Builder for the given table. Nil if table is empty.
func New(table string) *Builder {
	if strings.TrimSpace(table) == "" {
		return nil
	}
	return &Builder{table: table, argIdx: 1}
}

// WithTenant appends a tenant_id = $N filter using the tenant ID
// from ctx. Returns error if the tenant ID is missing — the caller
// decides whether to log and continue or abort the request.
func (b *Builder) WithTenant(ctx context.Context) (*Builder, error) {
	if b == nil {
		return nil, ErrNilBuilder
	}
	tid := TenantFromContext(ctx)
	if tid == "" {
		return b, ErrMissingTenantFilter
	}
	b.conds = append(b.conds, fmt.Sprintf("tenant_id = $%d", b.argIdx))
	b.args = append(b.args, tid)
	b.argIdx++
	return b, nil
}

// Where appends a "column op value" condition. Supported ops: =, !=, <>,
// <, <=, >, >=. Args are $N-indexed in insertion order.
func (b *Builder) Where(col, op string, val any) (*Builder, error) {
	if b == nil {
		return nil, ErrNilBuilder
	}
	if !validOp(op) {
		return b, fmt.Errorf("querybuilder: unknown op %q", op)
	}
	b.conds = append(b.conds, fmt.Sprintf("%s %s $%d", col, op, b.argIdx))
	b.args = append(b.args, val)
	b.argIdx++
	return b, nil
}

// WhereIn appends an IN clause with N arguments. Errors on empty vals.
func (b *Builder) WhereIn(col string, vals []any) (*Builder, error) {
	if b == nil {
		return nil, ErrNilBuilder
	}
	if len(vals) == 0 {
		return b, errors.New("querybuilder: WhereIn with empty vals")
	}
	placeholders := make([]string, len(vals))
	for i, v := range vals {
		placeholders[i] = fmt.Sprintf("$%d", b.argIdx+i)
		b.args = append(b.args, v)
	}
	b.conds = append(b.conds, fmt.Sprintf("%s IN (%s)", col, strings.Join(placeholders, ", ")))
	b.argIdx += len(vals)
	return b, nil
}

// OrderBy appends an ORDER BY column (multiple calls append).
func (b *Builder) OrderBy(column string) *Builder {
	if b == nil {
		return b
	}
	b.orderBy = append(b.orderBy, column)
	return b
}

// Limit sets a row limit. Negative values are ignored.
func (b *Builder) Limit(n int) *Builder {
	if b == nil || n < 0 {
		return b
	}
	v := n
	b.limit = &v
	return b
}

// Offset sets an offset. Negative values are ignored.
func (b *Builder) Offset(n int) *Builder {
	if b == nil || n < 0 {
		return b
	}
	v := n
	b.offset = &v
	return b
}

// BuildWhere returns the WHERE clause + args, or an error if no
// tenant_id filter has been added.
func (b *Builder) BuildWhere() (string, []any, error) {
	if b == nil {
		return "", nil, ErrNilBuilder
	}
	if len(b.conds) == 0 {
		return "", nil, ErrMissingTenantFilter
	}
	if !hasTenantFilter(b.conds) {
		return "", nil, ErrMissingTenantFilter
	}
	return "WHERE " + strings.Join(b.conds, " AND "), b.args, nil
}

// BuildSelect returns "SELECT * FROM table WHERE ... ORDER BY ...
// [LIMIT n] [OFFSET n]" plus args.
func (b *Builder) BuildSelect() (string, []any, error) {
	if b == nil {
		return "", nil, ErrNilBuilder
	}
	where, args, err := b.BuildWhere()
	if err != nil {
		return "", nil, err
	}
	q := "SELECT * FROM " + b.table + " " + where
	if len(b.orderBy) > 0 {
		q += " ORDER BY " + strings.Join(b.orderBy, ", ")
	}
	if b.limit != nil {
		q += " LIMIT " + fmt.Sprintf("%d", *b.limit)
	}
	if b.offset != nil {
		q += " OFFSET " + fmt.Sprintf("%d", *b.offset)
	}
	return q, args, nil
}

// Args returns a copy of the accumulated args.
func (b *Builder) Args() []any {
	if b == nil {
		return nil
	}
	out := make([]any, len(b.args))
	copy(out, b.args)
	return out
}

// ArgsLen returns the number of args accumulated.
func (b *Builder) ArgsLen() int {
	if b == nil {
		return 0
	}
	return len(b.args)
}

// Table returns the table name this builder is composing queries for.
func (b *Builder) Table() string {
	if b == nil {
		return ""
	}
	return b.table
}

// hasTenantFilter reports whether any condition references tenant_id.
func hasTenantFilter(conds []string) bool {
	for _, c := range conds {
		if strings.HasPrefix(c, "tenant_id ") {
			return true
		}
	}
	return false
}

// validOp reports whether op is one of the supported comparison operators.
func validOp(op string) bool {
	switch op {
	case "=", "!=", "<>", "<", "<=", ">", ">=":
		return true
	}
	return false
}
