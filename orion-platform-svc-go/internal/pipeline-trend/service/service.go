package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/pipeline-trend/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	GetRunHistoryCompare(ctx context.Context, tenantID string, pipelineIDs []string, period, granularity string) (map[string][]models.TrendEntry, error)
	GetRunHistoryTrend(ctx context.Context, tenantID, pipelineID, period, granularity string) ([]models.TrendEntry, error)
}

// Sentinel errors.
var (
	ErrTrendNotFound      = errors.New("pipeline trend data not found")
	ErrInvalidPeriod      = errors.New("invalid period; must be '7d', '30d', or '90d'")
	ErrInvalidGranularity = errors.New("invalid granularity; must be 'hour', 'day', or 'week'")
	ErrNoPipelineIDs      = errors.New("pipelineIds is required")
	ErrTooManyPipelines   = errors.New("pipelineIds exceeds maximum of 20")
)

// IsNotFound returns true if the error is a not-found sentinel.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrTrendNotFound)
}

// validPeriods is the set of accepted period values.
var validPeriods = map[string]bool{"7d": true, "30d": true, "90d": true}

// validGranularities is the set of accepted granularity values.
var validGranularities = map[string]bool{"hour": true, "day": true, "week": true}

// Service implements pipeline-trend business logic.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// normalizePeriod returns the validated period or the default.
func normalizePeriod(period string) (string, error) {
	if period == "" {
		return "30d", nil
	}
	if !validPeriods[period] {
		return "", fmt.Errorf("%w: %s", ErrInvalidPeriod, period)
	}
	return period, nil
}

// normalizeGranularity returns the validated granularity or the default.
func normalizeGranularity(granularity string) (string, error) {
	if granularity == "" {
		return "day", nil
	}
	if !validGranularities[granularity] {
		return "", fmt.Errorf("%w: %s", ErrInvalidGranularity, granularity)
	}
	return granularity, nil
}

// GetRunHistoryTrend returns trend data for a single pipeline.
func (s *Service) GetRunHistoryTrend(ctx context.Context, tenantID, pipelineID, period, granularity string) (*models.TrendResponse, error) {
	period, err := normalizePeriod(period)
	if err != nil {
		return nil, err
	}
	granularity, err = normalizeGranularity(granularity)
	if err != nil {
		return nil, err
	}

	entries, err := s.repo.GetRunHistoryTrend(ctx, tenantID, pipelineID, period, granularity)
	if err != nil {
		return nil, fmt.Errorf("get run history trend: %w", err)
	}
	if entries == nil {
		entries = []models.TrendEntry{}
	}

	return &models.TrendResponse{
		Data:        entries,
		PipelineID:  pipelineID,
		Period:      period,
		Granularity: granularity,
		Total:       len(entries),
	}, nil
}

// GetRunHistoryCompare returns trend data comparing multiple pipelines.
func (s *Service) GetRunHistoryCompare(ctx context.Context, tenantID string, pipelineIDs []string, period, granularity string) (*models.CompareResponse, error) {
	if len(pipelineIDs) == 0 {
		return nil, ErrNoPipelineIDs
	}
	if len(pipelineIDs) > 20 {
		return nil, ErrTooManyPipelines
	}

	period, err := normalizePeriod(period)
	if err != nil {
		return nil, err
	}
	granularity, err = normalizeGranularity(granularity)
	if err != nil {
		return nil, err
	}

	data, err := s.repo.GetRunHistoryCompare(ctx, tenantID, pipelineIDs, period, granularity)
	if err != nil {
		return nil, fmt.Errorf("get run history compare: %w", err)
	}

	// Ensure each pipeline has at least an empty slice.
	for _, pid := range pipelineIDs {
		if _, ok := data[pid]; !ok {
			data[pid] = []models.TrendEntry{}
		}
	}

	return &models.CompareResponse{
		Data:          data,
		Period:        period,
		Granularity:   granularity,
		PipelineCount: len(pipelineIDs),
	}, nil
}
