package repository

import (
	"context"
	"orion/platform-svc-go/internal/ai-agents/models"
)


// RepositoryInterface defines the data access contract for the ai-agents module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateAgent(ctx context.Context, a *models.AIAgent) error
	GetByID(ctx context.Context, id string, tenantID string) (*models.AIAgent, error)
	List(ctx context.Context, tenantID string, filter *ListFilter) ([]models.AIAgent, error)
	Count(ctx context.Context, tenantID string, filter *ListFilter) (int64, error)
	UpdateAgent(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.AIAgent, error)
	UpdateAgentStatus(ctx context.Context, id string, tenantID string, status models.AgentStatus) (*models.AIAgent, error)
	Delete(ctx context.Context, id string, tenantID string) (bool, error)
	CreateAuditLog(ctx context.Context, log *models.AgentAuditLog) error
	GetAuditLogs(ctx context.Context, agentID string, tenantID string, limit int) ([]models.AgentAuditLog, error)
	DeleteAuditLogs(ctx context.Context, agentID string, tenantID string) error
	GetAgentStats(ctx context.Context, tenantID string) (*models.AgentStats, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
