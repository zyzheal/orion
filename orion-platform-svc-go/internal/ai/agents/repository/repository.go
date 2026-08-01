package repository

import (
	"context"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/ai-agents/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Agents ---

func (r *Repository) CreateAgent(ctx context.Context, a *models.AIAgent) error {
	a.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO ai_agents (id, tenant_id, name, enabled, scenario, provider,
		   max_concurrency, timeout_ms, max_retries, backoff_ms,
		   required_tools, required_permissions, model_config, status,
		   created_by, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :enabled, :scenario, :provider,
		   :maxConcurrency, :timeoutMs, :maxRetries, :backoffMs,
		   :requiredTools::jsonb, :requiredPermissions::jsonb, :modelConfig::jsonb, :status,
		   :createdBy, :createdAt, :updatedAt)`,
		a)
	return err
}

func (r *Repository) GetByID(ctx context.Context, id string, tenantID string) (*models.AIAgent, error) {
	var a models.AIAgent
	err := r.db.GetContext(ctx, &a,
		`SELECT * FROM ai_agents WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, filter *ListFilter) ([]models.AIAgent, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter.Status != nil && *filter.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *filter.Status)
		argIdx++
	}
	if filter.Enabled != nil {
		where += fmt.Sprintf(" AND enabled = $%d", argIdx)
		args = append(args, *filter.Enabled)
		argIdx++
	}

	// Defaults
	limit := 20
	offset := 0
	sortField := "created_at"
	sortOrder := "DESC"

	if filter.Limit != nil && *filter.Limit > 0 {
		limit = *filter.Limit
	}
	if filter.Offset != nil {
		offset = *filter.Offset
	}
	if filter.Sort != nil && *filter.Sort != "" {
		sortField = sanitizeSortField(*filter.Sort)
	}
	if filter.Order != nil && *filter.Order != "" {
		sortOrder = strings.ToUpper(*filter.Order)
		if sortOrder != "ASC" {
			sortOrder = "DESC"
		}
	}

	where += fmt.Sprintf(" ORDER BY %s %s LIMIT $%d OFFSET $%d", sortField, sortOrder, argIdx, argIdx+1)
	args = append(args, limit, offset)

	var agents []models.AIAgent
	err := r.db.SelectContext(ctx, &agents, fmt.Sprintf(`SELECT * FROM ai_agents %s`, where), args...)
	return agents, err
}

func (r *Repository) Count(ctx context.Context, tenantID string, filter *ListFilter) (int64, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter.Status != nil && *filter.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *filter.Status)
		argIdx++
	}
	if filter.Enabled != nil {
		where += fmt.Sprintf(" AND enabled = $%d", argIdx)
		args = append(args, *filter.Enabled)
		argIdx++
	}

	var total int64
	err := r.db.GetContext(ctx, &total, fmt.Sprintf(`SELECT COUNT(*) FROM ai_agents %s`, where), args...)
	return total, err
}

func (r *Repository) UpdateAgent(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.AIAgent, error) {
	if len(updates) == 0 {
		return r.GetByID(ctx, id, tenantID)
	}

	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1
	for _, col := range []string{"name", "enabled", "scenario", "provider", "max_concurrency", "timeout_ms", "max_retries", "backoff_ms", "status"} {
		if v, ok := updates[col]; ok {
			setClauses = append(setClauses, fmt.Sprintf("%s=$%d", col, argIdx))
			args = append(args, v)
			argIdx++
		}
	}
	// JSONB columns use typed params
	if v, ok := updates["required_tools"]; ok {
		setClauses = append(setClauses, fmt.Sprintf("required_tools=$%d", argIdx))
		args = append(args, v)
		argIdx++
	}
	if v, ok := updates["required_permissions"]; ok {
		setClauses = append(setClauses, fmt.Sprintf("required_permissions=$%d", argIdx))
		args = append(args, v)
		argIdx++
	}
	if v, ok := updates["model_config"]; ok {
		setClauses = append(setClauses, fmt.Sprintf("model_config=$%d", argIdx))
		args = append(args, v)
		argIdx++
	}

	// updated_at = now()
	argIdx++
	_ = argIdx - 1
	updatedAtIdx := argIdx
	args = append(args, id, tenantID)

	sql := fmt.Sprintf(
		`UPDATE ai_agents SET %s, updated_at=$%d WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), updatedAtIdx, argIdx, argIdx+1)

	_, err := r.db.ExecContext(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id, tenantID)
}

func (r *Repository) UpdateAgentStatus(ctx context.Context, id string, tenantID string, status models.AgentStatus) (*models.AIAgent, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE ai_agents SET status=$1, updated_at=EXTRACT(EPOCH FROM now())
		 WHERE id=$2 AND tenant_id=$3`,
		status, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id, tenantID)
}

func (r *Repository) Delete(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM ai_agents WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// --- Audit Logs ---

func (r *Repository) CreateAuditLog(ctx context.Context, log *models.AgentAuditLog) error {
	log.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO ai_agent_audit_logs (id, tenant_id, agent_id, context, input, output,
		   duration_ms, input_tokens, output_tokens, total_tokens,
		   success, error, created_at)
		 VALUES (:id, :tenantId, :agentId, :context::jsonb, :input::jsonb, :output::jsonb,
		   :durationMs, :inputTokens, :outputTokens, :totalTokens,
		   :success, :error, :createdAt)`,
		log)
	return err
}

func (r *Repository) GetAuditLogs(ctx context.Context, agentID string, tenantID string, limit int) ([]models.AgentAuditLog, error) {
	l := limit
	if l <= 0 || l > 100 {
		l = 100
	}
	var logs []models.AgentAuditLog
	err := r.db.SelectContext(ctx, &logs,
		`SELECT * FROM ai_agent_audit_logs
		 WHERE agent_id=$1 AND tenant_id=$2
		 ORDER BY created_at DESC LIMIT $3`,
		agentID, tenantID, l)
	if err != nil {
		return nil, err
	}
	return logs, nil
}

func (r *Repository) DeleteAuditLogs(ctx context.Context, agentID string, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM ai_agent_audit_logs WHERE agent_id=$1 AND tenant_id=$2`,
		agentID, tenantID)
	return err
}

// --- Stats ---

func (r *Repository) GetAgentStats(ctx context.Context, tenantID string) (*models.AgentStats, error) {
	stats := &models.AgentStats{ByStatus: make(map[models.AgentStatus]int64)}

	var total int64
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM ai_agents WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	stats.Total = total

	var statusRows []struct {
		Status models.AgentStatus `db:"status"`
		Count  int64              `db:"count"`
	}
	err = r.db.SelectContext(ctx, &statusRows,
		`SELECT status, COUNT(*) AS count FROM ai_agents WHERE tenant_id=$1 GROUP BY status`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range statusRows {
		stats.ByStatus[row.Status] = row.Count
	}

	var enabledCount int64
	err = r.db.GetContext(ctx, &enabledCount,
		`SELECT COUNT(*) FROM ai_agents WHERE tenant_id=$1 AND enabled=$2`, tenantID, true)
	if err != nil {
		return nil, err
	}
	stats.EnabledCount = enabledCount

	return stats, nil
}

// ListFilter holds query parameters for listing agents.
type ListFilter struct {
	Status  *string
	Enabled *bool
	Limit   *int
	Offset  *int
	Sort    *string
	Order   *string
}

// sanitizeSortField restricts allowed sort columns.
func sanitizeSortField(s string) string {
	allowed := map[string]bool{
		"created_at": true, "name": true, "status": true,
		"scenario": true, "enabled": true,
	}
	if allowed[s] {
		return s
	}
	return "created_at"
}
