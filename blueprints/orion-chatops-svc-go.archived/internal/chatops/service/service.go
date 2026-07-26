package service

import (
	"context"
	"fmt"

	"github.com/orion/chatops-svc/internal/chatops/repository"
)

type ChatOpsService interface {
	ExecuteCommand(ctx context.Context, command, args string) (interface{}, error)
	ListMessages(ctx context.Context) (interface{}, error)
	SendMessage(ctx context.Context, platform, channel, content string) error
	ListConversations(ctx context.Context) (interface{}, error)
	ListPlatforms(ctx context.Context) (interface{}, error)
	RegisterPlatform(ctx context.Context, name, platformType, config string) error
}

type chatOpsServiceImpl struct {
	Repo repository.ChatOpsRepository
}

func NewChatOpsService(repo repository.ChatOpsRepository) ChatOpsService {
	return &chatOpsServiceImpl{Repo: repo}
}

func (s *chatOpsServiceImpl) ExecuteCommand(ctx context.Context, command, args string) (interface{}, error) {
	return s.Repo.ExecuteCommand(ctx, command, args)
}

func (s *chatOpsServiceImpl) ListMessages(ctx context.Context) (interface{}, error) {
	return s.Repo.ListMessages(ctx)
}

func (s *chatOpsServiceImpl) SendMessage(ctx context.Context, platform, channel, content string) error {
	return s.Repo.SendMessage(ctx, platform, channel, content)
}

func (s *chatOpsServiceImpl) ListConversations(ctx context.Context) (interface{}, error) {
	return s.Repo.ListConversations(ctx)
}

func (s *chatOpsServiceImpl) ListPlatforms(ctx context.Context) (interface{}, error) {
	return s.Repo.ListPlatforms(ctx)
}

func (s *chatOpsServiceImpl) RegisterPlatform(ctx context.Context, name, platformType, config string) error {
	return s.Repo.RegisterPlatform(ctx, name, platformType, config)
}
