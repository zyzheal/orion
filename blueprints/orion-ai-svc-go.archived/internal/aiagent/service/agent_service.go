package service

import (
	"context"
	"errors"
	"time"

	"orion/ai-svc-go/internal/aiagent/models"
	"orion/ai-svc-go/internal/aiagent/repository"

	"github.com/google/uuid"
)

var (
	ErrAgentNotFound = errors.New("agent not found")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// RegisterAgent adds an agent to the in-memory registry.
func (s *Service) RegisterAgent(agent *models.Agent) {
	s.repo.RegisterAgent(agent)
}

// ListAgents returns all registered agents.
func (s *Service) ListAgents() []*models.Agent {
	return s.repo.ListAgents()
}

// GetAgent returns a single agent by ID.
func (s *Service) GetAgent(id string) (*models.Agent, error) {
	agent, ok := s.repo.GetAgent(id)
	if !ok {
		return nil, ErrAgentNotFound
	}
	return agent, nil
}

// ExecuteAgent runs an agent with the given input and records an audit log.
func (s *Service) ExecuteAgent(ctx context.Context, tenantID, agentID string, input map[string]interface{}) (*models.ExecuteResponse, error) {
	agent, ok := s.repo.GetAgent(agentID)
	if !ok {
		return nil, ErrAgentNotFound
	}

	start := time.Now()

	// Simulate agent execution — in production this would call the actual agent logic
	result := map[string]interface{}{
		"agent_id": agent.ID,
		"status":   "completed",
		"message":  "Agent executed successfully",
	}

	duration := time.Since(start).Milliseconds()

	// Record audit log
	auditLog := &models.AgentAuditLogEntry{
		ID:       uuid.New().String(),
		AgentID:  agentID,
		TenantID: tenantID,
		Action:   "execute",
		Input:    input,
		Output:   result,
		Status:   "success",
	}

	if err := s.repo.CreateAuditLog(ctx, auditLog); err != nil {
		return nil, err
	}

	return &models.ExecuteResponse{
		Result:   result,
		Status:   "completed",
		Duration: duration,
	}, nil
}

// GetAuditLogs returns audit logs for a specific agent.
func (s *Service) GetAuditLogs(ctx context.Context, agentID, tenantID string, limit int) ([]models.AgentAuditLogEntry, error) {
	return s.repo.ListAuditLogs(ctx, agentID, tenantID, limit)
}