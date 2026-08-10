package service

import (
	"context"

	"orion/platform-svc-go/internal/global-search/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) GetConfig(ctx context.Context, module string) (*repository.SearchConfig, error) { return s.repo.GetConfig(ctx, module) }
func (s *Service) UpsertConfig(ctx context.Context, cfg *repository.SearchConfig) error { return s.repo.UpsertConfig(ctx, cfg) }
func (s *Service) ListConfigs(ctx context.Context) ([]*repository.SearchConfig, error) { return s.repo.ListConfigs(ctx) }
func (s *Service) GetStatus(ctx context.Context, module string) (*repository.IndexerStatusRecord, error) { return s.repo.GetStatus(ctx, module) }
func (s *Service) UpdateStatus(ctx context.Context, rec *repository.IndexerStatusRecord) error { return s.repo.UpdateStatus(ctx, rec) }
