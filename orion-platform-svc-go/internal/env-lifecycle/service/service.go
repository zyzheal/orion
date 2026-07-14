package service

import (
	"context"
	"errors"
	"strings"

	"orion/platform-svc-go/internal/env-lifecycle/models"
	"orion/platform-svc-go/internal/env-lifecycle/repository"
)

var (
	ErrNotFound   = errors.New("not found")
	ErrBadRequest = errors.New("bad request")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound) || errors.Is(err, repository.ErrNotFound)
}

func IsBadRequest(err error) bool {
	return errors.Is(err, ErrBadRequest)
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateEnvLifecycleRequest) (*models.EnvLifecycle, error) {
	if req == nil || strings.TrimSpace(req.Name) == "" {
		return nil, ErrBadRequest
	}
	item := &models.EnvLifecycle{
		TenantID: tenantID,
		Name:     req.Name,
	}
	if err := s.repo.Create(ctx, item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.EnvLifecycle, error) {
	item, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return item, nil
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.EnvLifecycle, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateEnvLifecycleRequest) (*models.EnvLifecycle, error) {
	if req == nil {
		return nil, ErrBadRequest
	}
	updates := make(map[string]interface{})
	if req.Name != nil && *req.Name != "" {
		updates["name"] = *req.Name
	}
	updated, err := s.repo.Update(ctx, tenantID, id, updates)
	if err != nil {
		return nil, ErrNotFound
	}
	return updated, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	deleted, err := s.repo.Delete(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}
	return nil
}
