package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"time"

	"orion/platform-svc-go/internal/llm-trace/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Traces ---

// createTraceSQL is the statement CreateTrace binds.
//
// Every named parameter is written as the `db` struct tag on models.LLMTrace,
// not as a Go field name. sqlx maps a field to its tag when the tag is present,
// otherwise to strings.ToLower(GoFieldName) -- so :tenantId does not match a
// field tagged db:"tenant_id" and the insert fails with
// "could not find name tenantId in &models.LLMTrace{...}". The previous camelCase
// form meant POST /api/v1/llm/traces could not bind at all.
//
// The old `:requestContext::jsonb` / `:metadata::jsonb` casts were a second,
// independent failure: compileNamedQuery rejects any second colon after a
// parameter name and returns "unexpected `:` while reading named param". Postgres
// casts text to jsonb implicitly, so the casts were never needed.
const createTraceSQL = `INSERT INTO llm_traces (id, tenant_id, user_id, scenario_id, provider_id, model_id,
	   prompt_content, prompt_hash, output_content, output_hash,
	   input_tokens, output_tokens, total_tokens, input_cost, output_cost, total_cost,
	   currency, status, request_started_at, request_completed_at, duration_ms,
	   parent_trace_id, error_message, request_context, metadata, created_at)
	 VALUES (:id, :tenant_id, :user_id, :scenario_id, :provider_id, :model_id,
	   :prompt_content, :prompt_hash, :output_content, :output_hash,
	   :input_tokens, :output_tokens, :total_tokens, :input_cost, :output_cost, :total_cost,
	   :currency, :status, :request_started_at, :request_completed_at, :duration_ms,
	   :parent_trace_id, :error_message, :request_context, :metadata, :created_at)`

// CreateTrace inserts a new trace into the database.
func (r *Repository) CreateTrace(ctx context.Context, t *models.LLMTrace) error {
	t.ID = uuid.New().String()
	now := time.Now().UTC()
	t.RequestStartedAt = now
	t.CreatedAt = now
	t.Status = models.TraceStatusPending
	t.Currency = "CNY"
	_, err := r.db.NamedExecContext(ctx, createTraceSQL, t)
	return err
}

// GetTrace retrieves a trace by its ID.
func (r *Repository) GetTrace(ctx context.Context, traceID, tenantID string) (*models.LLMTrace, error) {
	var t models.LLMTrace
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM llm_traces WHERE id=$1 AND tenant_id=$2`, traceID, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ListTracesByTenant lists traces for a tenant with optional scenario filter.
func (r *Repository) ListTracesByTenant(ctx context.Context, tenantID string, q *models.ListTracesQuery) ([]models.LLMTrace, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if q != nil && q.ScenarioID != nil && *q.ScenarioID != "" {
		where += fmt.Sprintf(" AND scenario_id = $%d", argIdx)
		args = append(args, *q.ScenarioID)
		argIdx++
	}

	limit := 100
	if q != nil && q.Limit != nil && *q.Limit > 0 {
		limit = *q.Limit
	}

	where += fmt.Sprintf(" ORDER BY request_started_at DESC LIMIT $%d", argIdx)
	args = append(args, limit)

	var traces []models.LLMTrace
	err := r.db.SelectContext(ctx, &traces, fmt.Sprintf(`SELECT * FROM llm_traces %s`, where), args...)
	return traces, err
}

// CountTracesByTenant returns the total number of traces for a tenant.
func (r *Repository) CountTracesByTenant(ctx context.Context, tenantID string, q *models.ListTracesQuery) (int64, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if q != nil && q.ScenarioID != nil && *q.ScenarioID != "" {
		where += fmt.Sprintf(" AND scenario_id = $%d", argIdx)
		args = append(args, *q.ScenarioID)
		argIdx++
	}

	var total int64
	err := r.db.GetContext(ctx, &total, fmt.Sprintf(`SELECT COUNT(*) FROM llm_traces %s`, where), args...)
	return total, err
}

// traceUpdateColumns is the closed set of columns a caller may ask UpdateTrace
// to write. The keys are interpolated straight into the statement, so an open
// map would let any caller name a column -- including id or tenant_id, which
// would rewrite a row's identity and quietly re-tenant it. Rejected keys return
// an error rather than being skipped: a caller asking for a column that does not
// exist should fail loudly, not persist a silently partial trace.
var traceUpdateColumns = map[string]bool{
	"output_content":       true,
	"output_hash":          true,
	"input_tokens":         true,
	"output_tokens":        true,
	"total_tokens":         true,
	"input_cost":           true,
	"output_cost":          true,
	"total_cost":           true,
	"status":               true,
	"request_completed_at": true,
	"duration_ms":          true,
	"error_message":        true,
}

// UpdateTrace completes or updates a trace.
func (r *Repository) UpdateTrace(ctx context.Context, traceID, tenantID string, fields map[string]interface{}) error {
	if len(fields) == 0 {
		return nil
	}
	// Validate first, then sort: map iteration order is random, and the $n
	// slots are assigned in iteration order, so an unsorted map produced a
	// different statement (and a different argument order) on every call.
	keys := make([]string, 0, len(fields))
	for k := range fields {
		if !traceUpdateColumns[k] {
			return fmt.Errorf("UpdateTrace: refusing to set %q, not a writable trace column", k)
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	setParts := make([]string, 0, len(keys))
	args := make([]interface{}, 0, len(keys)+2)
	for i, k := range keys {
		setParts = append(setParts, fmt.Sprintf("%s = $%d", k, i+1))
		args = append(args, fields[k])
	}
	args = append(args, traceID, tenantID)
	stmt := fmt.Sprintf(
		`UPDATE llm_traces SET %s WHERE id=$%d AND tenant_id=$%d`,
		joinComma(setParts), len(keys)+1, len(keys)+2)
	_, err := r.db.ExecContext(ctx, stmt, args...)
	return err
}

// --- Daily Stats ---

// GetDailyStats aggregates daily statistics for a tenant.
func (r *Repository) GetDailyStats(ctx context.Context, tenantID, dateStr string) (*models.DailyStats, error) {
	stats := &models.DailyStats{
		TenantID: tenantID,
		Date:     dateStr,
	}

	where := fmt.Sprintf("WHERE tenant_id = $1 AND DATE(request_started_at) = $2")
	args := []interface{}{tenantID, dateStr}

	// total requests
	err := r.db.GetContext(ctx, &stats.TotalRequests,
		fmt.Sprintf(`SELECT COUNT(*) FROM llm_traces %s`, where), args...)
	if err != nil {
		return nil, err
	}

	// total tokens
	err = r.db.GetContext(ctx, &stats.TotalTokens,
		fmt.Sprintf(`SELECT COALESCE(SUM(total_tokens), 0) FROM llm_traces %s`, where), args...)
	if err != nil {
		return nil, err
	}

	// total cost
	err = r.db.GetContext(ctx, &stats.TotalCost,
		`SELECT COALESCE(SUM(total_cost), 0) FROM llm_traces `+where, args...)
	if err != nil {
		return nil, err
	}

	// avg duration
	err = r.db.GetContext(ctx, &stats.AvgDurationMs,
		`SELECT COALESCE(AVG(COALESCE(duration_ms, 0)), 0) FROM llm_traces `+where, args...)
	if err != nil {
		return nil, err
	}

	// success rate
	err = r.db.GetContext(ctx, &stats.SuccessRate,
		`SELECT COALESCE(
			COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0), 0
		) FROM llm_traces `+where, args...)
	if err != nil {
		return nil, err
	}

	return stats, nil
}

// --- Tracking Accuracy ---

// GetTrackingAccuracy returns accuracy metrics for a tenant.
func (r *Repository) GetTrackingAccuracy(ctx context.Context, tenantID string) (*models.TrackingAccuracy, error) {
	var total int64
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM llm_traces WHERE tenant_id = $1 AND status IN ('completed', 'failed')`, tenantID)
	if err != nil {
		return nil, err
	}

	var completed int64
	err = r.db.GetContext(ctx, &completed,
		`SELECT COUNT(*) FROM llm_traces WHERE tenant_id = $1 AND status = 'completed'`, tenantID)
	if err != nil {
		return nil, err
	}

	var failed int64
	err = r.db.GetContext(ctx, &failed,
		`SELECT COUNT(*) FROM llm_traces WHERE tenant_id = $1 AND status = 'failed'`, tenantID)
	if err != nil {
		return nil, err
	}

	accuracy := 1.0
	if total > 0 {
		accuracy = float64(completed) / float64(total)
	}

	return &models.TrackingAccuracy{
		Accuracy:       accuracy,
		CompletedCount: completed,
		FailedCount:    failed,
		Total:          total,
		TargetAccuracy: 0.98,
		MeetsTarget:    accuracy >= 0.98,
	}, nil
}

// --- Custom Pricing ---

// GetCustomPricing retrieves custom pricing for a model.
func (r *Repository) GetCustomPricing(ctx context.Context, modelID string) (*models.ModelPricing, error) {
	var pricing models.ModelPricing
	err := r.db.GetContext(ctx, &pricing,
		`SELECT input, output FROM llm_model_pricing WHERE model_id = $1`, modelID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &pricing, nil
}

// --- Traces with time range ---

// ListTracesByTenantAndDateRange lists traces for a tenant within a date range.
func (r *Repository) ListTracesByTenantAndDateRange(ctx context.Context, tenantID string, start, end *time.Time) ([]models.LLMTrace, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if start != nil {
		where += fmt.Sprintf(" AND request_started_at >= $%d", argIdx)
		args = append(args, *start)
		argIdx++
	}
	if end != nil {
		where += fmt.Sprintf(" AND request_started_at <= $%d", argIdx)
		args = append(args, *end)
		argIdx++
	}

	var traces []models.LLMTrace
	err := r.db.SelectContext(ctx, &traces, fmt.Sprintf(`SELECT * FROM llm_traces %s ORDER BY request_started_at DESC`, where), args...)
	return traces, err
}

// --- Helpers ---

func joinComma(parts []string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += ", "
		}
		result += p
	}
	return result
}
