package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/ai-agent-run/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository handles all database operations for agent runs and decisions.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository backed by the given sqlx.DB.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---- Runs ----

// CreateRun inserts a new agent run and returns it with the generated id.
func (r *Repository) CreateRun(ctx context.Context, run *models.AgentRun) error {
	run.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO agent_runs (id, tenant_id, agent_profile_id, agent_profile_name,
		   trigger_payload, status, current_step, total_steps, result, error,
		   started_at, completed_at, timeout_at, created_at, updated_at)
		 VALUES (:id, :tenantId, :agentProfileId, :agentProfileName,
		   :triggerPayload::jsonb, :status, :currentStep, :totalSteps, :result::jsonb, :error,
		   :startedAt, :completedAt, :timeoutAt, :createdAt, :updatedAt)`,
		run)
	return err
}

// GetByID retrieves an agent run by its id and tenant id.
func (r *Repository) GetByID(ctx context.Context, id string, tenantID string) (*models.AgentRun, error) {
	var run models.AgentRun
	err := r.db.GetContext(ctx, &run,
		`SELECT * FROM agent_runs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &run, nil
}

// GetByTenant retrieves an agent run by its id scoped to tenant.
func (r *Repository) GetByTenant(ctx context.Context, id string, tenantID string) (*models.AgentRun, error) {
	return r.GetByID(ctx, id, tenantID)
}

// List returns paginated agent runs for the given tenant.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter) ([]models.AgentRun, error) {
	where, args := buildRunWhere(tenantID, filter)
	sortField := sanitizeSortField(filter.Sort)
	sortOrder := "DESC"
	if filter.Order != nil && strings.ToUpper(*filter.Order) == "ASC" {
		sortOrder = "ASC"
	}
	argIdx := len(args) + 1
	where += fmt.Sprintf(" ORDER BY %s %s LIMIT $%d OFFSET $%d", sortField, sortOrder, argIdx, argIdx+1)
	args = append(args, defaultLimit(filter.Limit), defaultOffset(filter.Offset))

	var runs []models.AgentRun
	err := r.db.SelectContext(ctx, &runs, fmt.Sprintf(`SELECT * FROM agent_runs %s`, where), args...)
	return runs, err
}

// Count returns the total number of runs matching the filter for the tenant.
func (r *Repository) Count(ctx context.Context, tenantID string, filter *models.ListFilter) (int64, error) {
	where, args := buildRunWhere(tenantID, filter)
	var total int64
	err := r.db.GetContext(ctx, &total, fmt.Sprintf(`SELECT COUNT(*) FROM agent_runs %s`, where), args...)
	return total, err
}

// UpdateStatus updates the status of a run, optionally setting completed_at.
func (r *Repository) UpdateStatus(ctx context.Context, id string, tenantID string, status models.AgentRunStatus, completedAt *int64) (*models.AgentRun, error) {
	now := fmt.Sprintf("EXTRACT(EPOCH FROM now())::bigint")
	query := "UPDATE agent_runs SET status=$1, updated_at=" + now
	args := []interface{}{status}

	if completedAt != nil {
		argIdx := len(args) + 2
		args = append(args, *completedAt, id, tenantID)
		query += fmt.Sprintf(", completed_at=$%d WHERE id=$%d AND tenant_id=$%d", argIdx-2, argIdx-1, argIdx)
	} else {
		argIdx := len(args) + 2
		args = append(args, id, tenantID)
		query += fmt.Sprintf(" WHERE id=$%d AND tenant_id=$%d", argIdx-1, argIdx)
	}

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sql.ErrNoRows
	}
	return r.GetByID(ctx, id, tenantID)
}

// UpdateStep advances the current step of a run.
func (r *Repository) UpdateStep(ctx context.Context, id string, tenantID string, step int) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE agent_runs SET current_step=$1, updated_at=EXTRACT(EPOCH FROM now())::bigint
		 WHERE id=$2 AND tenant_id=$3`,
		step, id, tenantID)
	return err
}

// CancelRun sets the run status to cancelled with a completed_at.
func (r *Repository) CancelRun(ctx context.Context, id string, tenantID string) (*models.AgentRun, error) {
	return r.UpdateStatus(ctx, id, tenantID, models.AgentRunStatusCancelled, nil)
}

// ---- Decisions ----

// CreateDecision inserts a decision record and returns it.
func (r *Repository) CreateDecision(ctx context.Context, d *models.AgentDecision) error {
	d.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO agent_decisions (id, run_id, agent_id, step_number, action,
		   action_input, action_output, reasoning, tool_result, error, created_at)
		 VALUES (:id, :runId, :agentId, :stepNumber, :action,
		   :actionInput::jsonb, :actionOutput::jsonb, :reasoning, :toolResult::jsonb, :error, :createdAt)`,
		d)
	return err
}

// GetDecisionsByRunID returns all decisions for a run, ordered by step_number.
func (r *Repository) GetDecisionsByRunID(ctx context.Context, runID string, tenantID string) ([]models.AgentDecision, error) {
	var decisions []models.AgentDecision
	err := r.db.SelectContext(ctx, &decisions,
		`SELECT d.* FROM agent_decisions d
		 JOIN agent_runs r ON r.id = d.run_id
		 WHERE d.run_id=$1 AND r.tenant_id=$2
		 ORDER BY d.step_number ASC`,
		runID, tenantID)
	return decisions, err
}

// ---- Approvals ----

// CreateApproval inserts an approval request.
func (r *Repository) CreateApproval(ctx context.Context, a *models.AgentApproval) error {
	a.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO agent_approvals (id, run_id, agent_id, action, action_input, reason, status,
		   approved_by, approved_at, rejection_reason, created_at)
		 VALUES (:id, :runId, :agentId, :action, :actionInput::jsonb, :reason, :status,
		   :approvedBy, :approvedAt, :rejectionReason, :createdAt)`,
		a)
	return err
}

// GetApprovalsByRunID returns approvals for a given run.
func (r *Repository) GetApprovalsByRunID(ctx context.Context, runID string, tenantID string) ([]models.AgentApproval, error) {
	var approvals []models.AgentApproval
	err := r.db.SelectContext(ctx, &approvals,
		`SELECT a.* FROM agent_approvals a
		 JOIN agent_runs r ON r.id = a.run_id
		 WHERE a.run_id=$1 AND r.tenant_id=$2
		 ORDER BY a.created_at DESC`,
		runID, tenantID)
	return approvals, err
}

// ---- Stats ----

// GetStats returns aggregated run statistics for a tenant.
func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.AgentRunStats, error) {
	stats := &models.AgentRunStats{ByStatus: make(map[models.AgentRunStatus]int64)}

	var total int64
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM agent_runs WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	stats.Total = total

	var statusRows []struct {
		Status models.AgentRunStatus `db:"status"`
		Count  int64                 `db:"count"`
	}
	err = r.db.SelectContext(ctx, &statusRows,
		`SELECT status, COUNT(*) AS count FROM agent_runs WHERE tenant_id=$1 GROUP BY status`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range statusRows {
		stats.ByStatus[row.Status] = row.Count
	}

	stats.Running = stats.ByStatus[models.AgentRunStatusRunning]
	stats.Completed = stats.ByStatus[models.AgentRunStatusCompleted]
	stats.Failed = stats.ByStatus[models.AgentRunStatusFailed]
	stats.Cancelled = stats.ByStatus[models.AgentRunStatusCancelled]
	stats.WaitingApproval = stats.ByStatus[models.AgentRunStatusWaitingAppro]

	return stats, nil
}

// ---- Helpers ----

func buildRunWhere(tenantID string, filter *models.ListFilter) (string, []interface{}) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil && filter.AgentProfileID != nil && *filter.AgentProfileID != "" {
		where += fmt.Sprintf(" AND agent_profile_id = $%d", argIdx)
		args = append(args, *filter.AgentProfileID)
		argIdx++
	}
	if filter != nil && filter.Status != nil && *filter.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *filter.Status)
		argIdx++
	}
	return where, args
}

func defaultLimit(p *int) int {
	if p != nil && *p > 0 {
		return *p
	}
	return 20
}

func defaultOffset(p *int) int {
	if p != nil && *p > 0 {
		return *p
	}
	return 0
}

func sanitizeSortField(p *string) string {
	if p == nil || *p == "" {
		return "started_at"
	}
	allowed := map[string]bool{
		"started_at": true, "status": true, "agent_profile_id": true,
		"agent_profile_name": true, "created_at": true, "id": true,
	}
	if allowed[*p] {
		return *p
	}
	return "started_at"
}
