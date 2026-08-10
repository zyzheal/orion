package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/ai/aiagent/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

type agentRow struct {
	ID        string    `db:"id"`
	TenantID  string    `db:"tenant_id"`
	Name      string    `db:"name"`
	Enabled   bool      `db:"enabled"`
	Status    string    `db:"status"`
	Metadata  string    `db:"metadata"`
	CreatedAt time.Time `db:"created_at"`
}

func (r *Repository) RegisterAgent(agent *models.Agent) {
	if agent.ID == "" {
		agent.ID = uuid.New().String()
	}
	if agent.CreatedAt.IsZero() {
		agent.CreatedAt = time.Now().UTC()
	}
	metadata, _ := json.Marshal(agent.Config)
	_, _ = r.db.ExecContext(context.Background(), `
		INSERT INTO agents (id, tenant_id, name, enabled, status, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		ON CONFLICT (id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id, name=EXCLUDED.name, enabled=EXCLUDED.enabled,
			status=EXCLUDED.status, metadata=EXCLUDED.metadata, updated_at=NOW()`,
		agent.ID, agent.TenantID, agent.Config.Name, agent.Config.Enabled, agent.Status, string(metadata), agent.CreatedAt)
}

func (r *Repository) GetAgent(id string) (*models.Agent, bool) {
	var row agentRow
	err := r.db.GetContext(context.Background(), &row,
		`SELECT id, tenant_id, name, enabled, status, metadata, created_at FROM agents WHERE id=$1`, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, false
	}
	if err != nil {
		return nil, false
	}
	return rowToAgent(&row), true
}

func (r *Repository) ListAgents() []*models.Agent {
	var rows []agentRow
	err := r.db.SelectContext(context.Background(), &rows,
		`SELECT id, tenant_id, name, enabled, status, metadata, created_at FROM agents ORDER BY created_at DESC`)
	if err != nil {
		return []*models.Agent{}
	}
	agents := make([]*models.Agent, len(rows))
	for i := range rows {
		agents[i] = rowToAgent(&rows[i])
	}
	return agents
}

func rowToAgent(row *agentRow) *models.Agent {
	agent := &models.Agent{
		ID:        row.ID,
		TenantID:  row.TenantID,
		Status:    row.Status,
		CreatedAt: row.CreatedAt,
	}
	if row.Metadata != "" {
		_ = json.Unmarshal([]byte(row.Metadata), &agent.Config)
	}
	return agent
}

// ---------- Audit Logs (DB-backed) ----------

func (r *Repository) CreateAuditLog(ctx context.Context, log *models.AgentAuditLogEntry) error {
	if log.ID == "" {
		log.ID = uuid.New().String()
	}
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now()
	}
	inputJSON, _ := json.Marshal(log.Input)
	outputJSON, _ := json.Marshal(log.Output)
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO agent_audit_logs (id, agent_id, tenant_id, input, output, success, error, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		log.ID, log.AgentID, log.TenantID, string(inputJSON), string(outputJSON),
		log.Status == "success", log.Error, log.CreatedAt)
	return err
}

func (r *Repository) ListAuditLogs(ctx context.Context, agentID, tenantID string, limit int) ([]models.AgentAuditLogEntry, error) {
	var logs []models.AgentAuditLogEntry
	err := r.db.SelectContext(ctx, &logs,
		`SELECT * FROM agent_audit_logs WHERE agent_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT $3`,
		agentID, tenantID, limit)
	return logs, err
}