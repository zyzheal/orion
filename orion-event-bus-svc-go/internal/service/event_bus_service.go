package service

import (
	"context"
	errors "errors"
	"orion/event-bus-svc-go/internal/models"
	"orion/event-bus-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrEventTopicNotFound = errors.New("topic not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateEventTopicRequest) (*models.EventTopic, error) {
	d := &models.EventTopic{ID: uuid.New().String(), TenantID: tenantID, Name: req.Name}
	return d, s.repo.Create(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.EventTopic, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.EventTopic, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}
