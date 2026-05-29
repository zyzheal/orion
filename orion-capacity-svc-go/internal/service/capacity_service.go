package service

import (
	"context"
	"errors"
	"orion/capacity-svc-go/internal/models"
	"orion/capacity-svc-go/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrPoolNotFound    = errors.New("resource pool not found")
	ErrPolicyNotFound  = errors.New("scaling policy not found")
	ErrForecastNotFound = errors.New("capacity forecast not found")
)

type Service struct {
	poolRepo     *repository.PoolRepository
	forecastRepo *repository.ForecastRepository
	policyRepo   *repository.PolicyRepository
}

func NewService(poolRepo *repository.PoolRepository, forecastRepo *repository.ForecastRepository, policyRepo *repository.PolicyRepository) *Service {
	return &Service{poolRepo: poolRepo, forecastRepo: forecastRepo, policyRepo: policyRepo}
}

func (s *Service) CreatePool(ctx context.Context, tenantID string, req *models.CreatePoolRequest) (*models.ResourcePool, error) {
	pool := &models.ResourcePool{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Name:         req.Name,
		ResourceType: req.ResourceType,
		TotalCPU:     req.TotalCPU,
		TotalMemory:  req.TotalMemory,
		NodeCount:    req.NodeCount,
		Labels:       req.Labels,
	}
	if err := s.poolRepo.Create(ctx, pool); err != nil { return nil, err }
	return pool, nil
}

func (s *Service) ListPools(ctx context.Context, tenantID string, offset, limit int) ([]models.ResourcePool, error) {
	return s.poolRepo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetPool(ctx context.Context, tenantID, id string) (*models.ResourcePool, error) {
	return s.poolRepo.GetByID(ctx, tenantID, id)
}

func (s *Service) UpdatePool(ctx context.Context, tenantID, id string, req *models.CreatePoolRequest) (*models.ResourcePool, error) {
	pool, err := s.poolRepo.GetByID(ctx, tenantID, id)
	if err != nil { return nil, ErrPoolNotFound }
	pool.Name = req.Name
	pool.ResourceType = req.ResourceType
	pool.TotalCPU = req.TotalCPU
	pool.TotalMemory = req.TotalMemory
	pool.NodeCount = req.NodeCount
	pool.Labels = req.Labels
	if err := s.poolRepo.Update(ctx, pool); err != nil { return nil, err }
	return pool, nil
}

func (s *Service) ListForecasts(ctx context.Context, tenantID string, offset, limit int) ([]models.CapacityForecast, error) {
	return s.forecastRepo.List(ctx, tenantID, offset, limit)
}

func (s *Service) CreatePolicy(ctx context.Context, tenantID string, req *models.CreatePolicyRequest) (*models.ScalingPolicy, error) {
	policy := &models.ScalingPolicy{
		ID:                 uuid.New().String(),
		TenantID:           tenantID,
		Name:               req.Name,
		ResourceType:       req.ResourceType,
		MinReplicas:        req.MinReplicas,
		MaxReplicas:        req.MaxReplicas,
		ScaleUpThreshold:   req.ScaleUpThreshold,
		ScaleDownThreshold: req.ScaleDownThreshold,
		CooldownSec:        req.CooldownSec,
		Enabled:            true,
	}
	if err := s.policyRepo.Create(ctx, policy); err != nil { return nil, err }
	return policy, nil
}

func (s *Service) ListPolicies(ctx context.Context, tenantID string) ([]models.ScalingPolicy, error) {
	return s.policyRepo.List(ctx, tenantID)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}
