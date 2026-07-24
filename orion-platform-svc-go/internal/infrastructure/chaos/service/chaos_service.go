package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/infrastructure/chaos/models"
	"orion/platform-svc-go/internal/infrastructure/chaos/repository"
	"orion/go-common/pkg/otel"
)

var (
	ErrExperimentNotFound = errors.New("experiment not found")
	ErrInvalidStatus      = errors.New("invalid status transition")
)

// ChaosService provides business logic for chaos experiments.
type ChaosService struct {
	repo *repository.ChaosRepository
}

func NewChaosService(repo *repository.ChaosRepository) *ChaosService {
	return &ChaosService{repo: repo}
}

// CreateExperiment creates a new chaos experiment.
func (s *ChaosService) CreateExperiment(ctx context.Context, tenantID string, input *models.CreateExperimentInput) (*models.ChaosExperiment, error) {
	ctx, span := otel.Tracer("orion-chaos-svc").Start(ctx, "ChaosService.CreateExperiment")
	defer span.End()

	now := time.Now().UTC()
	exp := &models.ChaosExperiment{
		ID:          fmt.Sprintf("chaos-%d", now.UnixNano()),
		TenantID:    tenantID,
		Name:        input.Name,
		Status:      models.ExpDraft,
		AutoRollback: true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if input.Description != nil {
		exp.Description = sql.NullString{String: *input.Description, Valid: true}
	}
	if input.SteadyStateHypothesis != nil {
		exp.SteadyStateHypothesis = sql.NullString{String: *input.SteadyStateHypothesis, Valid: true}
	}
	if input.CreatedBy != nil {
		exp.CreatedBy = sql.NullString{String: *input.CreatedBy, Valid: true}
	}
	if input.AutoRollback != nil {
		exp.AutoRollback = *input.AutoRollback
	}

	// Convert input faults
	for _, f := range input.Faults {
		exp.Faults = append(exp.Faults, f)
	}

	if err := s.repo.Create(ctx, exp); err != nil {
		return nil, err
	}

	return exp, nil
}

// GetExperiment retrieves a single experiment.
func (s *ChaosService) GetExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error) {
	ctx, span := otel.Tracer("orion-chaos-svc").Start(ctx, "ChaosService.GetExperiment")
	defer span.End()
	return s.repo.GetByID(ctx, tenantID, id)
}

// ListExperiments retrieves paginated experiments.
func (s *ChaosService) ListExperiments(ctx context.Context, tenantID string, page, pageSize int) ([]models.ChaosExperiment, error) {
	ctx, span := otel.Tracer("orion-chaos-svc").Start(ctx, "ChaosService.ListExperiments")
	defer span.End()

	offset := (page - 1) * pageSize
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	return s.repo.ListByTenant(ctx, tenantID, offset, pageSize)
}

// UpdateStatus updates the experiment status.
func (s *ChaosService) UpdateStatus(ctx context.Context, tenantID, id string, status models.ExperimentStatus) error {
	ctx, span := otel.Tracer("orion-chaos-svc").Start(ctx, "ChaosService.UpdateStatus")
	defer span.End()

	exp, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return err
	}

	// Validate status transition
	switch exp.Status {
	case models.ExpDraft:
		if status != models.ExpActive && status != models.ExpArchived {
			return ErrInvalidStatus
		}
	case models.ExpActive:
		if status != models.ExpCompleted && status != models.ExpArchived {
			return ErrInvalidStatus
		}
	default:
		return ErrInvalidStatus
	}

	return s.repo.UpdateStatus(ctx, tenantID, id, status)
}

// DeleteExperiment removes an experiment.
func (s *ChaosService) DeleteExperiment(ctx context.Context, tenantID, id string) error {
	ctx, span := otel.Tracer("orion-chaos-svc").Start(ctx, "ChaosService.DeleteExperiment")
	defer span.End()
	return s.repo.Delete(ctx, tenantID, id)
}
