package service

import (
	"context"
	errors "errors"
	"orion/feature-flag-svc-go/internal/models"
	"orion/feature-flag-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrFlagNotFound = errors.New("feature flag not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateFlagRequest) (*models.FeatureFlag, error) {
	f := &models.FeatureFlag{
		ID: uuid.New().String(), TenantID: tenantID, Name: req.Name, Key: req.Key,
		Description: req.Description, Enabled: req.Enabled, RolloutPct: req.RolloutPct, Environment: req.Environment,
	}
	if f.Environment == "" { f.Environment = "production" }
	if f.RolloutPct == 0 { f.RolloutPct = 100 }
	return f, s.repo.Create(ctx, f)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.FeatureFlag, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.FeatureFlag, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.CreateFlagRequest) (*models.FeatureFlag, error) {
	f, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil { return nil, ErrFlagNotFound }
	f.Name = req.Name; f.Description = req.Description; f.Enabled = req.Enabled; f.RolloutPct = req.RolloutPct
	return f, s.repo.Update(ctx, f)
}
