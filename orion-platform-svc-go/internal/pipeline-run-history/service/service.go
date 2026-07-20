package service

import (
	"context"
	"errors"

	"orion/platform-svc-go/internal/pipeline-run-history/models"
	"orion/platform-svc-go/internal/pipeline-run-history/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CountRunHistory(ctx context.Context, pipelineID string, tenantID string) (int, error)
	GetRunHistory(ctx context.Context, pipelineID string, tenantID string, period string, limit int) ([]models.RunHistoryEntry, error)
}

// Repository defines the data access contract needed by Service.
type Repository interface {
	GetRunHistory(ctx context.Context, pipelineID string, tenantID string, period string, limit int) ([]models.RunHistoryEntry, error)
	CountRunHistory(ctx context.Context, pipelineID string, tenantID string) (int, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// validPeriods holds the allowed period values.
var validPeriods = map[string]bool{
	"day":   true,
	"week":  true,
	"month": true,
}

// GetRunHistory retrieves pipeline run history aggregated by the given period.
func (s *Service) GetRunHistory(ctx context.Context, pipelineID string, tenantID string, period string, limit int) (*models.RunHistoryResponse, error) {
	if !validPeriods[period] {
		return nil, ErrInvalidPeriod
	}
	if limit < 1 || limit > 365 {
		return nil, ErrInvalidLimit
	}

	entries, err := s.repo.GetRunHistory(ctx, pipelineID, tenantID, period, limit)
	if err != nil {
		return nil, err
	}
	if entries == nil {
		entries = []models.RunHistoryEntry{}
	}

	count, err := s.repo.CountRunHistory(ctx, pipelineID, tenantID)
	if err != nil {
		return nil, err
	}

	return &models.RunHistoryResponse{
		Entries:    entries,
		PipelineID: pipelineID,
		Period:     period,
		TotalCount: count,
	}, nil
}

// --- Errors ---

var (
	ErrInvalidPeriod = errors.New("invalid period, must be day, week, or month")
	ErrInvalidLimit  = errors.New("limit must be between 1 and 365")
)

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}
