package service

import (
	"context"
	errors "errors"
	"orion/platform-svc-go/internal/ai/intelligence/models"
	"orion/platform-svc-go/internal/ai/intelligence/repository"
	"time"

	"github.com/google/uuid"
)

var ErrIntelligenceTaskNotFound = errors.New("task not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateIntelligenceTaskRequest) (*models.IntelligenceTask, error) {
	d := &models.IntelligenceTask{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Name:        req.Name,
		InsightType: req.InsightType,
		Source:      req.Source,
		Data:        req.Data,
		Status:      "pending",
		CreatedAt:   time.Now(),
	}
	return d, s.repo.Create(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.IntelligenceTask, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.IntelligenceTask, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}
