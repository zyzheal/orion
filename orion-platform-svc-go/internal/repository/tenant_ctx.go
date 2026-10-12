// Package repository provides the TenantAwareRepository baseline from ADR-011.
//
// ADR-011 L1 requirement (docs/adr/ADR-011-多租户存储隔离方案.md §3.5):
// "Repository 禁止直接持有 *sql.DB（改为持有 TenantAwareDB）" +
// "SQL 必须经 builder.WhereTenant(ctx, query) 包装"。
//
// This file contributes the tenant-ID carrier that flows through context so
// TenantAwareRepository[T].Query/Exec can extract tenantID and inject
// "WHERE tenant_id = ?" without leaking the raw *sql.DB to callers.
package repository

import "context"

type tenantKey struct{}

// WithTenant returns a child context that carries tenantID. Every
// TenantAwareRepository call requires this to be present, otherwise the call
// fails closed with ErrTenantMissing.
func WithTenant(ctx context.Context, tenantID string) context.Context {
	return context.WithValue(ctx, tenantKey{}, tenantID)
}

// TenantFromContext extracts tenantID from ctx. The second return is false if
// the key is absent or the stored value is not a string. The repository does
// not coerce non-string values; callers must use WithTenant, not raw
// WithValue.
func TenantFromContext(ctx context.Context) (string, bool) {
	if ctx == nil {
		return "", false
	}
	v, ok := ctx.Value(tenantKey{}).(string)
	return v, ok && v != ""
}
