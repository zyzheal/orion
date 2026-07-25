package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/agent-svc-go/internal/agent/models"
)

// AgentRepository interface
type AgentRepository interface {
	Register(ctx context.Context, name, agentType, version, tags, tenantID string) (*models.Agent, error)
	List(ctx context.Context, tenantID string) ([]models.Agent, error)
	Get(ctx context.Context, id string) (*models.Agent, error)
	Update(ctx context.Context, id string, name, status, version, tags string) error
	Delete(ctx context.Context, id string) error
	Heartbeat(ctx context.Context, id string) error
	ListRuns(ctx context.Context, agentID string, limit int) ([]models.AgentRun, error)
	CreateRun(ctx context.Context, agentID, task string, input string) (*models.AgentRun, error)
	UpdateRun(ctx context.Context, runID, status string, output string) error
}

type agentRepositoryImpl struct {
	DB *sql.DB
}

func NewAgentRepository(db *sql.DB) AgentRepository {
	return &agentRepositoryImpl{DB: db}
}

func (r *agentRepositoryImpl) Register(ctx context.Context, name, agentType, version, tags, tenantID string) (*models.Agent, error) {
	now := time.Now()
	var id int64
	err := r.DB.QueryRowContext(ctx, `
		INSERT INTO agents (name, type, version, tags, tenant_id, status, last_seen, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'registered', $6, $7, $8)
		RETURNING id`, name, agentType, version, tags, tenantID, now, now, now).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("register agent: %w", err)
	}
	return &models.Agent{
		ID:        id,
		Name:      name,
		Type:      agentType,
		Version:   version,
		Status:    "registered",
		Tags:      tags,
		TenantID:  tenantID,
		LastSeen:  now,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func (r *agentRepositoryImpl) List(ctx context.Context, tenantID string) ([]models.Agent, error) {
	query := `SELECT id, name, type, version, status, tags, tenant_id, last_seen, created_at, updated_at FROM agents`
	args := []interface{}{}
	argIdx := 1
	if tenantID != "" {
		query += fmt.Sprintf(" WHERE tenant_id = $%d", argIdx)
		args = append(args, tenantID)
		argIdx++
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list agents: %w", err)
	}
	defer rows.Close()

	var agents []models.Agent
	for rows.Next() {
		var a models.Agent
		if err := rows.Scan(&a.ID, &a.Name, &a.Type, &a.Version, &a.Status, &a.Tags, &a.TenantID, &a.LastSeen, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan agent: %w", err)
		}
		agents = append(agents, a)
	}
	return agents, nil
}

func (r *agentRepositoryImpl) Get(ctx context.Context, id string) (*models.Agent, error) {
	var a models.Agent
	err := r.DB.QueryRowContext(ctx, `
		SELECT id, name, type, version, status, tags, tenant_id, last_seen, created_at, updated_at
		FROM agents WHERE id = $1`, id).Scan(
		&a.ID, &a.Name, &a.Type, &a.Version, &a.Status, &a.Tags, &a.TenantID, &a.LastSeen, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("agent not found: %s", id)
		}
		return nil, fmt.Errorf("get agent: %w", err)
	}
	return &a, nil
}

func (r *agentRepositoryImpl) Update(ctx context.Context, id string, name, status, version, tags string) error {
	now := time.Now()
	query := `UPDATE agents SET updated_at = $1`
	args := []interface{}{now}
	argIdx := 2
	if name != "" {
		query += fmt.Sprintf(", name = $%d", argIdx)
		args = append(args, name)
		argIdx++
	}
	if status != "" {
		query += fmt.Sprintf(", status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if version != "" {
		query += fmt.Sprintf(", version = $%d", argIdx)
		args = append(args, version)
		argIdx++
	}
	if tags != "" {
		query += fmt.Sprintf(", tags = $%d", argIdx)
		args = append(args, tags)
		argIdx++
	}
	query += fmt.Sprintf(" WHERE id = $%d", argIdx)
	args = append(args, id)

	result, err := r.DB.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("update agent: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("agent not found: %s", id)
	}
	return nil
}

func (r *agentRepositoryImpl) Delete(ctx context.Context, id string) error {
	result, err := r.DB.ExecContext(ctx, `DELETE FROM agents WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete agent: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("agent not found: %s", id)
	}
	return nil
}

func (r *agentRepositoryImpl) Heartbeat(ctx context.Context, id string) error {
	now := time.Now()
	result, err := r.DB.ExecContext(ctx, `
		UPDATE agents SET last_seen = $1, status = 'active', updated_at = $2
		WHERE id = $3`, now, now, id)
	if err != nil {
		return fmt.Errorf("heartbeat: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("agent not found: %s", id)
	}
	return nil
}

func (r *agentRepositoryImpl) ListRuns(ctx context.Context, agentID string, limit int) ([]models.AgentRun, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.DB.QueryContext(ctx, `
		SELECT id, agent_id, task_id, status, output, started_at, finished_at
		FROM agent_runs
		WHERE agent_id = $1
		ORDER BY started_at DESC
		LIMIT $2`, agentID, limit)
	if err != nil {
		return nil, fmt.Errorf("list runs: %w", err)
	}
	defer rows.Close()

	var runs []models.AgentRun
	for rows.Next() {
		var r models.AgentRun
		var finishedAt sql.NullTime
		if err := rows.Scan(&r.ID, &r.AgentID, &r.TaskID, &r.Status, &r.Output, &r.StartedAt, &finishedAt); err != nil {
			return nil, fmt.Errorf("scan run: %w", err)
		}
		if finishedAt.Valid {
			r.FinishedAt = &finishedAt.Time
		}
		runs = append(runs, r)
	}
	return runs, nil
}

func (r *agentRepositoryImpl) CreateRun(ctx context.Context, agentID, task string, input string) (*models.AgentRun, error) {
	now := time.Now()
	var id int64
	err := r.DB.QueryRowContext(ctx, `
		INSERT INTO agent_runs (agent_id, task_id, status, output, started_at, finished_at)
		VALUES ($1, $2, 'pending', $3, $4, NULL)
		RETURNING id`, agentID, task, input, now).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("create run: %w", err)
	}
	return &models.AgentRun{
		ID:        id,
		AgentID:   agentID,
		TaskID:    task,
		Status:    "pending",
		StartedAt: now,
	}, nil
}

func (r *agentRepositoryImpl) UpdateRun(ctx context.Context, runID, status string, output string) error {
	now := time.Now()
	var finishedAt interface{}
	if status == "completed" || status == "failed" {
		finishedAt = now
	}
	_, err := r.DB.ExecContext(ctx, `
		UPDATE agent_runs SET status = $1, output = $2, finished_at = $3
		WHERE id = $4`, status, output, finishedAt, runID)
	return err
}

// Ensure interface compliance
var _ AgentRepository = (*agentRepositoryImpl)(nil)
