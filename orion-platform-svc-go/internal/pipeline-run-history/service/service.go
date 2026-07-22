package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/pipeline-run-history/models"
	"orion/platform-svc-go/internal/pipeline-run-history/repository"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	GetRunHistoryWithCount(ctx context.Context, pipelineID string, tenantID string, period string, limit int) ([]models.RunHistoryEntry, int, error)
}

// Repository defines the data access contract needed by Service.
type Repository interface {
	GetRunHistoryWithCount(ctx context.Context, pipelineID string, tenantID string, period string, limit int) ([]models.RunHistoryEntry, int, error)
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

	entries, count, err := s.repo.GetRunHistoryWithCount(ctx, pipelineID, tenantID, period, limit)
	if err != nil {
		return nil, err
	}
	if entries == nil {
		entries = []models.RunHistoryEntry{}
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
	return errors.Is(err, sentinel.NotFound) || errors.Is(err, repository.ErrNotFound)
}
