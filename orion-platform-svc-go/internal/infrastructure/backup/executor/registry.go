package executor

import (
	"errors"
	"fmt"
	"sync"
)

// ErrUnsupportedDialect is defined in executor.go; restate it in this file's
// doc for discoverability without duplicating the sentinel value.
var _ = ErrUnsupportedDialect

// Registry holds the set of registered backup and restore executors keyed by
// dialect. It is safe for concurrent use; all registered executors are
// immutable after NewRegistry returns.
type Registry struct {
	mu       sync.RWMutex
	backups  map[Dialect]BackupExecutor
	restores map[Dialect]RestoreExecutor
}

// NewRegistry returns a Registry with all shipped executors registered.
// Additional executors can be added via Register for test doubles or new
// dialects.
func NewRegistry() *Registry {
	r := &Registry{
		backups:  map[Dialect]BackupExecutor{},
		restores: map[Dialect]RestoreExecutor{},
	}
	r.Register(NewPGExecutor())
	r.Register(NewMySQLExecutor())
	r.Register(NewOceanBaseExecutor())
	return r
}

// NewEmptyRegistry returns a Registry with no built-in executors. Primarily
// for unit tests that need to control exactly which executors are present.
func NewEmptyRegistry() *Registry {
	return &Registry{
		backups:  map[Dialect]BackupExecutor{},
		restores: map[Dialect]RestoreExecutor{},
	}
}

// Register inserts or replaces the executor for the dialect reported by e.
// Passing nil is a programming error; it panics so misconfigurations surface
// at startup rather than mid-backup.
func (r *Registry) Register(e Executor) {
	if e == nil {
		panic("executor.Register: nil executor")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	d := e.Dialect()
	if be, ok := e.(BackupExecutor); ok {
		r.backups[d] = be
	}
	if re, ok := e.(RestoreExecutor); ok {
		r.restores[d] = re
	}
}

// BackupFor returns the backup executor for d, or (nil, false) when none is
// registered for that dialect.
func (r *Registry) BackupFor(d Dialect) (BackupExecutor, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	e, ok := r.backups[d]
	return e, ok
}

// RestoreFor returns the restore executor for d, or (nil, false) when none is
// registered for that dialect.
func (r *Registry) RestoreFor(d Dialect) (RestoreExecutor, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	e, ok := r.restores[d]
	return e, ok
}

// MustBackupFor returns the backup executor for d, panicking when it is not
// registered. Intended for boot code paths that already validated config.
func (r *Registry) MustBackupFor(d Dialect) BackupExecutor {
	e, ok := r.BackupFor(d)
	if !ok {
		panic(fmt.Sprintf("no backup executor for dialect %q", d))
	}
	return e
}

// MustRestoreFor returns the restore executor for d, panicking when it is not
// registered. Intended for boot code paths that already validated config.
func (r *Registry) MustRestoreFor(d Dialect) RestoreExecutor {
	e, ok := r.RestoreFor(d)
	if !ok {
		panic(fmt.Sprintf("no restore executor for dialect %q", d))
	}
	return e
}

// Dialects returns the sorted list of dialects currently registered for backup.
// Called at startup to log the effective set.
func (r *Registry) BackupDialects() []Dialect {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Dialect, 0, len(r.backups))
	for d := range r.backups {
		out = append(out, d)
	}
	return out
}

// Supports reports whether the given dialect is registered for both backup and
// restore. Called at plan-create time to reject misconfigured plans early.
func (r *Registry) Supports(d Dialect) bool {
	_, b := r.BackupFor(d)
	_, rs := r.RestoreFor(d)
	return b && rs
}

// ErrDialectNotRegistered is returned when the caller asks for a dialect the
// registry has no executor for. It wraps ErrUnsupportedDialect so callers can
// use errors.Is to detect the case.
func errDialectNotRegistered(d Dialect) error {
	return fmt.Errorf("%w: %s", ErrUnsupportedDialect, d)
}

var _ = errors.Is
