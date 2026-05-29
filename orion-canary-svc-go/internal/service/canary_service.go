package service

import (
	"context"
	"errors"
	"orion/canary-svc-go/internal/models"
	"orion/canary-svc-go/internal/repository"
)

var (
	ErrCanaryNotFound = errors.New("canary not found")
	ErrInvalidStatus  = errors.New("invalid status transition")
)

type CanaryService struct {
	repo *repository.CanaryRepository
}

func NewCanaryService(repo *repository.CanaryRepository) *CanaryService {
	return &CanaryService{repo: repo}
}

func (s *CanaryService) Create(ctx context.Context, c *models.Canary) error {
	if c.Status == "" {
		c.Status = models.CanaryPending
	}
	if c.Weight <= 0 {
		c.Weight = 10
	}
	if c.TargetWeight <= 0 {
		c.TargetWeight = 100
	}
	return s.repo.Create(ctx, c)
}

func (s *CanaryService) GetByID(ctx context.Context, tenantID, id string) (*models.Canary, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *CanaryService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Canary, error) {
	return s.repo.ListByTenant(ctx, tenantID, offset, limit)
}

func (s *CanaryService) Promote(ctx context.Context, tenantID, id string) error {
	canary, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return ErrCanaryNotFound
	}
	if canary.Status != models.CanaryRunning {
		return ErrInvalidStatus
	}
	return s.repo.UpdateStatus(ctx, id, models.CanarySuccess)
}

func (s *CanaryService) Rollback(ctx context.Context, tenantID, id string) error {
	canary, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return ErrCanaryNotFound
	}
	if canary.Status != models.CanaryRunning {
		return ErrInvalidStatus
	}
	return s.repo.UpdateStatus(ctx, id, models.CanaryRolled)
}

func (s *CanaryService) AddMetric(ctx context.Context, m *models.CanaryMetric) error {
	return s.repo.AddMetric(ctx, m)
}

func (s *CanaryService) GetMetrics(ctx context.Context, canaryID string) ([]models.CanaryMetric, error) {
	return s.repo.GetMetrics(ctx, canaryID)
}
