package service

import (
	"context"
	"errors"
	"orion/secret-svc-go/internal/models"
	"orion/secret-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrSecretNotFound = errors.New("secret not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateSecretRequest) (*models.Secret, error) {
	sec := &models.Secret{ID: uuid.New().String(), TenantID: tenantID, Name: req.Name, Value: req.Value, Version: 1, Env: req.Env}
	if sec.Env == "" { sec.Env = "production" }
	return sec, s.repo.Create(ctx, sec)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Secret, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Secret, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}
