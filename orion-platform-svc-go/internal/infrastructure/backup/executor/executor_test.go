package executor

import (
	"context"
	"testing"
)

// fakeExecutor is a test double that satisfies Executor/BackupExecutor/
// RestoreExecutor so tests can exercise the Registry in isolation.
type fakeExecutor struct {
	dialect      Dialect
	backupResult *BackupResult
	backupErr    error
	restoreRes   *RestoreResult
	restoreErr   error
	calls        int
}

func (f *fakeExecutor) Dialect() Dialect { return f.dialect }

func (f *fakeExecutor) Backup(_ context.Context, _ ConnInfo, _ BackupOptions) (*BackupResult, error) {
	f.calls++
	return f.backupResult, f.backupErr
}

func (f *fakeExecutor) Restore(_ context.Context, _ RestoreOptions) (*RestoreResult, error) {
	f.calls++
	return f.restoreRes, f.restoreErr
}

func TestRegistry_RegistersAllShippedExecutors(t *testing.T) {
	r := NewRegistry()
	for _, d := range []Dialect{DialectPostgreSQL, DialectMySQL, DialectOceanBase} {
		if _, ok := r.BackupFor(d); !ok {
			t.Fatalf("missing backup executor for %s", d)
		}
		if _, ok := r.RestoreFor(d); !ok {
			t.Fatalf("missing restore executor for %s", d)
		}
	}
}

func TestRegistry_UnknownDialectReturnsFalse(t *testing.T) {
	r := NewRegistry()
	if _, ok := r.BackupFor(Dialect("unknown")); ok {
		t.Fatal("unknown dialect should not return an executor")
	}
	if _, ok := r.RestoreFor(Dialect("unknown")); ok {
		t.Fatal("unknown dialect should not return an executor")
	}
}

func TestRegistry_RegisterReplacesExisting(t *testing.T) {
	r := NewEmptyRegistry()
	a := &fakeExecutor{dialect: DialectMySQL, backupResult: &BackupResult{SizeBytes: 1}}
	b := &fakeExecutor{dialect: DialectMySQL, backupResult: &BackupResult{SizeBytes: 2}}
	r.Register(a)
	r.Register(b)
	got, ok := r.BackupFor(DialectMySQL)
	if !ok {
		t.Fatal("expected mysql executor to be present")
	}
	// After replacement, the executor's next call should return b's result.
	res, _ := got.Backup(context.Background(), ConnInfo{}, BackupOptions{})
	if res == nil || res.SizeBytes != 2 {
		t.Fatalf("expected replaced executor to return SizeBytes=2, got %v", res)
	}
}

func TestRegistry_RegisterNilPanics(t *testing.T) {
	r := NewEmptyRegistry()
	defer func() {
		if recover() == nil {
			t.Fatal("expected panic on nil register")
		}
	}()
	r.Register(nil)
}

// TestRegistry_SupportsRequiresBothBackupAndRestore verifies that Supports
// only returns true when the dialect has both a backup and a restore
// executor registered. fakeExecutor satisfies both interfaces, so it is
// registered as both — the negative case is covered by registering a
// backup-only fake below.
func TestRegistry_SupportsRequiresBothBackupAndRestore(t *testing.T) {
	r := NewEmptyRegistry()
	r.Register(&backupOnlyFake{d: DialectMySQL})
	if r.Supports(DialectMySQL) {
		t.Fatal("Supports should be false when only a backup executor is registered")
	}
	r.Register(&fakeExecutor{dialect: DialectMySQL})
	if !r.Supports(DialectMySQL) {
		t.Fatal("Supports should be true once both backup and restore are registered")
	}
}

// backupOnlyFake implements only BackupExecutor so tests can exercise the
// case where a dialect has a backup executor but no restore executor.
type backupOnlyFake struct{ d Dialect }

func (f *backupOnlyFake) Dialect() Dialect { return f.d }

func (f *backupOnlyFake) Backup(_ context.Context, _ ConnInfo, _ BackupOptions) (*BackupResult, error) {
	return &BackupResult{}, nil
}

func TestIsSupported(t *testing.T) {
	for _, d := range []Dialect{DialectPostgreSQL, DialectMySQL, DialectOceanBase} {
		if !IsSupported(d) {
			t.Fatalf("expected %s to be supported", d)
		}
	}
	if IsSupported(Dialect("oracle")) {
		t.Fatal("oracle should not be in shipped set")
	}
}

func TestRegistry_BackupDialectsListsAll(t *testing.T) {
	r := NewRegistry()
	dialects := r.BackupDialects()
	if len(dialects) != 3 {
		t.Fatalf("expected 3 dialects, got %d: %v", len(dialects), dialects)
	}
}
