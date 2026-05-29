package service

import (
	"context"
	errors "errors"
	"orion/federation-svc-go/internal/models"
	"orion/federation-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrFederatedClusterNotFound = errors.New("cluster not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateFederatedClusterRequest) (*models.FederatedCluster, error) {
	d := &models.FederatedCluster{ID: uuid.New().String(), TenantID: tenantID, Name: req.Name}
	return d, s.repo.Create(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.FederatedCluster, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.FederatedCluster, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}
