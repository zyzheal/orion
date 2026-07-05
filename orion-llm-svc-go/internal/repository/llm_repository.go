package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"orion/llm-svc-go/internal/models"
)

// Repository provides all database operations for the LLM trace service.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ==========================================================================
// LLM Traces
// ==========================================================================

// CreateTrace inserts a new trace row and returns the persisted record.
func (r *Repository) CreateTrace(ctx context.Context, t *models.LLMTrace) (*models.LLMTrace, error) {
	query := `
		INSERT INTO llm_traces (
			trace_id, tenant_id, user_id, scenario_id, provider_id, model_id,
			prompt_content, prompt_hash, input_tokens, output_tokens, total_tokens,
			input_cost, output_cost, total_cost, currency, status,
			request_started_at, parent_trace_id, request_context
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16,
			$17, $18, $19
		) RETURNING *`

	var out models.LLMTrace
	err := r.db.QueryRowxContext(ctx, query,
		t.TraceID, t.TenantID, t.UserID, t.ScenarioID, t.ProviderID, t.ModelID,
		t.PromptContent, t.PromptHash, t.InputTokens, t.OutputTokens, t.TotalTokens,
		t.InputCost, t.OutputCost, t.TotalCost, t.Currency, t.Status,
		t.RequestStartedAt, t.ParentTraceID, t.RequestContext,
	).StructScan(&out)
	if err != nil {
		return nil, fmt.Errorf("CreateTrace: %w", err)
	}
	return &out, nil
}

// UpdateTrace applies a partial update to the trace identified by traceID.
// The updates map uses Go field names which are converted to snake_case columns.
func (r *Repository) UpdateTrace(ctx context.Context, traceID string, updates map[string]interface{}) (*models.LLMTrace, error) {
	if len(updates) == 0 {
		return r.FindTraceByTraceID(ctx, traceID)
	}

	// Map Go field names → DB column names (same logic as Node.js camelCase→snake_case).
	fieldToColumn := map[string]string{
		"outputContent":      "output_content",
		"outputHash":         "output_hash",
		"inputTokens":        "input_tokens",
		"outputTokens":       "output_tokens",
		"totalTokens":        "total_tokens",
		"inputCost":          "input_cost",
		"outputCost":         "output_cost",
		"totalCost":          "total_cost",
		"status":             "status",
		"requestCompletedAt": "request_completed_at",
		"durationMs":         "duration_ms",
		"errorMessage":       "error_message",
		"metadata":           "metadata",
	}

	setClauses := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates))
	idx := 1
	for field, val := range updates {
		col, ok := fieldToColumn[field]
		if !ok {
			continue
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, idx))
		args = append(args, val)
		idx++
	}
	if len(setClauses) == 0 {
		return r.FindTraceByTraceID(ctx, traceID)
	}

	args = append(args, traceID)
	query := fmt.Sprintf(
		"UPDATE llm_traces SET %s WHERE trace_id = $%d RETURNING *",
		strings.Join(setClauses, ", "), idx,
	)

	var out models.LLMTrace
	err := r.db.QueryRowxContext(ctx, query, args...).StructScan(&out)
	if err != nil {
		return nil, fmt.Errorf("UpdateTrace(%s): %w", traceID, err)
	}
	return &out, nil
}

// FindTraceByTraceID looks up a single trace by its unique trace_id.
func (r *Repository) FindTraceByTraceID(ctx context.Context, traceID string) (*models.LLMTrace, error) {
	var t models.LLMTrace
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM llm_traces WHERE trace_id = $1`, traceID)
	if err != nil {
		return nil, fmt.Errorf("FindTraceByTraceID(%s): %w", traceID, err)
	}
	return &t, nil
}

// FindTracesByTenant returns traces for a tenant, most recent first.
func (r *Repository) FindTracesByTenant(ctx context.Context, tenantID string, limit int) ([]models.LLMTrace, error) {
	if limit <= 0 {
		limit = 1000
	}
	var items []models.LLMTrace
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM llm_traces WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
		tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("FindTracesByTenant(%s): %w", tenantID, err)
	}
	return items, nil
}

// FindTracesByScenario returns traces for a scenario, most recent first.
func (r *Repository) FindTracesByScenario(ctx context.Context, scenarioID string, limit int) ([]models.LLMTrace, error) {
	if limit <= 0 {
		limit = 1000
	}
	var items []models.LLMTrace
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM llm_traces WHERE scenario_id = $1 ORDER BY created_at DESC LIMIT $2`,
		scenarioID, limit)
	if err != nil {
		return nil, fmt.Errorf("FindTracesByScenario(%s): %w", scenarioID, err)
	}
	return items, nil
}

// FindAllTraces returns all traces up to the given limit.
func (r *Repository) FindAllTraces(ctx context.Context, limit int) ([]models.LLMTrace, error) {
	if limit <= 0 {
		limit = 1000
	}
	var items []models.LLMTrace
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM llm_traces ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("FindAllTraces: %w", err)
	}
	return items, nil
}

// DeleteAllTraces removes every trace row.
func (r *Repository) DeleteAllTraces(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM llm_traces`)
	if err != nil {
		return fmt.Errorf("DeleteAllTraces: %w", err)
	}
	return nil
}

// GetDailyStats aggregates trace statistics for a tenant on a specific date.
func (r *Repository) GetDailyStats(ctx context.Context, tenantID string, date time.Time) (*models.DailyStats, error) {
	dateStr := date.Format("2006-01-02")
	query := `
		SELECT
			COUNT(*)                                          AS total_requests,
			COALESCE(SUM(total_tokens), 0)                    AS total_tokens,
			COALESCE(SUM(total_cost), 0)                      AS total_cost,
			COALESCE(AVG(duration_ms), 0)                     AS avg_duration_ms,
			CASE WHEN COUNT(*) > 0
				THEN SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::decimal / COUNT(*)
				ELSE 1
			END                                               AS success_rate
		FROM llm_traces
		WHERE tenant_id = $1
		  AND DATE(request_started_at) = $2
		  AND status != 'pending'`

	var stats models.DailyStats
	err := r.db.GetContext(ctx, &stats, query, tenantID, dateStr)
	if err != nil {
		return nil, fmt.Errorf("GetDailyStats(%s, %s): %w", tenantID, dateStr, err)
	}
	return &stats, nil
}

// ==========================================================================
// Model Custom Pricing
// ==========================================================================

// FindPricingByModelID returns the custom pricing for a model, or nil if none exists.
func (r *Repository) FindPricingByModelID(ctx context.Context, modelID string) (*models.ModelPricing, error) {
	var p models.ModelPricing
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM model_custom_pricing WHERE model_id = $1 LIMIT 1`, modelID)
	if err != nil {
		return nil, err // sql.ErrNoRows means not found
	}
	return &p, nil
}

// FindPricingsByTenant returns all custom pricing rows for a tenant.
func (r *Repository) FindPricingsByTenant(ctx context.Context, tenantID string) ([]models.ModelPricing, error) {
	var items []models.ModelPricing
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM model_custom_pricing WHERE tenant_id = $1 ORDER BY model_id`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("FindPricingsByTenant(%s): %w", tenantID, err)
	}
	return items, nil
}

// FindAllPricings returns every custom pricing row.
func (r *Repository) FindAllPricings(ctx context.Context) ([]models.ModelPricing, error) {
	var items []models.ModelPricing
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM model_custom_pricing ORDER BY model_id`)
	if err != nil {
		return nil, fmt.Errorf("FindAllPricings: %w", err)
	}
	return items, nil
}

// UpsertPricing creates or updates custom pricing for a model.
// Mirrors the Node.js ModelPricingRepository.upsertByModelId logic.
func (r *Repository) UpsertPricing(ctx context.Context, modelID string, inputPrice, outputPrice float64, tenantID *string) (*models.ModelPricing, error) {
	// Try to find existing pricing first (matches Node.js upsert logic).
	existing, err := r.FindPricingByModelID(ctx, modelID)
	if err == nil && existing != nil {
		// Update existing row.
		existing.InputPrice = inputPrice
		existing.OutputPrice = outputPrice
		existing.UpdatedAt = time.Now()
		query := `UPDATE model_custom_pricing SET input_price = $1, output_price = $2, updated_at = $3 WHERE id = $4 RETURNING *`
		var out models.ModelPricing
		err = r.db.QueryRowxContext(ctx, query,
			existing.InputPrice, existing.OutputPrice, existing.UpdatedAt, existing.ID,
		).StructScan(&out)
		if err != nil {
			return nil, fmt.Errorf("UpsertPricing update(%s): %w", modelID, err)
		}
		return &out, nil
	}

	// Insert new row.
	id := fmt.Sprintf("pricing-%d-%s", time.Now().UnixMilli(), uuid.New().String()[:8])
	query := `
		INSERT INTO model_custom_pricing (id, model_id, input_price, output_price, tenant_id)
		VALUES ($1, $2, $3, $4, $5) RETURNING *`
	var out models.ModelPricing
	err = r.db.QueryRowxContext(ctx, query,
		id, modelID, inputPrice, outputPrice, tenantID,
	).StructScan(&out)
	if err != nil {
		return nil, fmt.Errorf("UpsertPricing insert(%s): %w", modelID, err)
	}
	return &out, nil
}

// DeletePricingByModelID removes the custom pricing for a model.
func (r *Repository) DeletePricingByModelID(ctx context.Context, modelID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM model_custom_pricing WHERE model_id = $1`, modelID)
	if err != nil {
		return false, fmt.Errorf("DeletePricingByModelID(%s): %w", modelID, err)
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}
