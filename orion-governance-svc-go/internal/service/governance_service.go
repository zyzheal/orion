package service

import (
	"context"
	errors "errors"
	"orion/governance-svc-go/internal/models"
	"orion/governance-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrPolicyNotFound = errors.New("policy not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreatePolicyRequest) (*models.Policy, error) {
	d := &models.Policy{ID: uuid.New().String(), TenantID: tenantID, Name: req.Name}
	return d, s.repo.CreatePolicy(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Policy, error) {
	items, _, err := s.repo.ListPolicies(ctx, tenantID, offset, limit)
	return items, err
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.Policy, error) {
	return s.repo.GetPolicyByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.DeletePolicy(ctx, tenantID, id)
	return err
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	_, total, err := s.repo.ListPolicies(ctx, tenantID, 0, 0)
	return total, err
}
