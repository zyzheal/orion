package service

import (
	"context"
	errors "errors"
	"orion/security-svc-go/internal/models"
	"orion/security-svc-go/internal/repository"
	"github.com/google/uuid"
)

var ErrSecurityScanNotFound = errors.New("scan not found")

type Service struct { repo *repository.Repository }
func NewService(repo *repository.Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateScanRequest) (*models.SecurityScan, error) {
	d := &models.SecurityScan{
		ID:       uuid.New().String(),
		TenantID: tenantID,
		ScanType: req.ScanType,
		Target:   req.Target,
		Scanner:  req.Scanner,
		Status:   "pending",
	}
	return d, s.repo.CreateScan(ctx, d)
}

func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.SecurityScan, error) {
	return s.repo.ListScans(ctx, tenantID, offset, limit)
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.SecurityScan, error) {
	return s.repo.GetScanByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteScan(ctx, tenantID, id)
}

func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountScans(ctx, tenantID)
}
