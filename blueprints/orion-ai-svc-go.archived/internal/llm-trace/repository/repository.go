package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/ai-svc-go/internal/llm-trace/models"
)

type LLMTraceRepository struct {
	DB *sql.DB
}

func NewLLMTraceRepository(db *sql.DB) *LLMTraceRepository {
	return &LLMTraceRepository{DB: db}
}

// Create inserts a new trace.
func (r *LLMTraceRepository) Create(ctx context.Context, tenantID string, req *models.CreateTraceRequest) (*models.LLMTrace, error) {
	now := time.Now()
	id := fmt.Sprintf("trace_%d", time.Now().UnixNano())

	query := `INSERT INTO llm_traces (id, tenant_id, model, provider, prompt_tokens, completion_tokens, total_tokens, cost, latency_ms, status, error, trace_id, input, output, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`
	if _, err := r.DB.ExecContext(ctx, query, id, tenantID, req.Model, req.Provider, req.PromptTokens, req.CompletionTokens, req.TotalTokens, req.Cost, req.LatencyMs, req.Status, req.Error, req.TraceID, req.Input, req.Output, now); err != nil {
		return nil, fmt.Errorf("create llm trace: %w", err)
	}

	status := req.Status
	if status == "" {
		status = "completed"
	}

	return &models.LLMTrace{
		ID:               id,
		TenantID:         tenantID,
		Model:            req.Model,
		Provider:         req.Provider,
		PromptTokens:     req.PromptTokens,
		CompletionTokens: req.CompletionTokens,
		TotalTokens:      req.TotalTokens,
		Cost:             req.Cost,
		LatencyMs:        req.LatencyMs,
		Status:           status,
		Error:            req.Error,
		TraceID:          req.TraceID,
		Input:            req.Input,
		Output:           req.Output,
		CreatedAt:        now,
	}, nil
}

// Query returns paginated traces.
func (r *LLMTraceRepository) Query(ctx context.Context, tenantID string, model, provider, status, startTime, endTime string, limit, offset int) (models.TraceResponse, error) {
	var resp models.TraceResponse
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	where := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if model != "" {
		where = append(where, fmt.Sprintf("model = $%d", argIdx))
		args = append(args, model)
		argIdx++
	}
	if provider != "" {
		where = append(where, fmt.Sprintf("provider = $%d", argIdx))
		args = append(args, provider)
		argIdx++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}
	if startTime != "" {
		where = append(where, fmt.Sprintf("created_at >= $%d", argIdx))
		args = append(args, startTime)
		argIdx++
	}
	if endTime != "" {
		where = append(where, fmt.Sprintf("created_at <= $%d", argIdx))
		args = append(args, endTime)
		argIdx++
	}

	whereClause := "WHERE " + joinStrings(where, " AND ")
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM llm_traces %s`, whereClause)
	query := fmt.Sprintf(`
		SELECT id, tenant_id, model, provider, prompt_tokens, completion_tokens, total_tokens, cost, latency_ms, status, error, trace_id, input, output, created_at
		FROM llm_traces %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	if err := r.DB.QueryRowContext(ctx, countQuery, countArgs...).Scan(&resp.Total); err != nil {
		return resp, fmt.Errorf("count llm traces: %w", err)
	}

	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return resp, fmt.Errorf("query llm traces: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var t models.LLMTrace
		var errorStr sql.NullString
		if err := rows.Scan(&t.ID, &t.TenantID, &t.Model, &t.Provider, &t.PromptTokens, &t.CompletionTokens, &t.TotalTokens, &t.Cost, &t.LatencyMs, &t.Status, &errorStr, &t.TraceID, &t.Input, &t.Output, &t.CreatedAt); err != nil {
			return resp, fmt.Errorf("scan trace: %w", err)
		}
		if errorStr.Valid {
			t.Error = errorStr.String
		}
		resp.Data = append(resp.Data, t)
	}
	return resp, nil
}

// GetCostSummary returns aggregated cost data.
func (r *LLMTraceRepository) GetCostSummary(ctx context.Context, tenantID string, period string) (*models.CostSummary, error) {
	// Calculate time range based on period
	var timeFilter string
	var timeArgs []interface{}
	argIdx := 1

	switch period {
	case "day":
		timeFilter = fmt.Sprintf("created_at >= NOW() - INTERVAL '1 day'")
	case "week":
		timeFilter = fmt.Sprintf("created_at >= NOW() - INTERVAL '7 days'")
	case "month":
		timeFilter = fmt.Sprintf("created_at >= NOW() - INTERVAL '30 days'")
	default:
		timeFilter = ""
	}

	whereClause := fmt.Sprintf("tenant_id = $%d AND %s", argIdx, timeFilter)
	args := []interface{}{tenantID}

	// Total cost and tokens
	var summary models.CostSummary
	summary.Period = period

	totalQuery := fmt.Sprintf(`
		SELECT COALESCE(SUM(cost), 0), COALESCE(SUM(total_tokens), 0), COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0), COUNT(*)
		FROM llm_traces WHERE %s`, whereClause)
	if err := r.DB.QueryRowContext(ctx, totalQuery, args...).Scan(&summary.TotalCost, &summary.TotalTokens, &summary.PromptTokens, &summary.CompletionTokens, &summary.CallCount); err != nil {
		return nil, fmt.Errorf("get cost summary totals: %w", err)
	}

	// By model
	modelQuery := fmt.Sprintf(`
		SELECT model, COALESCE(SUM(cost), 0), COUNT(*), COALESCE(SUM(total_tokens), 0)
		FROM llm_traces WHERE %s
		GROUP BY model ORDER BY SUM(cost) DESC`, whereClause)
	modelRows, err := r.DB.QueryContext(ctx, modelQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("get cost by model: %w", err)
	}
	defer modelRows.Close()

	for modelRows.Next() {
		var mc models.ModelCost
		if err := modelRows.Scan(&mc.Model, &mc.Cost, &mc.CallCount, &mc.Tokens); err != nil {
			return nil, fmt.Errorf("scan model cost: %w", err)
		}
		summary.ByModel = append(summary.ByModel, mc)
	}

	// By provider
	providerQuery := fmt.Sprintf(`
		SELECT provider, COALESCE(SUM(cost), 0), COUNT(*), COALESCE(SUM(total_tokens), 0)
		FROM llm_traces WHERE %s
		GROUP BY provider ORDER BY SUM(cost) DESC`, whereClause)
	providerRows, err := r.DB.QueryContext(ctx, providerQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("get cost by provider: %w", err)
	}
	defer providerRows.Close()

	for providerRows.Next() {
		var pc models.ProviderCost
		if err := providerRows.Scan(&pc.Provider, &pc.Cost, &pc.CallCount, &pc.Tokens); err != nil {
			return nil, fmt.Errorf("scan provider cost: %w", err)
		}
		summary.ByProvider = append(summary.ByProvider, pc)
	}

	return &summary, nil
}

// GetByTraceID returns traces for a specific trace ID.
func (r *LLMTraceRepository) GetByTraceID(ctx context.Context, tenantID, traceID string) ([]models.LLMTrace, error) {
	rows, err := r.DB.QueryContext(ctx,
		`SELECT id, tenant_id, model, provider, prompt_tokens, completion_tokens, total_tokens, cost, latency_ms, status, error, trace_id, input, output, created_at
		 FROM llm_traces WHERE tenant_id = $1 AND trace_id = $2 ORDER BY created_at ASC`, tenantID, traceID)
	if err != nil {
		return nil, fmt.Errorf("query by trace id: %w", err)
	}
	defer rows.Close()

	var traces []models.LLMTrace
	for rows.Next() {
		var t models.LLMTrace
		var errorStr sql.NullString
		if err := rows.Scan(&t.ID, &t.TenantID, &t.Model, &t.Provider, &t.PromptTokens, &t.CompletionTokens, &t.TotalTokens, &t.Cost, &t.LatencyMs, &t.Status, &errorStr, &t.TraceID, &t.Input, &t.Output, &t.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan trace: %w", err)
		}
		if errorStr.Valid {
			t.Error = errorStr.String
		}
		traces = append(traces, t)
	}
	return traces, nil
}

// Delete removes traces older than retention period.
func (r *LLMTraceRepository) DeleteOldTraces(ctx context.Context, tenantID string, days int) (int64, error) {
	cutoff := time.Now().Add(-time.Duration(days) * 24 * time.Hour)
	result, err := r.DB.ExecContext(ctx, `DELETE FROM llm_traces WHERE tenant_id = $1 AND created_at < $2`, tenantID, cutoff)
	if err != nil {
		return 0, fmt.Errorf("delete old traces: %w", err)
	}
	return result.RowsAffected()
}

func joinStrings(items []string, sep string) string {
	result := ""
	for i, item := range items {
		if i > 0 {
			result += sep
		}
		result += item
	}
	return result
}
