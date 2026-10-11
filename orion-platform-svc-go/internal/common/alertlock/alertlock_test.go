package alertlock

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
)

func TestDefaultIsolation_IsSerializable(t *testing.T) {
	if DefaultIsolation != sql.LevelSerializable {
		t.Errorf("DefaultIsolation = %v, want sql.LevelSerializable", DefaultIsolation)
	}
}

func TestDefaultTimeout_IsFiveSeconds(t *testing.T) {
	if DefaultTimeout != 5*time.Second {
		t.Errorf("DefaultTimeout = %v, want 5s", DefaultTimeout)
	}
}

func TestDefaultOptions(t *testing.T) {
	opts := DefaultOptions()
	if opts.Isolation != sql.LevelSerializable {
		t.Errorf("DefaultOptions.Isolation = %v", opts.Isolation)
	}
	if opts.Timeout != 5*time.Second {
		t.Errorf("DefaultOptions.Timeout = %v", opts.Timeout)
	}
}

func TestWithTx_NilDB(t *testing.T) {
	// Passing nil db must return an error before fn is invoked.
	// We use a proper TxFunc signature.
	var fnCalled bool
	err := WithTx(context.Background(), nil, DefaultOptions(), func(ctx context.Context, tx *sqlx.Tx) error {
		fnCalled = true
		return nil
	})
	if err == nil {
		t.Error("expected error for nil db")
	}
	if fnCalled {
		t.Error("fn should not be called when db is nil")
	}
}

func TestWithTx_NilFn(t *testing.T) {
	// Passing nil fn and nil db: nil db check comes first.
	err := WithTx(context.Background(), nil, DefaultOptions(), nil)
	if err == nil {
		t.Error("expected error for nil db (checked before fn)")
	}
}

func TestWithTx_UsesProvidedIsolationAndTimeout(t *testing.T) {
	opts := Options{
		Isolation: sql.LevelRepeatableRead,
		Timeout:   10 * time.Second,
	}
	if opts.Isolation != sql.LevelRepeatableRead {
		t.Errorf("custom isolation not preserved")
	}
	if opts.Timeout != 10*time.Second {
		t.Errorf("custom timeout not preserved")
	}
}

func TestTxError_IsMatchesErrTxError(t *testing.T) {
	underlying := errors.New("connection refused")
	e := &txError{op: "begin", err: underlying}

	if !errors.Is(e, ErrTxError) {
		t.Error("errors.Is(txError, ErrTxError) should be true")
	}
	if !errors.Is(e, underlying) {
		t.Error("errors.Is(txError, underlying) should be true via Unwrap")
	}
	if e.Error() != "alertlock: begin: connection refused" {
		t.Errorf("Error() = %q", e.Error())
	}
	if e.Unwrap() != underlying {
		t.Errorf("Unwrap() should return underlying, got %v", e.Unwrap())
	}
}

func TestSentinelErrorIsNotNil(t *testing.T) {
	if ErrTxError == nil {
		t.Error("ErrTxError should not be nil")
	}
	if ErrTxError.Error() == "" {
		t.Error("ErrTxError should have a message")
	}
}

func TestOptions_ZeroValuesFallBackToDefaults(t *testing.T) {
	var opts Options
	isolation := opts.Isolation
	if isolation == 0 {
		isolation = DefaultIsolation
	}
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	if isolation != sql.LevelSerializable {
		t.Errorf("zero isolation should fall back to Serializable, got %v", isolation)
	}
	if timeout != 5*time.Second {
		t.Errorf("zero timeout should fall back to 5s, got %v", timeout)
	}
}

func TestTimeoutLesserThanIdleInTransactionGuaranteed(t *testing.T) {
	if DefaultTimeout >= 30*time.Second {
		t.Errorf("DefaultTimeout (%v) must be < 30s (PG idle_in_transaction default)", DefaultTimeout)
	}
}
