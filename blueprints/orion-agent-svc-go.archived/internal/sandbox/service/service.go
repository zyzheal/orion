package service

import "context"

type SandboxService interface {
	Create(ctx context.Context, agentID, image string) (interface{}, error)
	Execute(ctx context.Context, id, command string) (interface{}, error)
	GetStatus(ctx context.Context, id string) (interface{}, error)
	Destroy(ctx context.Context, id string) error
}

type sandboxServiceImpl struct{}

func NewSandboxService() SandboxService {
	return &sandboxServiceImpl{}
}

func (s *sandboxServiceImpl) Create(ctx context.Context, agentID, image string) (interface{}, error) { return nil, nil }
func (s *sandboxServiceImpl) Execute(ctx context.Context, id, command string) (interface{}, error) { return nil, nil }
func (s *sandboxServiceImpl) GetStatus(ctx context.Context, id string) (interface{}, error) { return nil, nil }
func (s *sandboxServiceImpl) Destroy(ctx context.Context, id string) error { return nil }
