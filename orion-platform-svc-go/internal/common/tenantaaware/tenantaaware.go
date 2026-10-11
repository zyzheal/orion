// Package tenantaaware implements the ADR-011 TenantAwareDB interface
// (docs/adr/ADR-011-多租户存储隔离方案.md §3.2.2).
//
// Design intent:
//   - Interface-first: repositories depend on TenantAwareDB, not *sql.DB.
//     This is the L1 enforcement of ADR-011 §3.2.6 — the Go type system
//     prevents *Repo from directly holding *sql.DB.
//   - SharedMode implementation: wraps *sqlx.DB, tenant isolation is by
//     column filter (the current production mode).
//   - SchemaMode stub: defined but not yet wired. When a tenant is
//     configured with isolation_mode='schema', we look up its per-schema
//     *sqlx.DB from a connection pool. Not implemented here — that's
//     the S0 milestone of ADR-011.
//   - Noop implementation: for tests and feature-flag-off scenarios.
//
// Migration dependency: 720 (tenants.isolation_mode), 732 (schema_migrations).
package tenantaaware

import (
	"context"
	"database/sql"
	"errors"
)

// TenantAwareDB is the interface Repository should depend on. It routes
// SQL to the correct connection based on tenantID's isolation mode.
type TenantAwareDB interface {
	// GetConn returns the *sqlx.DB (or *sql.DB equivalent) for the given
	// tenant. Shared-mode tenants get the shared DB; schema-mode tenants
	// get their per-schema DB (lazy-loaded).
	//
	// The returned DB is a database/sql.DB-level handle; callers should
	// use it for Query, Exec, Begin, BeginTx. It is NOT safe to close —
	// ownership stays with the TenantAwareDB implementation.
	GetConn(ctx context.Context, tenantID string) (*sql.DB, error)

	// BeginTx opens a transaction on the tenant's connection. opts may
	// be nil (uses default isolation).
	BeginTx(ctx context.Context, tenantID string, opts *sql.TxOptions) (*sql.Tx, error)

	// Mode reports the isolation mode configured for the tenant.
	// Returns IsolationModeShared, IsolationModeSchema, or
	// IsolationModeUnknown.
	Mode(ctx context.Context, tenantID string) (IsolationMode, error)
}

// IsolationMode enumerates the tenant isolation strategies
// (ADR-011 §2.3 方案 D 混合).
type IsolationMode int

const (
	// IsolationModeShared: all tenants share one DB, isolated by
	// tenant_id column filter. This is the current production mode.
	IsolationModeShared IsolationMode = iota

	// IsolationModeSchema: each tenant has its own PG schema. Requires
	// schema_migrations table (migration 732) to track per-schema
	// baseline.
	IsolationModeSchema

	// IsolationModeUnknown: tenant not found or query failed. Callers
	// should treat this as an error and fail closed.
	IsolationModeUnknown
)

// String returns the string form of the isolation mode, matching the
// CHECK constraint in migration 720.
func (m IsolationMode) String() string {
	switch m {
	case IsolationModeShared:
		return "shared"
	case IsolationModeSchema:
		return "schema"
	default:
		return "unknown"
	}
}

// ErrTenantNotFound is returned by TenantAwareDB when a tenant ID does
// not resolve to any configured tenant (regardless of isolation mode).
var ErrTenantNotFound = errors.New("tenantaaware: tenant not found")

// ErrNotImplemented is returned by SchemaMode stubs that haven't been
// wired yet. Callers can distinguish with errors.Is.
var ErrNotImplemented = errors.New("tenantaaware: not implemented")

// ErrNilDB is returned when the implementation is constructed with a
// nil shared DB. Fail-fast at construction time.
var ErrNilDB = errors.New("tenantaaware: nil db")
