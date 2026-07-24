package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/environment/models"
	"orion/platform-svc-go/internal/environment/repository"

	"github.com/google/uuid"
)

var (
	ErrEnvironmentNotFound = models.ErrEnvironmentNotFound
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID, createdBy string, req *models.CreateEnvironmentRequest) (*models.Environment, error) {
	now := time.Now()
	env := &models.Environment{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		ProjectID:   req.ProjectID,
		Status:      "active",
		Locked:      false,
		CreatedBy:   createdBy,
		UpdatedBy:   createdBy,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.Create(ctx, env); err != nil {
		return nil, err
	}
	return env, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Environment, error) {
	env, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrEnvironmentNotFound
	}
	return env, nil
}

func (s *Service) List(ctx context.Context, tenantID, projectID string) ([]models.Environment, error) {
	return s.repo.List(ctx, tenantID, projectID)
}

func (s *Service) Update(ctx context.Context, tenantID, id, updatedBy string, req *models.UpdateEnvironmentRequest) (*models.Environment, error) {
	env, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrEnvironmentNotFound
	}
	if req.Name != nil {
		env.Name = *req.Name
	}
	if req.Description != nil {
		env.Description = *req.Description
	}
	if req.Status != nil {
		env.Status = *req.Status
	}
	env.UpdatedBy = updatedBy
	env.UpdatedAt = time.Now()
	if err := s.repo.Update(ctx, env); err != nil {
		return nil, err
	}
	return env, nil
}

func (s *Service) UpdateStatus(ctx context.Context, tenantID, id, status string) (*models.Environment, error) {
	env, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrEnvironmentNotFound
	}
	if err := s.repo.UpdateStatus(ctx, tenantID, id, status); err != nil {
		return nil, err
	}
	env.Status = status
	return env, nil
}

func (s *Service) Lock(ctx context.Context, tenantID, id string) (*models.Environment, error) {
	env, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrEnvironmentNotFound
	}
	if err := s.repo.SetLock(ctx, tenantID, id, true); err != nil {
		return nil, err
	}
	env.Locked = true
	return env, nil
}

func (s *Service) Unlock(ctx context.Context, tenantID, id string) (*models.Environment, error) {
	env, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrEnvironmentNotFound
	}
	if err := s.repo.SetLock(ctx, tenantID, id, false); err != nil {
		return nil, err
	}
	env.Locked = false
	return env, nil
}

func (s *Service) GetLockStatus(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.GetLockStatus(ctx, tenantID, id)
}

func (s *Service) CheckDeploymentAllowed(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.CheckDeploymentAllowed(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}