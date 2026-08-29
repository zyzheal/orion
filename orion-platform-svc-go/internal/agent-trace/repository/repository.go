package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/platform-svc-go/internal/agent-trace/models"
)

// RepositoryInterface defines persistence for agent traces.
type RepositoryInterface interface {
	SaveTrace(ctx context.Context, trace *models.AgentTrace) error
	GetByTraceID(ctx context.Context, tenantID, traceID string) (*models.AgentTrace, error)
	ListTraces(ctx context.Context, req models.TraceQueryRequest) ([]*models.AgentTrace, int, error)
	UpdateTraceStatus(ctx context.Context, tenantID, traceID string, status, err string, durationMs int64, response string) error
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

var _ RepositoryInterface = (*Repository)(nil)

func (r *Repository) SaveTrace(ctx context.Context, t *models.AgentTrace) error {
	if r.db == nil {
		return fmt.Errorf("agent-trace: db not configured")
	}
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	t.CreatedAt = time.Now().UTC()
	t.CompletedAt = time.Now().UTC()

	var toolCallsJSON string
	if len(t.ToolCalls) > 0 {
		b, err := json.Marshal(t.ToolCalls)
		if err == nil {
			toolCallsJSON = string(b)
		}
	}

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO agent_traces
			(id, tenant_id, user_id, agent_id, agent_name, prompt, tool_calls, response, status,
			 duration_ms, input_tokens, output_tokens, total_tokens, estimated_cost,
			 parent_trace_id, error, created_at, completed_at)
		VALUES
			(:id, :tenant_id, :user_id, :agent_id, :agent_name, :prompt, :tool_calls, :response, :status,
			 :duration_ms, :input_tokens, :output_tokens, :total_tokens, :estimated_cost,
			 :parent_trace_id, :error, :created_at, :completed_at)
	`, map[string]interface{}{
		"id":              t.ID,
		"tenant_id":       t.TenantID,
		"user_id":         t.UserID,
		"agent_id":        t.AgentID,
		"agent_name":      t.AgentName,
		"prompt":          t.Prompt,
		"tool_calls":      toolCallsJSON,
		"response":        t.Response,
		"status":          t.Status,
		"duration_ms":     t.DurationMs,
		"input_tokens":    t.TokenUsage.InputTokens,
		"output_tokens":   t.TokenUsage.OutputTokens,
		"total_tokens":    t.TokenUsage.TotalTokens,
		"estimated_cost":  t.TokenUsage.EstimatedCost,
		"parent_trace_id": t.ParentTraceID,
		"error":           t.Error,
		"created_at":      t.CreatedAt,
		"completed_at":    t.CompletedAt,
	})
	return err
}

func (r *Repository) GetByTraceID(ctx context.Context, tenantID, traceID string) (*models.AgentTrace, error) {
	if r.db == nil {
		return nil, fmt.Errorf("agent-trace: db not configured")
	}
	var t models.AgentTrace
	err := r.db.GetContext(ctx, &t, `
		SELECT id, tenant_id, user_id, agent_id, agent_name, prompt, response, status,
			 duration_ms, input_tokens, output_tokens, total_tokens, estimated_cost,
			 parent_trace_id, error, created_at, completed_at
		FROM agent_traces
		WHERE id=$1 AND tenant_id=$2
	`, traceID, tenantID)
	return &t, err
}

func (r *Repository) ListTraces(ctx context.Context, req models.TraceQueryRequest) ([]*models.AgentTrace, int, error) {
	if r.db == nil {
		return nil, 0, fmt.Errorf("agent-trace: db not configured")
	}
	if req.Limit <= 0 {
		req.Limit = 50
	}
	offset := req.Page * req.Limit

	var traces []*models.AgentTrace
	err := r.db.SelectContext(ctx, &traces, `
		SELECT id, tenant_id, user_id, agent_id, agent_name, prompt, response, status,
			 duration_ms, input_tokens, output_tokens, total_tokens, estimated_cost,
			 parent_trace_id, error, created_at, completed_at
		FROM agent_traces
		WHERE tenant_id = (SELECT tenant_id FROM agent_traces WHERE id=$1 LIMIT 1)
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, "unused", req.Limit, offset)
	if err != nil {
		return nil, 0, err
	}

	var total int
	err = r.db.GetContext(ctx, &total, "SELECT COUNT(*) FROM agent_traces WHERE id IN (SELECT id FROM agent_traces LIMIT 1000)")
	return traces, total, err
}

func (r *Repository) UpdateTraceStatus(ctx context.Context, tenantID, traceID string, status, errMsg string, durationMs int64, response string) error {
	if r.db == nil {
		return fmt.Errorf("agent-trace: db not configured")
	}
	var resultErr error
	_, resultErr = r.db.ExecContext(ctx, `
		UPDATE agent_traces
		SET status=$1, error=$2, duration_ms=$3, response=$4, completed_at=NOW()
		WHERE id=$5 AND tenant_id=$6
	`, status, errMsg, durationMs, response, traceID, tenantID)
	return resultErr
}
