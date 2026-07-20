package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

	"orion/platform-svc-go/internal/alert-breaker/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, a *models.AlertBreaker) error
	Delete(ctx context.Context, tenantID, id string) (bool, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.AlertBreaker, error)
	List(ctx context.Context, tenantID string) ([]models.AlertBreaker, int, error)
	Update(ctx context.Context, tenantID, id string, fields map[string]interface{}) (*models.AlertBreaker, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateAlertBreakerRequest) (*models.AlertBreaker, error) {
	a := &models.AlertBreaker{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		AlertID:     req.AlertID,
		Rule:        req.Rule,
		Status:      "active",
	}
	if err := s.repo.Create(ctx, a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.AlertBreaker, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.AlertBreaker, int, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateAlertBreakerRequest) (*models.AlertBreaker, error) {
	fields := make(map[string]interface{})
	if req.Name != nil {
		fields["name"] = *req.Name
	}
	if req.Description != nil {
		fields["description"] = *req.Description
	}
	if req.Status != nil {
		fields["status"] = *req.Status
	}
	if req.Rule != nil {
		fields["rule"] = req.Rule
	}
	return s.repo.Update(ctx, tenantID, id, fields)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}
