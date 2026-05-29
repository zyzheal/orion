package service

import (
	"context"
	errors "errors"
	"orion/cron-svc-go/internal/models"
	"orion/cron-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrCronJobNotFound = errors.New("cron job not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateCronJobRequest) (*models.CronJob, error) {
	j := &models.CronJob{ID: uuid.New().String(), TenantID: tenantID, Name: req.Name, Schedule: req.Schedule, Command: req.Command, Enabled: true}
	return j, s.repo.Create(ctx, j)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.CronJob, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.CronJob, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}
