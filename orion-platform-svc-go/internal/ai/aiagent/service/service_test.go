package service

import (
	"testing"

	"orion/platform-svc-go/internal/ai/aiagent/models"
	"orion/platform-svc-go/internal/ai/aiagent/repository"
)

// newTestService creates a Service backed by an in-memory agent registry.
// Tests that require DB operations (audit logs) will be skipped.
func newTestService() *Service {
	repo := repository.NewRepository(nil)
	svc := NewService(repo)
	svc.RegisterAgent(&models.Agent{
		ID:     "test-agent-1",
		Status: "active",
		Config: models.AgentConfig{Name: "Test Agent", Type: "test", Enabled: true},
	})
	svc.RegisterAgent(&models.Agent{
		ID:     "test-agent-2",
		Status: "inactive",
		Config: models.AgentConfig{Name: "Agent 2", Type: "test", Enabled: false},
	})
	return svc
}

func TestListAgents(t *testing.T) {
	svc := newTestService()
	agents := svc.ListAgents()
	if len(agents) != 2 {
		t.Errorf("expected 2 agents, got %d", len(agents))
	}
}

func TestGetAgent(t *testing.T) {
	svc := newTestService()
	agent, err := svc.GetAgent("test-agent-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if agent.Config.Name != "Test Agent" {
		t.Errorf("expected 'Test Agent', got '%s'", agent.Config.Name)
	}
	if agent.Config.Type != "test" {
		t.Errorf("expected type 'test', got '%s'", agent.Config.Type)
	}
}

func TestGetAgentNotFound(t *testing.T) {
	svc := newTestService()
	_, err := svc.GetAgent("nonexistent")
	if err != ErrAgentNotFound {
		t.Errorf("expected ErrAgentNotFound, got %v", err)
	}
}

func TestRegisterAgent(t *testing.T) {
	svc := newTestService()
	agent := &models.Agent{
		ID:     "new-agent",
		Status: "active",
		Config: models.AgentConfig{Name: "New Agent", Type: "custom", Enabled: true},
	}
	svc.RegisterAgent(agent)
	got, err := svc.GetAgent("new-agent")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Config.Name != "New Agent" {
		t.Errorf("expected 'New Agent', got '%s'", got.Config.Name)
	}
}

func TestListAgentsEmpty(t *testing.T) {
	repo := repository.NewRepository(nil)
	svc := NewService(repo)
	agents := svc.ListAgents()
	if len(agents) != 0 {
		t.Errorf("expected 0 agents, got %d", len(agents))
	}
}
