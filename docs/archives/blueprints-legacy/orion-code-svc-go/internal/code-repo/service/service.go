package service

import (
	"context"
	"github.com/orion/code-svc/internal/code-repo/repository"
)

type CodeRepoService interface {
	List(ctx context.Context) (interface{}, error)
	Create(ctx context.Context, name, url, provider, token string) (interface{}, error)
	Get(ctx context.Context, id string) (interface{}, error)
	Update(ctx context.Context, id string, data interface{}) error
	Delete(ctx context.Context, id string) error
}

type codeRepoServiceImpl struct {
	Repo repository.CodeRepoRepository
}

func NewCodeRepoService(repo repository.CodeRepoRepository) CodeRepoService {
	return &codeRepoServiceImpl{Repo: repo}
}

func (s *codeRepoServiceImpl) List(ctx context.Context) (interface{}, error) {
	return s.Repo.List(ctx)
}

func (s *codeRepoServiceImpl) Create(ctx context.Context, name, url, provider, token string) (interface{}, error) {
	return s.Repo.Create(ctx, name, url, provider, token)
}

func (s *codeRepoServiceImpl) Get(ctx context.Context, id string) (interface{}, error) {
	return s.Repo.Get(ctx, id)
}

func (s *codeRepoServiceImpl) Update(ctx context.Context, id string, data interface{}) error {
	return s.Repo.Update(ctx, id, data)
}

func (s *codeRepoServiceImpl) Delete(ctx context.Context, id string) error {
	return s.Repo.Delete(ctx, id)
}
