package service

import (
	"context"
	errors "errors"
	"orion/lowcode-svc-go/internal/models"
	"orion/lowcode-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrLowCodeAppNotFound = errors.New("app not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateLowCodeAppRequest) (*models.LowCodeApp, error) {
	d := &models.LowCodeApp{ID: uuid.New().String(), TenantID: tenantID, Name: req.Name}
	return d, s.repo.Create(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.LowCodeApp, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.LowCodeApp, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}
