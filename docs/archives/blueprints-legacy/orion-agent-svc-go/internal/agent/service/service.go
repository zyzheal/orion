package service

import (
	"context"
	"github.com/orion/agent-svc/internal/agent/repository"
)

type AgentService interface {
	Register(ctx context.Context, name, agentType, version, tags string) (interface{}, error)
	List(ctx context.Context) (interface{}, error)
	Get(ctx context.Context, id string) (interface{}, error)
	Update(ctx context.Context, id string, data interface{}) error
	Delete(ctx context.Context, id string) error
	Heartbeat(ctx context.Context, id string) error
	ListRuns(ctx context.Context, agentID string) (interface{}, error)
}

type agentServiceImpl struct {
	Repo repository.AgentRepository
}

func NewAgentService(repo repository.AgentRepository) AgentService {
	return &agentServiceImpl{Repo: repo}
}

func (s *agentServiceImpl) Register(ctx context.Context, name, agentType, version, tags string) (interface{}, error) {
	return s.Repo.Register(ctx, name, agentType, version, tags)
}

func (s *agentServiceImpl) List(ctx context.Context) (interface{}, error) {
	return s.Repo.List(ctx)
}

func (s *agentServiceImpl) Get(ctx context.Context, id string) (interface{}, error) {
	return s.Repo.Get(ctx, id)
}

func (s *agentServiceImpl) Update(ctx context.Context, id string, data interface{}) error {
	return s.Repo.Update(ctx, id, data)
}

func (s *agentServiceImpl) Delete(ctx context.Context, id string) error {
	return s.Repo.Delete(ctx, id)
}

func (s *agentServiceImpl) Heartbeat(ctx context.Context, id string) error {
	return s.Repo.Heartbeat(ctx, id)
}

func (s *agentServiceImpl) ListRuns(ctx context.Context, agentID string) (interface{}, error) {
	return s.Repo.ListRuns(ctx, agentID)
}
