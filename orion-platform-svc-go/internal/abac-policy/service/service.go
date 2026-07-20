package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"

	"orion/platform-svc-go/internal/abac-policy/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, policy *models.ABACPolicy) error
	Delete(ctx context.Context, tenantID, id string) (bool, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.ABACPolicy, error)
	List(ctx context.Context, tenantID string, filter *models.ABACPolicyFilter) ([]models.ABACPolicy, int, error)
	Update(ctx context.Context, tenantID, id string, name, status *string, conditions map[string]string) (*models.ABACPolicy, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateABACPolicyRequest) (*models.ABACPolicy, error) {
	policy := &models.ABACPolicy{
		TenantID:     tenantID,
		Name:         req.Name,
		Description:  req.Description,
		ResourceType: req.ResourceType,
		Action:       req.Action,
		Effect:       req.Effect,
		Conditions:   req.Conditions,
		Status:       "active",
	}
	if err := s.repo.Create(ctx, policy); err != nil {
		return nil, err
	}
	return policy, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.ABACPolicy, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) List(ctx context.Context, tenantID string, filter *models.ABACPolicyFilter) ([]models.ABACPolicy, int, error) {
	return s.repo.List(ctx, tenantID, filter)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateABACPolicyRequest) (*models.ABACPolicy, error) {
	return s.repo.Update(ctx, tenantID, id, req.Name, req.Status, req.Conditions)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}
