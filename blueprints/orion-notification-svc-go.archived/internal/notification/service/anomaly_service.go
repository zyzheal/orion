package service

import (
	"context"
	"fmt"

	"orion/notification-svc-go/internal/notification/models"
	"orion/notification-svc-go/internal/notification/repository"

	"go.uber.org/zap"
)

// ErrAnomalyNotFound is returned when an anomaly lookup fails.
var ErrAnomalyNotFound = fmt.Errorf("anomaly not found")

// AnomalyService provides business logic for anomaly detection records.
type AnomalyService struct {
	repo   *repository.AnomalyRepository
	logger *zap.Logger
}

// NewAnomalyService creates a new AnomalyService.
func NewAnomalyService(repo *repository.AnomalyRepository, logger *zap.Logger) *AnomalyService {
	return &AnomalyService{repo: repo, logger: logger}
}

// CreateAnomaly creates a new anomaly record.
func (s *AnomalyService) CreateAnomaly(ctx context.Context, tenantID string, a *models.Anomaly) error {
	a.TenantID = tenantID
	return s.repo.CreateAnomaly(ctx, a)
}

// GetAnomaly returns an anomaly by id.
func (s *AnomalyService) GetAnomaly(ctx context.Context, tenantID, id string) (*models.Anomaly, error) {
	a, err := s.repo.GetAnomalyByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrAnomalyNotFound
	}
	return a, nil
}

// ListAnomalies returns anomalies for a tenant with optional filters.
func (s *AnomalyService) ListAnomalies(ctx context.Context, tenantID string, opts models.ListAnomaliesQuery) ([]models.Anomaly, int, error) {
	return s.repo.ListAnomalies(ctx, tenantID, opts)
}

// UpdateStatus updates the status of an anomaly (e.g., open -> resolved).
func (s *AnomalyService) UpdateStatus(ctx context.Context, tenantID, id, status string) error {
	// Verify anomaly exists first
	_, err := s.repo.GetAnomalyByID(ctx, tenantID, id)
	if err != nil {
		return ErrAnomalyNotFound
	}
	if err := s.repo.UpdateStatus(ctx, tenantID, id, status); err != nil {
		return ErrAnomalyNotFound
	}
	return nil
}

// CountByType returns anomaly counts grouped by type.
func (s *AnomalyService) CountByType(ctx context.Context, tenantID string) (map[string]int, error) {
	return s.repo.CountByType(ctx, tenantID)
}
