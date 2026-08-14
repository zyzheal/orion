package service

import (
	"context"

	"orion/platform-svc-go/internal/ai/aiagent/models"
	"orion/platform-svc-go/internal/ai/aiagent/repository"
)

// RepositoryInterface abstracts data access for AI agents.
type RepositoryInterface interface {
	RegisterAgent(agent *models.Agent)
	GetAgent(id string) (*models.Agent, bool)
	ListAgents() []*models.Agent
	CreateAuditLog(ctx context.Context, log *models.AgentAuditLogEntry) error
	ListAuditLogs(ctx context.Context, agentID, tenantID string, limit int) ([]models.AgentAuditLogEntry, error)
}

// compile-time check that *repository.Repository satisfies the interface
var _ RepositoryInterface = (*repository.Repository)(nil)
