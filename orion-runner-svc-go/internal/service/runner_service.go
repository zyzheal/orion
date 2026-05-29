package service

import (
	"context"
	errors "errors"
	"orion/runner-svc-go/internal/models"
	"orion/runner-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrRunnerNotFound = errors.New("runner not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateRunnerRequest) (*models.Runner, error) {
	d := &models.Runner{ID: uuid.New().String(), TenantID: tenantID, Name: req.Name}
	return d, s.repo.Create(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Runner, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Runner, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}
