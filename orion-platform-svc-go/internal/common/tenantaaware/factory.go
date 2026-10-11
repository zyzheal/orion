// NewTenantAwareDB is the factory used at wiring time. It reads the
// ADR-011 tenants.isolation_mode column (migration 720) to decide
// which implementation to return.
//
// Current behavior (S0 milestone): always returns SharedModeTenantDB,
// regardless of tenant config. SchemaMode is a no-op for now — its
// full implementation requires the schema_migrations table (732) to
// be wired into the connection pool lifecycle.
//
// The factory exists so that repositories can depend on TenantAwareDB
// (the interface) today, and pick up SchemaMode support in a future
// release without touching their code.
package tenantaaware

import (
	"context"
	"database/sql"
)

// NewTenantAwareDB constructs a TenantAwareDB. Returns SharedMode by
// default. err is nil unless db is nil.
func NewTenantAwareDB(ctx context.Context, db *sql.DB) (TenantAwareDB, error) {
	_ = ctx // reserved for future tracing hooks
	if db == nil {
		return nil, ErrNilDB
	}
	// S0 milestone: always shared mode. Schema mode is a future S1
	// milestone that requires wiring schema_migrations (732).
	return NewSharedModeTenantDB(db)
}
