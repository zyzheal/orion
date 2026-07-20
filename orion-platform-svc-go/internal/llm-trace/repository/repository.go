package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
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

// CreateTrace inserts a new trace into the database.
func (r *Repository) CreateTrace(ctx context.Context, t *models.LLMTrace) error {
	t.ID = uuid.New().String()
	now := time.Now().UTC()
	t.RequestStartedAt = now
	t.CreatedAt = now
	t.Status = models.TraceStatusPending
	t.Currency = "CNY"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO llm_traces (id, tenant_id, user_id, scenario_id, provider_id, model_id,
		   prompt_content, prompt_hash, output_content, output_hash,
		   input_tokens, output_tokens, total_tokens, input_cost, output_cost, total_cost,
		   currency, status, request_started_at, request_completed_at, duration_ms,
		   parent_trace_id, error_message, request_context, metadata, created_at)
		 VALUES (:id, :tenantId, :userId, :scenarioId, :providerId, :modelId,
		   :promptContent, :promptHash, :outputContent, :outputHash,
		   :inputTokens, :outputTokens, :totalTokens, :inputCost, :outputCost, :totalCost,
		   :currency, :status, :requestStartedAt, :requestCompletedAt, :durationMs,
		   :parentTraceId, :errorMessage, :requestContext::jsonb, :metadata::jsonb, :createdAt)`,
		t)
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

// UpdateTrace completes or updates a trace.
func (r *Repository) UpdateTrace(ctx context.Context, traceID, tenantID string, fields map[string]interface{}) error {
	// Build dynamic update
	if len(fields) == 0 {
		return nil
	}
	setParts := make([]string, 0, len(fields))
	args := make([]interface{}, 0, len(fields)+2)
	argIdx := 1
	for k, v := range fields {
		setParts = append(setParts, fmt.Sprintf("%s = $%d", k, argIdx))
		args = append(args, v)
		argIdx++
	}
	args = append(args, traceID, tenantID)
	stmt := fmt.Sprintf(
		`UPDATE llm_traces SET %s WHERE id=$%d AND tenant_id=$%d`,
		joinComma(setParts), argIdx, argIdx+1)
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
	if err == sql.ErrNoRows {
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

// parseJSONB handles JSONB null string.
func parseJSONB(s sql.NullString) string {
	if s.Valid {
		return s.String
	}
	return ""
}

// toJSONB converts an interface to JSONB string for sql.NullString.
func toJSONB(v interface{}) string {
	if v == nil {
		return ""
	}
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(b)
}

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
