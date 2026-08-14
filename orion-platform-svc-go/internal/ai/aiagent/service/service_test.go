package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/ai/aiagent/models"
)

type fakeAiAgentRepo struct {
	agents    map[string]*models.Agent
	auditLogs []models.AgentAuditLogEntry
}

func (f *fakeAiAgentRepo) RegisterAgent(agent *models.Agent) {
	if f.agents == nil {
		f.agents = make(map[string]*models.Agent)
	}
	f.agents[agent.ID] = agent
}

func (f *fakeAiAgentRepo) GetAgent(id string) (*models.Agent, bool) {
	a, ok := f.agents[id]
	return a, ok
}

func (f *fakeAiAgentRepo) ListAgents() []*models.Agent {
	result := make([]*models.Agent, 0, len(f.agents))
	for _, a := range f.agents {
		result = append(result, a)
	}
	return result
}

func (f *fakeAiAgentRepo) CreateAuditLog(ctx context.Context, log *models.AgentAuditLogEntry) error {
	f.auditLogs = append(f.auditLogs, *log)
	return nil
}

func (f *fakeAiAgentRepo) ListAuditLogs(ctx context.Context, agentID, tenantID string, limit int) ([]models.AgentAuditLogEntry, error) {
	return f.auditLogs, nil
}

var _ RepositoryInterface = (*fakeAiAgentRepo)(nil)

func TestListAgents(t *testing.T) {
	repo := &fakeAiAgentRepo{}
	svc := NewService(repo)
	if svc == nil {
		t.Fatal("NewService returned nil")
	}
	agents := svc.ListAgents()
	if agents == nil {
		t.Fatal("expected non-nil agents list")
	}
}

func TestGetAgent(t *testing.T) {
	repo := &fakeAiAgentRepo{
		agents: map[string]*models.Agent{
			"a1": {
				ID:       "a1",
				TenantID: "tenant-1",
				Config:   models.AgentConfig{Name: "test-agent"},
				Status:   "active",
			},
		},
	}
	svc := NewService(repo)
	agent, err := svc.GetAgent("a1")
	if err != nil {
		t.Fatal(err)
	}
	if agent == nil || agent.ID != "a1" {
		t.Fatal("expected agent a1")
	}
}

func TestGetAgentNotFound(t *testing.T) {
	repo := &fakeAiAgentRepo{}
	svc := NewService(repo)
	_, err := svc.GetAgent("missing")
	if err == nil {
		t.Fatal("expected error for missing agent")
	}
}

func TestRegisterAgent(t *testing.T) {
	repo := &fakeAiAgentRepo{}
	svc := NewService(repo)
	svc.RegisterAgent(&models.Agent{
		ID:       "new-1",
		TenantID: "tenant-1",
		Config:   models.AgentConfig{Name: "new-agent"},
		Status:   "active",
	})
	if len(repo.agents) != 1 {
		t.Fatalf("expected 1 agent, got %d", len(repo.agents))
	}
}

func TestListAgentsEmpty(t *testing.T) {
	repo := &fakeAiAgentRepo{}
	svc := NewService(repo)
	agents := svc.ListAgents()
	if len(agents) != 0 {
		t.Fatalf("expected 0 agents, got %d", len(agents))
	}
}
