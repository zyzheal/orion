// Package state_repository implements the AlertBreaker state persistence
// (ADR-010 §3.2.2-3.2.5). It wraps the alert_breaker_state table
// (migration 735) and uses alertlock.WithTx for Serializable + 5s timeout
// transactions.
package state_repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
	"orion/platform-svc-go/internal/common/alertlock"
)

// ErrNoState is returned when no state row exists for the given key.
var ErrNoState = errors.New("state_repository: no state")

// Repository manages alert_breaker_state rows.
type Repository struct {
	db   *sqlx.DB
	opts alertlock.Options
}

// NewRepository constructs a state repository. opts of zero value
// falls back to alertlock.DefaultOptions() (Serializable + 5s).
func NewRepository(db *sqlx.DB, opts alertlock.Options) *Repository {
	if opts.Isolation == 0 {
		opts.Isolation = alertlock.DefaultIsolation
	}
	if opts.Timeout <= 0 {
		opts.Timeout = alertlock.DefaultTimeout
	}
	return &Repository{db: db, opts: opts}
}

// State is the public representation of a row in alert_breaker_state.
type State struct {
	ID              int64
	TenantID        string
	PolicyID        int64
	UniqueKey       string
	Count           int64
	LastFingerprint string
	WindowStart     *time.Time
	WindowEnd       *time.Time
	Version         int64
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// UpsertResult reports whether the upsert created or updated a row.
type UpsertResult struct {
	Created bool
	State   *State
}

// stateRow is the sqlx scan target. Nullable columns use pointers.
type stateRow struct {
	ID              int64      `db:"id"`
	TenantID        string     `db:"tenant_id"`
	PolicyID        int64      `db:"policy_id"`
	UniqueKey       string     `db:"unique_key"`
	Count           int64      `db:"count"`
	LastFingerprint *string    `db:"last_fingerprint"`
	WindowStart     *time.Time `db:"window_start"`
	WindowEnd       *time.Time `db:"window_end"`
	Version         int64      `db:"version"`
	CreatedAt       time.Time  `db:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at"`
}

// insertParams is the struct for NamedExec INSERT.
type insertParams struct {
	TenantID        string     `db:"tenant_id"`
	PolicyID        int64      `db:"policy_id"`
	UniqueKey       string     `db:"unique_key"`
	Count           int64      `db:"count"`
	LastFingerprint *string    `db:"last_fingerprint"`
	WindowStart     *time.Time `db:"window_start"`
	WindowEnd       *time.Time `db:"window_end"`
}

const selectStateSQL = `
	SELECT id, tenant_id, policy_id, unique_key, count, last_fingerprint,
	       window_start, window_end, version, created_at, updated_at
	  FROM alert_breaker_state
	 WHERE tenant_id = $1 AND policy_id = $2 AND unique_key = $3`

const selectStateByIDSQL = `
	SELECT id, tenant_id, policy_id, unique_key, count, last_fingerprint,
	       window_start, window_end, version, created_at, updated_at
	  FROM alert_breaker_state
	 WHERE id = $1`

// UpsertBreakerState performs the ADR-010 §3.2.2 read-check-write
// under a Serializable transaction with FOR UPDATE row lock:
//
//  1. BEGIN (Serializable, 5s timeout)
//  2. SELECT ... WHERE tenant_id, policy_id, unique_key FOR UPDATE
//  3. If exists: UPDATE count, last_fingerprint, window_*, version+1
//  4. If not exists: INSERT new row
//  5. COMMIT
func (r *Repository) UpsertBreakerState(
	ctx context.Context,
	tenantID string,
	policyID int64,
	uniqueKey string,
	newCount int64,
	lastFingerprint string,
	newWindowStart, newWindowEnd *time.Time,
) (*UpsertResult, error) {
	if r.db == nil {
		return nil, errors.New("state_repository: nil db")
	}

	var result *UpsertResult
	err := alertlock.WithTx(ctx, r.db, r.opts, func(ctx context.Context, tx *sqlx.Tx) error {
		row := &stateRow{}
		err := tx.QueryRowxContext(ctx, selectStateSQL+` FOR UPDATE`,
			tenantID, policyID, uniqueKey).StructScan(row)
		if errors.Is(err, sql.ErrNoRows) {
			// INSERT new row.
			lf := &lastFingerprint
			_, err = tx.NamedExecContext(ctx, `
				INSERT INTO alert_breaker_state
					(tenant_id, policy_id, unique_key, count, last_fingerprint,
					 window_start, window_end, version, created_at, updated_at)
				VALUES
					(:tenant_id, :policy_id, :unique_key, :count, :last_fingerprint,
					 :window_start, :window_end, 1, NOW(), NOW())`,
				insertParams{
					TenantID:        tenantID,
					PolicyID:        policyID,
					UniqueKey:       uniqueKey,
					Count:           newCount,
					LastFingerprint: lf,
					WindowStart:     newWindowStart,
					WindowEnd:       newWindowEnd,
				})
			if err != nil {
				return fmt.Errorf("insert state: %w", err)
			}
			err = tx.QueryRowxContext(ctx, selectStateSQL,
				tenantID, policyID, uniqueKey).StructScan(row)
			if err != nil {
				return fmt.Errorf("re-read inserted state: %w", err)
			}
			result = &UpsertResult{Created: true, State: stateFromRow(row)}
			return nil
		}
		if err != nil {
			return fmt.Errorf("select state FOR UPDATE: %w", err)
		}

		// UPDATE existing row, incrementing version (ADR-010 方案 C).
		_, err = tx.ExecContext(ctx, `
			UPDATE alert_breaker_state
			   SET count = $1, last_fingerprint = $2, window_start = $3,
			       window_end = $4, version = version + 1, updated_at = NOW()
			 WHERE id = $5`,
			newCount, lastFingerprint, newWindowStart, newWindowEnd, row.ID)
		if err != nil {
			return fmt.Errorf("update state: %w", err)
		}
		err = tx.QueryRowxContext(ctx, selectStateByIDSQL, row.ID).StructScan(row)
		if err != nil {
			return fmt.Errorf("re-read updated state: %w", err)
		}
		result = &UpsertResult{Created: false, State: stateFromRow(row)}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// stateFromRow converts a DB row to a public State. Nil fields become "".
func stateFromRow(r *stateRow) *State {
	lf := ""
	if r.LastFingerprint != nil {
		lf = *r.LastFingerprint
	}
	return &State{
		ID:              r.ID,
		TenantID:        r.TenantID,
		PolicyID:        r.PolicyID,
		UniqueKey:       r.UniqueKey,
		Count:           r.Count,
		LastFingerprint: lf,
		WindowStart:     r.WindowStart,
		WindowEnd:       r.WindowEnd,
		Version:         r.Version,
		CreatedAt:       r.CreatedAt,
		UpdatedAt:       r.UpdatedAt,
	}
}

// GetByUniqueKey reads the current state without taking a lock.
// Use UpsertBreakerState for writes.
func (r *Repository) GetByUniqueKey(ctx context.Context, tenantID string, policyID int64, uniqueKey string) (*State, error) {
	if r.db == nil {
		return nil, errors.New("state_repository: nil db")
	}
	row := &stateRow{}
	err := r.db.QueryRowxContext(ctx, selectStateSQL, tenantID, policyID, uniqueKey).StructScan(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNoState
	}
	if err != nil {
		return nil, fmt.Errorf("get state: %w", err)
	}
	return stateFromRow(row), nil
}

// ExpireAndCleanup removes all state rows where window_end < now.
// Returns the count of deleted rows. Runs inside a Serializable tx
// to avoid race with concurrent upserts.
func (r *Repository) ExpireAndCleanup(ctx context.Context) (int, error) {
	if r.db == nil {
		return 0, errors.New("state_repository: nil db")
	}
	n := 0
	err := alertlock.WithTx(ctx, r.db, r.opts, func(ctx context.Context, tx *sqlx.Tx) error {
		res, err := tx.ExecContext(ctx, `DELETE FROM alert_breaker_state WHERE window_end < NOW()`)
		if err != nil {
			return fmt.Errorf("cleanup: %w", err)
		}
		affected, err := res.RowsAffected()
		if err != nil {
			return fmt.Errorf("cleanup rowsAffected: %w", err)
		}
		n = int(affected)
		return nil
	})
	return n, err
}
