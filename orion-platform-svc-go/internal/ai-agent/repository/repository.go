package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ai-agent/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, m *models.Agent) error {
	m.ID = uuid.New().String()
	m.Status = "active"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO agent (id, tenant_id, name, model, prompt, status, created_by, created_at, updated_at) VALUES (:id, :tenant_id, :name, :model, :prompt, :status, :created_by, NOW(), NOW())`,
		m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Agent, error) {
	var m models.Agent
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM agent WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, q models.ListAgentsQuery) ([]models.Agent, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	return r.buildAgentList(ctx, tenantID, q.Name, q.Status, q.Limit, q.Offset)
}

func (r *Repository) Count(ctx context.Context, tenantID string, q models.ListAgentsQuery) (int, error) {
	return r.buildAgentCount(ctx, tenantID, q.Name, q.Status)
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	updates["updated_at"] = time.Now().UTC()
	fields := make([]string, 0, len(updates))
	for k := range updates {
		fields = append(fields, fmt.Sprintf("%s = :%s", k, k))
	}
	sql := fmt.Sprintf(`UPDATE agent SET %s WHERE id=$1 AND tenant_id=$2`, joinStrings(fields, ", "))
	args := map[string]interface{}{
		"id":        id,
		"tenant_id": tenantID,
	}
	for k, v := range updates {
		args[k] = v
	}
	_, err := r.db.NamedExecContext(ctx, sql, args)
	return err
}

func (r *Repository) SoftDelete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE agent SET deleted_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) CreateRun(ctx context.Context, run *models.AgentRun) error {
	run.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO agent_run (id, agent_id, input, output, status, created_by, created_at, updated_at) VALUES (:id, :agent_id, :input, :output, :status, :created_by, NOW(), NOW())`,
		run)
	return err
}

func (r *Repository) ListRuns(ctx context.Context, tenantID, agentID string, limit, offset int) ([]models.AgentRun, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.AgentRun
	err := r.db.SelectContext(ctx, &items,
		`SELECT ar.* FROM agent_run ar JOIN agent a ON ar.agent_id = a.id WHERE a.tenant_id=$1 AND ar.agent_id=$2 AND ar.deleted_at IS NULL ORDER BY ar.created_at DESC LIMIT $3 OFFSET $4`,
		tenantID, agentID, limit, offset)
	return items, err
}

func (r *Repository) CountRuns(ctx context.Context, tenantID, agentID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM agent_run ar JOIN agent a ON ar.agent_id = a.id WHERE a.tenant_id=$1 AND ar.agent_id=$2 AND ar.deleted_at IS NULL`,
		tenantID, agentID)
	return count, err
}

// buildAgentList dynamically builds the SELECT query for agent listing.
func (r *Repository) buildAgentList(ctx context.Context, tenantID, name, status string, limit, offset int) ([]models.Agent, error) {
	var args []interface{}
	idx := 1
	where := fmt.Sprintf("tenant_id=$%d", idx)
	args = append(args, tenantID)
	idx++
	if name != "" {
		where += fmt.Sprintf(" AND name=$%d", idx)
		args = append(args, name)
		idx++
	}
	if status != "" {
		where += fmt.Sprintf(" AND status=$%d", idx)
		args = append(args, status)
		idx++
	}
	where += " AND deleted_at IS NULL"
	query := fmt.Sprintf("SELECT * FROM agent WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", where, idx, idx+1)
	args = append(args, limit, offset)
	var items []models.Agent
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// buildAgentCount dynamically builds the COUNT query for agent listing.
func (r *Repository) buildAgentCount(ctx context.Context, tenantID, name, status string) (int, error) {
	var args []interface{}
	idx := 1
	where := fmt.Sprintf("tenant_id=$%d", idx)
	args = append(args, tenantID)
	idx++
	if name != "" {
		where += fmt.Sprintf(" AND name=$%d", idx)
		args = append(args, name)
		idx++
	}
	if status != "" {
		where += fmt.Sprintf(" AND status=$%d", idx)
		_ = status // ensure used
		args = append(args, status)
		idx++
	}
	where += " AND deleted_at IS NULL"
	query := fmt.Sprintf("SELECT COUNT(*) FROM agent WHERE %s", where)
	var count int
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

func joinStrings(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	result := parts[0]
	for _, p := range parts[1:] {
		result += sep + p
	}
	return result
}
