package service

import (
	"context"
	"errors"
	"orion/config-mgmt-svc-go/internal/models"
	"orion/config-mgmt-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrConfigNotFound = errors.New("config item not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateConfigRequest) (*models.ConfigItem, error) {
	c := &models.ConfigItem{ID: uuid.New().String(), TenantID: tenantID, Key: req.Key, Value: req.Value, Environment: req.Env, Version: 1}
	if c.Environment == "" { c.Environment = "production" }
	return c, s.repo.Create(ctx, c)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.ConfigItem, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) Update(ctx context.Context, tenantID, id, value string) (*models.ConfigItem, error) {
	c, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil { return nil, ErrConfigNotFound }
	c.Value = value
	return c, s.repo.Update(ctx, c)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}
