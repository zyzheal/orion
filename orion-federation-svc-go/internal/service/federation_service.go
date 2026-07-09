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
	status := "pending"
	if req.Status != "" {
		status = req.Status
	}
	d := &models.FederatedCluster{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		Name:     req.Name,
		PeerURL:  req.PeerURL,
		Protocol: req.Protocol,
		Status:   status,
		Config:   req.Config,
	}
	return d, s.repo.Create(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.FederatedCluster, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.FederatedCluster, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateFederatedClusterRequest) (*models.FederatedCluster, error) {
	d, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	d.Name = req.Name
	d.PeerURL = req.PeerURL
	d.Protocol = req.Protocol
	d.Status = req.Status
	if req.Config != nil {
		d.Config = req.Config
	}
	if err := s.repo.Update(ctx, d); err != nil {
		return nil, err
	}
	return d, nil
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}
