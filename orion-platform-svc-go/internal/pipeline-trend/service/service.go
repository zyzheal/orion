package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/pipeline-trend/models"
	repoPkg "orion/platform-svc-go/internal/pipeline-trend/repository"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	// CRUD
	Create(ctx context.Context, trend *models.PipelineTrend) error
	GetByID(ctx context.Context, tenantID, id string) (*models.PipelineTrend, error)
	GetAll(ctx context.Context, tenantID string) ([]models.PipelineTrend, error)
	Update(ctx context.Context, trend *models.PipelineTrend) error
	Delete(ctx context.Context, tenantID, id string) error

	// Trend aggregation
	GetRunHistoryCompare(ctx context.Context, tenantID string, pipelineIDs []string, period, granularity string) (map[string][]models.TrendEntry, error)
	GetRunHistoryTrend(ctx context.Context, tenantID, pipelineID, period, granularity string) ([]models.TrendEntry, error)
	GetTrendByPipeline(ctx context.Context, tenantID, pipelineID string) ([]models.PipelineTrend, error)
}

// Sentinel errors.
var (
	// ErrTrendNotFound re-exports the repository-level sentinel so that
	// handler-layer IsNotFound checks continue to work.
	ErrTrendNotFound      = repoPkg.ErrTrendNotFound
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

// -----------------------------------------------------------------------
// CRUD operations
// -----------------------------------------------------------------------

// Create persists a new PipelineTrend.
func (s *Service) Create(ctx context.Context, tenantID string, trend *models.PipelineTrend) error {
	if trend.TenantID == "" {
		trend.TenantID = tenantID
	}
	return s.repo.Create(ctx, trend)
}

// GetByID retrieves a PipelineTrend by its id within a tenant.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.PipelineTrend, error) {
	if id == "" {
		return nil, ErrTrendNotFound
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

// GetAll returns all PipelineTrend records for a tenant.
func (s *Service) GetAll(ctx context.Context, tenantID string) ([]models.PipelineTrend, error) {
	trends, err := s.repo.GetAll(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("get all trends: %w", err)
	}
	return trends, nil
}

// Update modifies an existing PipelineTrend.
func (s *Service) Update(ctx context.Context, tenantID string, trend *models.PipelineTrend) error {
	if trend.TenantID == "" {
		trend.TenantID = tenantID
	}
	return s.repo.Update(ctx, trend)
}

// Delete removes a PipelineTrend by id within a tenant.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	if id == "" {
		return ErrTrendNotFound
	}
	return s.repo.Delete(ctx, tenantID, id)
}

// -----------------------------------------------------------------------
// Trend aggregation
// -----------------------------------------------------------------------

// GetTrendByPipeline returns all PipelineTrend records for a given pipeline
// scoped to a tenant.
func (s *Service) GetTrendByPipeline(ctx context.Context, tenantID, pipelineID string) ([]models.PipelineTrend, error) {
	trends, err := s.repo.GetTrendByPipeline(ctx, tenantID, pipelineID)
	if err != nil {
		return nil, fmt.Errorf("get trend by pipeline: %w", err)
	}
	if trends == nil {
		trends = []models.PipelineTrend{}
	}
	return trends, nil
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
