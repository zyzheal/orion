package service

import (
	"context"
	"errors"
	"math"
	"time"

	"orion/platform-svc-go/internal/ai-cost/models"
	"orion/platform-svc-go/internal/ai-cost/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, record *models.CostRecord) (*models.CostRecord, error)
	DeleteByID(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.CostRecord, error)
	GetDailyCosts(ctx context.Context, tenantID string, since time.Time) ([]repository.DailyCost, error)
	GetSummary(ctx context.Context, tenantID string, f models.CostFilter) (*models.CostSummary, error)
	GetTopModelsByCost(ctx context.Context, tenantID string, limit int) ([]repository.ModelCost, error)
	List(ctx context.Context, tenantID string, f models.CostFilter) ([]models.CostRecord, error)
}

var (

	ErrBadRequest = errors.New("invalid request")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// RecordCost records an AI usage cost entry with validation.
func (s *Service) RecordCost(ctx context.Context, tenantID string, record *models.CostRecord) (*models.CostRecord, error) {
	if record.ModelID == "" {
		return nil, ErrBadRequest
	}
	if record.PromptTokens < 0 || record.CompletionTokens < 0 {
		return nil, ErrBadRequest
	}
	if record.Cost < 0 {
		return nil, ErrBadRequest
	}
	if record.CreatedAt.IsZero() {
		record.CreatedAt = time.Now().UTC()
	}
	// Round cost to 6 decimal places
	record.Cost = roundTo(record.Cost, 6)
	return s.repo.Create(ctx, tenantID, record)
}

// GetCostRecord retrieves a cost record by ID.
func (s *Service) GetCostRecord(ctx context.Context, tenantID, id string) (*models.CostRecord, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// ListCostRecords returns cost records with optional filtering.
func (s *Service) ListCostRecords(ctx context.Context, tenantID string, f models.CostFilter) ([]models.CostRecord, error) {
	return s.repo.List(ctx, tenantID, f)
}

// GetCostSummary computes cost aggregates for a tenant.
func (s *Service) GetCostSummary(ctx context.Context, tenantID string, f models.CostFilter) (*models.CostSummary, error) {
	return s.repo.GetSummary(ctx, tenantID, f)
}

// GetDailyCosts returns cost breakdown by day for a date range.
func (s *Service) GetDailyCosts(ctx context.Context, tenantID string, days int) ([]models.DailyCost, error) {
	if days <= 0 || days > 365 {
		days = 30
	}
	since := time.Now().UTC().AddDate(0, 0, -days)
	dbRows, err := s.repo.GetDailyCosts(ctx, tenantID, since)
	if err != nil {
		return nil, err
	}
	rows := make([]models.DailyCost, len(dbRows))
	for i, r := range dbRows {
		rows[i] = models.DailyCost{Date: r.Date, Total: r.Cost, Records: r.Records}
	}
	return rows, nil
}

// GetTopModelsByCost returns models sorted by total cost (descending).
func (s *Service) GetTopModelsByCost(ctx context.Context, tenantID string, limit int) ([]models.ModelCost, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	dbRows, err := s.repo.GetTopModelsByCost(ctx, tenantID, limit)
	if err != nil {
		return nil, err
	}
	rows := make([]models.ModelCost, len(dbRows))
	for i, r := range dbRows {
		rows[i] = models.ModelCost{Model: r.Model, Total: r.Cost, Records: r.Records}
	}
	return rows, nil
}

// DeleteCostRecord soft-deletes a cost record.
func (s *Service) DeleteCostRecord(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteByID(ctx, tenantID, id)
}

// roundTo rounds a float64 to the given number of decimal places.
func roundTo(val float64, decimals int) float64 {
	m := math.Pow(10, float64(decimals))
	return math.Round(val*m) / m
}
