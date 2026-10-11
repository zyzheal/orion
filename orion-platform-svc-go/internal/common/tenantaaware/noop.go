// NoopTenantDB is a test-only / feature-flag-off implementation of
// TenantAwareDB. All methods return zero values or ErrNotImplemented.
package tenantaaware

import (
	"context"
	"database/sql"
)

// NoopTenantDB is the zero-value-safe TenantAwareDB for tests.
type NoopTenantDB struct{}

var _ TenantAwareDB = NoopTenantDB{}

// GetConn on NoopTenantDB always returns ErrNotImplemented.
func (NoopTenantDB) GetConn(_ context.Context, _ string) (*sql.DB, error) {
	return nil, ErrNotImplemented
}

// BeginTx on NoopTenantDB always returns ErrNotImplemented.
func (NoopTenantDB) BeginTx(_ context.Context, _ string, _ *sql.TxOptions) (*sql.Tx, error) {
	return nil, ErrNotImplemented
}

// Mode on NoopTenantDB returns IsolationModeUnknown (fail-closed).
func (NoopTenantDB) Mode(_ context.Context, _ string) (IsolationMode, error) {
	return IsolationModeUnknown, ErrNotImplemented
}
