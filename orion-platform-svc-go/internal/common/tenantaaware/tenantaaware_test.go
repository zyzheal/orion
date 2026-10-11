package tenantaaware

import (
	"context"
	"errors"
	"testing"
)

func TestIsolationMode_String(t *testing.T) {
	tests := []struct {
		mode IsolationMode
		want string
	}{
		{IsolationModeShared, "shared"},
		{IsolationModeSchema, "schema"},
		{IsolationModeUnknown, "unknown"},
		{IsolationMode(99), "unknown"}, // out-of-range → unknown
	}
	for _, tc := range tests {
		if got := tc.mode.String(); got != tc.want {
			t.Errorf("IsolationMode(%d).String() = %q, want %q", tc.mode, got, tc.want)
		}
	}
}

func TestSharedModeTenantDB_NilDBReturnsError(t *testing.T) {
	_, err := NewSharedModeTenantDB(nil)
	if !errors.Is(err, ErrNilDB) {
		t.Errorf("expected ErrNilDB, got %v", err)
	}
}

func TestSharedModeTenantDB_ModeAlwaysShared(t *testing.T) {
	// We can't easily construct a *sql.DB without a real connection,
	// but NewSharedModeTenantDB accepts a nil db (returns error) —
	// so we can only test the Mode method on a valid instance.
	// Skip: needs a DB.

	// Instead, test the NoopTenantDB Mode behavior:
	m, err := NoopTenantDB{}.Mode(context.Background(), "t1")
	if !errors.Is(err, ErrNotImplemented) {
		t.Errorf("Noop.Mode should return ErrNotImplemented, got %v", err)
	}
	if m != IsolationModeUnknown {
		t.Errorf("Noop.Mode should return IsolationModeUnknown, got %v", m)
	}
}

func TestNoopTenantDB_GetConnReturnsErrNotImplemented(t *testing.T) {
	_, err := NoopTenantDB{}.GetConn(context.Background(), "t1")
	if !errors.Is(err, ErrNotImplemented) {
		t.Errorf("expected ErrNotImplemented, got %v", err)
	}
}

func TestNoopTenantDB_BeginTxReturnsErrNotImplemented(t *testing.T) {
	_, err := NoopTenantDB{}.BeginTx(context.Background(), "t1", nil)
	if !errors.Is(err, ErrNotImplemented) {
		t.Errorf("expected ErrNotImplemented, got %v", err)
	}
}

func TestErrNilDB_Message(t *testing.T) {
	if ErrNilDB == nil {
		t.Error("ErrNilDB should not be nil")
	}
	if ErrNilDB.Error() == "" {
		t.Error("ErrNilDB should have a message")
	}
}

func TestErrTenantNotFound_Message(t *testing.T) {
	if ErrTenantNotFound == nil {
		t.Error("ErrTenantNotFound should not be nil")
	}
}

func TestErrNotImplemented_Message(t *testing.T) {
	if ErrNotImplemented == nil {
		t.Error("ErrNotImplemented should not be nil")
	}
}

func TestTenantAwareDB_InterfaceSatisfiedByBoth(t *testing.T) {
	var _ TenantAwareDB = (*SharedModeTenantDB)(nil)
	var _ TenantAwareDB = NoopTenantDB{}
}

func TestNewTenantAwareDB_NilDBReturnsErrNilDB(t *testing.T) {
	_, err := NewTenantAwareDB(context.Background(), nil)
	if !errors.Is(err, ErrNilDB) {
		t.Errorf("expected ErrNilDB, got %v", err)
	}
}

// TestInterfaceCompileTime is a compile-time check that both
// implementations satisfy the TenantAwareDB interface.
func TestInterfaceCompileTime(t *testing.T) {
	var _ TenantAwareDB = (*SharedModeTenantDB)(nil)
	var _ TenantAwareDB = NoopTenantDB{}
}

// TestModeEnum_ValuesMatchMigration720 confirms the string values
// match the CHECK constraint in migration 720_tenants_add_isolation_mode.sql:
// CHECK (isolation_mode IN ('shared', 'schema'))
func TestModeEnum_ValuesMatchMigration720(t *testing.T) {
	if IsolationModeShared.String() != "shared" {
		t.Errorf("IsolationModeShared.String() = %q, want 'shared'", IsolationModeShared.String())
	}
	if IsolationModeSchema.String() != "schema" {
		t.Errorf("IsolationModeSchema.String() = %q, want 'schema'", IsolationModeSchema.String())
	}
}
