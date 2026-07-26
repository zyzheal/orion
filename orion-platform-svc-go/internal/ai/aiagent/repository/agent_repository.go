package repository

import (
	"context"
	"orion/platform-svc-go/internal/ai/aiagent/models"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/google/uuid"
)

type Repository struct {
	db *sqlx.DB
	// In-memory agent registry (mirrors TS agentRegistry pattern)
	mu     sync.RWMutex
	agents map[string]*models.Agent
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		db:     db,
		agents: make(map[string]*models.Agent),
	}
}

// ---------- Agent Registry (in-memory) ----------

func (r *Repository) RegisterAgent(agent *models.Agent) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.agents[agent.ID] = agent
}

func (r *Repository) GetAgent(id string) (*models.Agent, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	a, ok := r.agents[id]
	return a, ok
}

func (r *Repository) ListAgents() []*models.Agent {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]*models.Agent, 0, len(r.agents))
	for _, a := range r.agents {
		result = append(result, a)
	}
	return result
}

// ---------- Audit Logs (DB-backed) ----------

func (r *Repository) CreateAuditLog(ctx context.Context, log *models.AgentAuditLogEntry) error {
	if log.ID == "" {
		log.ID = uuid.New().String()
	}
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now()
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO ai_agent_audit_logs (id, agent_id, tenant_id, action, input, output, status, error, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		log.ID, log.AgentID, log.TenantID, log.Action, log.Input, log.Output, log.Status, log.Error, log.CreatedAt)
	return err
}

func (r *Repository) ListAuditLogs(ctx context.Context, agentID, tenantID string, limit int) ([]models.AgentAuditLogEntry, error) {
	var logs []models.AgentAuditLogEntry
	err := r.db.SelectContext(ctx, &logs,
		`SELECT * FROM ai_agent_audit_logs WHERE agent_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT $3`,
		agentID, tenantID, limit)
	return logs, err
}