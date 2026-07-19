package service

import (
	"context"

	"orion/platform-svc-go/internal/data-pipeline/models"
	"orion/platform-svc-go/internal/data-pipeline/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) RunPipeline(ctx context.Context, tenantID, id string) error {
	return nil
}

func (s *Service) GetStatus(ctx context.Context, tenantID, id string) (string, error) {
	return "running", nil
}

func (s *Service) Pause(ctx context.Context, tenantID, id string) error {
	return nil
}

func (s *Service) Resume(ctx context.Context, tenantID, id string) error {
	return nil
}

func (s *Service) GetLogs(ctx context.Context, tenantID, id string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) ListSchemas(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) GetLineage(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	return map[string]interface{}{}, nil
}