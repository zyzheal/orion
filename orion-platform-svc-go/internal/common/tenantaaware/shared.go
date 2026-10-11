// SharedModeTenantDB is the current production implementation of
// TenantAwareDB. All tenants share one database; isolation is by
// tenant_id column filter applied at the SQL level (by the caller).
//
// This is a thin wrapper around *sql.DB that satisfies the
// TenantAwareDB interface without changing behavior — repositories can
// migrate to the interface incrementally without a runtime change.
package tenantaaware

import (
	"context"
	"database/sql"
)

// SharedModeTenantDB wraps a single *sql.DB for all tenants.
type SharedModeTenantDB struct {
	db *sql.DB
}

// Compile-time assertion.
var _ TenantAwareDB = (*SharedModeTenantDB)(nil)

// NewSharedModeTenantDB constructs a shared-mode DB wrapper. db must
// not be nil; returns ErrNilDB if it is.
func NewSharedModeTenantDB(db *sql.DB) (*SharedModeTenantDB, error) {
	if db == nil {
		return nil, ErrNilDB
	}
	return &SharedModeTenantDB{db: db}, nil
}

// GetConn returns the shared DB. It does not consult the tenants table
// because all tenants share the same connection. This is the L1
// enforcement of ADR-011 §3.2.6 — the *Repo type holds
// *SharedModeTenantDB, not *sql.DB directly.
func (d *SharedModeTenantDB) GetConn(_ context.Context, _ string) (*sql.DB, error) {
	return d.db, nil
}

// BeginTx opens a transaction on the shared DB. opts may be nil.
func (d *SharedModeTenantDB) BeginTx(ctx context.Context, _ string, opts *sql.TxOptions) (*sql.Tx, error) {
	return d.db.BeginTx(ctx, opts)
}

// Mode always returns IsolationModeShared (the current production mode).
func (d *SharedModeTenantDB) Mode(_ context.Context, _ string) (IsolationMode, error) {
	return IsolationModeShared, nil
}

// DB returns the underlying *sql.DB. Use this only in tests or
// bootstrap code — normal callers should use GetConn.
func (d *SharedModeTenantDB) DB() *sql.DB {
	return d.db
}
