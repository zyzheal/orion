package service

import (
	"context"

	"orion/platform-svc-go/internal/apk-upload-history/models"
	"orion/platform-svc-go/internal/apk-upload-history/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetRecord(ctx context.Context, tenantID, id string) (*models.ApkUploadRecord, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) ListRecords(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ApkUploadRecord, int, error) {
	return s.repo.List(ctx, tenantID, q)
}

func (s *Service) RecentFailures(ctx context.Context, tenantID string) ([]models.ApkUploadRecord, error) {
	return s.repo.RecentFailures(ctx, tenantID)
}

func (s *Service) CreateRecord(ctx context.Context, tenantID string, record *models.ApkUploadRecord) (*models.ApkUploadRecord, error) {
	return s.repo.Create(ctx, tenantID, record)
}
