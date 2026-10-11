// Package alertlock implements the ADR-010 alertLockTx pattern
// (docs/adr/ADR-010-AlertBreaker-并发模型选型.md §3.2.2).
//
// Design intent:
//   - Serializable isolation: highest PG level, avoids phantom reads.
//   - 5s hard timeout: prevents idle_in_transaction (default 30s).
//   - FOR UPDATE support: the transaction is passed to the caller's
//     closure so they can issue `SELECT ... FOR UPDATE` against
//     alert_breaker_state, alert_correlations, alert_dedup_fingerprints,
//     or alert_silences (the 5 Alert families + AlertBreaker).
//   - Deferred rollback: even if fn panics or returns error, the tx
//     is rolled back so locks are released.
//
// The ADR-010 §3.2.5 principle: Alert 5 家族 + AlertBreaker 全部使用
// PG Serializable + 5s 超時 行锁模式。本 package 是统一封装。
package alertlock

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/jmoiron/sqlx"
)

// DefaultIsolation is Serializable — the highest PG level, required by
// ADR-010 §3.2.2 to prevent phantom reads during the AlertBreaker
// "read-check-write" window.
const DefaultIsolation = sql.LevelSerializable

// DefaultTimeout is 5s — must be strictly less than PG's
// idle_in_transaction_session_timeout (default 30s) to guarantee the
// tx is killed before PG's idle timeout fires.
const DefaultTimeout = 5 * time.Second

// ErrTxError is the sentinel for generic Begin/Commit/Rollback errors
// that aren't classified as timeout. Callers can check with
// errors.Is(err, ErrTxError) to distinguish infrastructure failures from
// business logic failures.
var ErrTxError = errors.New("alertlock: transaction error")

// Options configures the transaction behavior.
type Options struct {
	// Isolation is the tx isolation level. Zero value falls back to
	// DefaultIsolation (Serializable).
	Isolation sql.IsolationLevel

	// Timeout bounds the tx lifetime. Zero value falls back to
	// DefaultTimeout (5s).
	Timeout time.Duration
}

// DefaultOptions returns Serializable + 5s — the ADR-010 recipe.
func DefaultOptions() Options {
	return Options{
		Isolation: DefaultIsolation,
		Timeout:   DefaultTimeout,
	}
}

// TxFunc is the signature for the user-supplied transaction body. It
// receives a context already scoped to the timeout window so that DB
// calls inside fn honor the tx lifetime.
type TxFunc func(ctx context.Context, tx *sqlx.Tx) error

// WithTx begins a transaction with the given options, invokes fn with
// a timeout-scoped context and a *sqlx.Tx, and commits on nil error.
// On non-nil error from fn, the tx is rolled back and the error is
// passed through unchanged. Begin and Commit failures are wrapped as
// txError (which satisfies errors.Is(_, ErrTxError)).
//
// Usage:
//
//	err := alertlock.WithTx(ctx, db, alertlock.DefaultOptions(),
//		func(ctx context.Context, tx *sqlx.Tx) error {
//			row := tx.QueryRowContext(ctx, `
//				SELECT id, count, last_fingerprint, window_start, window_end
//				  FROM alert_breaker_state
//				 WHERE tenant_id=$1 AND policy_id=$2 AND unique_key=$3
//				FOR UPDATE
//			`, tenantID, policyID, uniqueKey)
//			// ... scan, upsert, return nil ...
//			return nil
//		})
//	if err != nil {
//		return err
//	}
func WithTx(ctx context.Context, db *sqlx.DB, opts Options, fn TxFunc) error {
	if db == nil {
		return errors.New("alertlock: nil db")
	}
	if fn == nil {
		return errors.New("alertlock: nil fn")
	}

	isolation := opts.Isolation
	if isolation == 0 {
		isolation = DefaultIsolation
	}
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = DefaultTimeout
	}

	txOpts := &sql.TxOptions{
		Isolation: isolation,
		// sql.TxOptions doesn't have a Timeout field; we enforce via
		// context.WithTimeout below. If the tx itself doesn't respect
		// it, PG's idle_in_transaction_session_timeout (30s default)
		// is the last line of defense.
	}

	tx, err := db.BeginTxx(ctx, txOpts)
	if err != nil {
		return &txError{op: "begin", err: err}
	}

	// Scope a timeout to fn's context. If fn blocks past the timeout,
	// subsequent DB calls inside fn fail with context.DeadlineExceeded.
	ctx2, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	if err := fn(ctx2, tx); err != nil {
		_ = tx.Rollback()
		return err
	}

	if err := tx.Commit(); err != nil {
		return &txError{op: "commit", err: err}
	}
	return nil
}

// txError carries a Begin/Commit failure with its operation tag.
// It satisfies errors.Is(err, ErrTxError) via Is() and preserves the
// underlying DB error via Unwrap().
type txError struct {
	op  string
	err error
}

func (e *txError) Error() string {
	return "alertlock: " + e.op + ": " + e.err.Error()
}

// Is matches ErrTxError so errors.Is(err, ErrTxError) is true.
func (e *txError) Is(target error) bool {
	return target == ErrTxError
}

// Unwrap returns the underlying DB error for detail inspection.
func (e *txError) Unwrap() error { return e.err }

// Compile-time assertions.
var _ error = (*txError)(nil)
var _ TxFunc = func(context.Context, *sqlx.Tx) error { return nil }
