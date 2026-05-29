package service

import (
	"context"
	errors "errors"
	"orion/plugin-svc-go/internal/models"
	"orion/plugin-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrPluginNotFound = errors.New("plugin not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreatePluginRequest) (*models.Plugin, error) {
	d := &models.Plugin{ID: uuid.New().String(), TenantID: tenantID, Name: req.Name}
	return d, s.repo.Create(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Plugin, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Plugin, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}
