package service

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/ai-agent/models"
	"orion/platform-svc-go/internal/ai-agent/repository"
)

var ErrNotFound = errors.New("agent not found")

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateAgentRequest) (*models.Agent, error) {
	m := &models.Agent{
		TenantID: tenantID,
		Name:     req.Name,
		Model:    req.Model,
		Prompt:   req.Prompt,
		Status:   "active",
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Agent, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, q models.ListAgentsQuery) (*models.AgentListResponse, error) {
	agents, err := s.repo.List(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	total, err := s.repo.Count(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	if agents == nil {
		agents = []models.Agent{}
	}
	return &models.AgentListResponse{Agents: agents, Total: total}, nil
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateAgentRequest) (*models.Agent, error) {
	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Model != "" {
		updates["model"] = req.Model
	}
	if req.Prompt != "" {
		updates["prompt"] = req.Prompt
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.SoftDelete(ctx, tenantID, id)
}

func (s *Service) Run(ctx context.Context, tenantID, agentID string, req models.RunAgentRequest) (*models.AgentRun, error) {
	agent, err := s.repo.GetByID(ctx, tenantID, agentID)
	if err != nil {
		return nil, ErrNotFound
	}
	if agent.Status != "active" {
		return nil, errors.New("agent is not active")
	}
	run := &models.AgentRun{
		AgentID: agentID,
		Input:   req.Input,
		Status:  "completed",
	}
	if err := s.repo.CreateRun(ctx, run); err != nil {
		return nil, err
	}
	return run, nil
}

func (s *Service) ListRuns(ctx context.Context, tenantID, agentID string, limit, offset int) ([]models.AgentRun, error) {
	runs, err := s.repo.ListRuns(ctx, tenantID, agentID, limit, offset)
	if err != nil {
		return nil, err
	}
	if runs == nil {
		runs = []models.AgentRun{}
	}
	return runs, nil
}
