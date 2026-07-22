package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/project/models"
	"orion/platform-svc-go/internal/project/repository"

	"github.com/google/uuid"
)

var ErrProjectNotFound = models.ErrProjectNotFound

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID, createdBy string, req *models.CreateProjectRequest) (*models.Project, error) {
	now := time.Now()
	p := &models.Project{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		CreatedBy:   createdBy,
		UpdatedBy:   createdBy,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.Create(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Project, error) {
	p, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrProjectNotFound
	}
	return p, nil
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Project, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id, updatedBy string, req *models.UpdateProjectRequest) (*models.Project, error) {
	p, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrProjectNotFound
	}
	if req.Name != nil {
		p.Name = *req.Name
	}
	if req.Description != nil {
		p.Description = *req.Description
	}
	p.UpdatedBy = updatedBy
	p.UpdatedAt = time.Now()
	if err := s.repo.Update(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}
