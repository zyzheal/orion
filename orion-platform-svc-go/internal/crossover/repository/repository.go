package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ---------------------------------------------------------------------------
// Repository — SQL-backed persistence for crossover call records
// ---------------------------------------------------------------------------

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// table name constant
const tableCalls = "crossover_calls"

// ===========================================================================
// CallRecord CRUD
// ===========================================================================

// CreateCall inserts a new CallRecord and populates its auto-generated ID.
func (r *Repository) CreateCall(ctx context.Context, call *CallRecord) error {
	var id string
	err := r.db.QueryRowContext(ctx,
		fmt.Sprintf(`INSERT INTO %s (id, tenant_id, source_domain, target_domain, method, payload, response, status, duration_ms, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`, tableCalls),
		call.ID, call.TenantID, call.SourceDomain, call.TargetDomain, call.Method,
		encodeJSONB(call.Payload), encodeJSONB(call.Response),
		call.Status, call.Duration, call.CreatedAt, call.UpdatedAt,
	).Scan(&id)
	if err != nil {
		return err
	}
	call.ID = id
	return nil
}

// GetCall retrieves a single CallRecord by ID, scoped by tenant.
func (r *Repository) GetCall(ctx context.Context, tenantID string, id uuid.UUID) (*CallRecord, error) {
	var c CallRecord
	err := r.db.GetContext(ctx, &c,
		fmt.Sprintf(`SELECT * FROM %s WHERE id=$1 AND tenant_id=$2`, tableCalls),
		id.String(), tenantID,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &c, nil
}

// ListCalls returns CallRecords filtered by CallFilter with pagination.
func (r *Repository) ListCalls(ctx context.Context, filter CallFilter) ([]CallRecord, error) {
	where, args := buildCallFilterClause(filter)
	query := fmt.Sprintf(`SELECT * FROM %s %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		tableCalls, where, len(args)+1, len(args)+2)
	var items []CallRecord
	err := r.db.SelectContext(ctx, &items, query,
		append(args, filter.DefaultLimit(), filter.Offset)...,
	)
	return items, err
}

// UpdateStatus updates the Status and UpdatedAt for a CallRecord.
func (r *Repository) UpdateStatus(ctx context.Context, tenantID string, id uuid.UUID, status string) error {
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE %s SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`, tableCalls),
		status, time.Now().UTC(), id.String(), tenantID,
	)
	return err
}

// UpdateCall updates the full CallRecord (use UpdateStatus for status-only).
func (r *Repository) UpdateCall(ctx context.Context, tenantID string, call *CallRecord) error {
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE %s SET source_domain=$1, target_domain=$2, method=$3, payload=$4, response=$5, status=$6, duration_ms=$7, updated_at=$8
		 WHERE id=$9 AND tenant_id=$10`, tableCalls),
		call.SourceDomain, call.TargetDomain, call.Method,
		encodeJSONB(call.Payload), encodeJSONB(call.Response),
		call.Status, call.Duration, call.UpdatedAt, call.ID, tenantID,
	)
	return err
}

// DeleteCall soft-deletes a CallRecord by ID, scoped by tenant.
func (r *Repository) DeleteCall(ctx context.Context, tenantID string, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`DELETE FROM %s WHERE id=$1 AND tenant_id=$2`, tableCalls),
		id.String(), tenantID,
	)
	return err
}

// ===========================================================================
// Statistics
// ===========================================================================

// GetCallStats returns aggregated statistics for calls within a time window.
func (r *Repository) GetCallStats(ctx context.Context, tenantID string, startTime, endTime time.Time) (*CallStats, error) {
	// Core aggregates
	where := fmt.Sprintf("tenant_id=$1 AND created_at >= $2 AND created_at <= $3")
	args := []any{tenantID, startTime, endTime}

	var stats CallStats

	// Total
	err := r.db.QueryRowContext(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE %s`, tableCalls, where),
		args...,
	).Scan(&stats.TotalCalls)
	if err != nil {
		return nil, err
	}

	// Success
	err = r.db.QueryRowContext(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE %s AND status='succeeded'`, tableCalls, where),
		args...,
	).Scan(&stats.SuccessCalls)
	if err != nil {
		return nil, err
	}

	// Failed (covers 'failed' and 'timeout')
	err = r.db.QueryRowContext(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE %s AND status IN ('failed','timeout')`, tableCalls, where),
		args...,
	).Scan(&stats.FailedCalls)
	if err != nil {
		return nil, err
	}

	// Average duration
	var avgDur float64
	err = r.db.QueryRowContext(ctx,
		fmt.Sprintf(`SELECT COALESCE(AVG(duration_ms), 0) FROM %s WHERE %s AND duration_ms IS NOT NULL`, tableCalls, where),
		args...,
	).Scan(&avgDur)
	if err != nil {
		return nil, err
	}
	stats.AvgDuration = avgDur

	// P99 duration
	var p99Dur float64
	err = r.db.QueryRowContext(ctx,
		fmt.Sprintf(`SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) FROM %s WHERE %s AND duration_ms IS NOT NULL`, tableCalls, where),
		args...,
	).Scan(&p99Dur)
	if err != nil {
		return nil, err
	}
	stats.P99Duration = p99Dur

	return &stats, nil
}

// GetCallStatsByTarget returns statistics filtered by target domain.
func (r *Repository) GetCallStatsByTarget(ctx context.Context, tenantID, targetDomain string, startTime, endTime time.Time) (*CallStats, error) {
	where := fmt.Sprintf("tenant_id=$1 AND target_domain=$2 AND created_at >= $3 AND created_at <= $4")
	args := []any{tenantID, targetDomain, startTime, endTime}

	var stats CallStats

	err := r.db.QueryRowContext(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE %s`, tableCalls, where),
		args...,
	).Scan(&stats.TotalCalls)
	if err != nil {
		return nil, err
	}

	err = r.db.QueryRowContext(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE %s AND status='succeeded'`, tableCalls, where),
		args...,
	).Scan(&stats.SuccessCalls)
	if err != nil {
		return nil, err
	}

	err = r.db.QueryRowContext(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE %s AND status IN ('failed','timeout')`, tableCalls, where),
		args...,
	).Scan(&stats.FailedCalls)
	if err != nil {
		return nil, err
	}

	var avgDur float64
	err = r.db.QueryRowContext(ctx,
		fmt.Sprintf(`SELECT COALESCE(AVG(duration_ms), 0) FROM %s WHERE %s AND duration_ms IS NOT NULL`, tableCalls, where),
		args...,
	).Scan(&avgDur)
	if err != nil {
		return nil, err
	}
	stats.AvgDuration = avgDur

	var p99Dur float64
	err = r.db.QueryRowContext(ctx,
		fmt.Sprintf(`SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) FROM %s WHERE %s AND duration_ms IS NOT NULL`, tableCalls, where),
		args...,
	).Scan(&p99Dur)
	if err != nil {
		return nil, err
	}
	stats.P99Duration = p99Dur

	return &stats, nil
}

// ===========================================================================
// Table migration helper
// ===========================================================================

// CreateTable creates the crossover_calls table if it does not exist.
func (r *Repository) CreateTable() error {
	_, err := r.db.Exec(`
		CREATE TABLE IF NOT EXISTS crossover_calls (
			id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id     VARCHAR(64)     NOT NULL DEFAULT '',
			source_domain VARCHAR(128)    NOT NULL DEFAULT '',
			target_domain VARCHAR(128)    NOT NULL DEFAULT '',
			method        VARCHAR(256)    NOT NULL DEFAULT '',
			payload       JSONB,
			response      JSONB,
			status        VARCHAR(32)     NOT NULL DEFAULT 'pending',
			duration_ms   BIGINT,
			created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
			updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
		)`)
	if err != nil {
		return fmt.Errorf("create crossover_calls table: %w", err)
	}
	// Create tenant-scoped index for fast Lookups
	_, _ = r.db.Exec(`CREATE INDEX IF NOT EXISTS idx_crossover_calls_tenant ON crossover_calls (tenant_id)`)
	_, _ = r.db.Exec(`CREATE INDEX IF NOT EXISTS idx_crossover_calls_created_at ON crossover_calls (created_at DESC)`)
	_, _ = r.db.Exec(`CREATE INDEX IF NOT EXISTS idx_crossover_calls_status ON crossover_calls (status)`)
	_, _ = r.db.Exec(`CREATE INDEX IF NOT EXISTS idx_crossover_calls_target ON crossover_calls (target_domain)`)
	return nil
}

// ===========================================================================
// Helpers
// ===========================================================================

// buildCallFilterClause builds the WHERE clause and args for ListCalls.
func buildCallFilterClause(f CallFilter) (string, []any) {
	clauses := []string{"1=1"}
	args := []any{}
	n := 1

	if f.TenantID != "" {
		clauses = append(clauses, fmt.Sprintf("tenant_id = $%d", n))
		args = append(args, f.TenantID)
		n++
	}
	if f.SourceDomain != "" {
		clauses = append(clauses, fmt.Sprintf("source_domain = $%d", n))
		args = append(args, f.SourceDomain)
		n++
	}
	if f.TargetDomain != "" {
		clauses = append(clauses, fmt.Sprintf("target_domain = $%d", n))
		args = append(args, f.TargetDomain)
		n++
	}
	if f.Method != "" {
		clauses = append(clauses, fmt.Sprintf("method = $%d", n))
		args = append(args, f.Method)
		n++
	}
	if f.Status != "" {
		clauses = append(clauses, fmt.Sprintf("status = $%d", n))
		args = append(args, f.Status)
		n++
	}
	if f.StartTime != nil {
		clauses = append(clauses, fmt.Sprintf("created_at >= $%d", n))
		args = append(args, *f.StartTime)
		n++
	}
	if f.EndTime != nil {
		clauses = append(clauses, fmt.Sprintf("created_at <= $%d", n))
		args = append(args, *f.EndTime)
		n++
	}

	where := "WHERE " + strings.Join(clauses, " AND ")
	return where, args
}

// encodeJSONB converts JSONB to a string for PostgreSQL insertion.
func encodeJSONB(j JSONB) string {
	if j == nil {
		return ""
	}
	data, _ := json.Marshal(j)
	return string(data)
}
