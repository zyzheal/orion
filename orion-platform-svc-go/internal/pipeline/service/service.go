package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/pipeline/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.CreatePipelineRequest) (*models.Pipeline, error)
	Delete(ctx context.Context, tenantID, id string) (bool, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Pipeline, error)
	GetStats(ctx context.Context, tenantID, pipelineID string) (*models.PipelineStats, error)
	GetVersions(ctx context.Context, tenantID, pipelineID string) ([]models.PipelineVersion, error)
	List(ctx context.Context, tenantID string, opt models.ListPipelinesOptions) ([]models.Pipeline, int, error)
	Update(ctx context.Context, tenantID, id string, req models.UpdatePipelineRequest) (*models.Pipeline, error)
}

var (

	ErrInvalidInput = errors.New("invalid input")
	ErrInvalidState = errors.New("invalid state")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// === CRUD ===

func (s *Service) CreatePipeline(ctx context.Context, tenantID string, req models.CreatePipelineRequest) (*models.Pipeline, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("%w: name is required", ErrInvalidInput)
	}
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) GetPipeline(ctx context.Context, tenantID, id string) (*models.Pipeline, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) ListPipelines(ctx context.Context, tenantID string, opt models.ListPipelinesOptions) ([]models.Pipeline, int, error) {
	return s.repo.List(ctx, tenantID, opt)
}

func (s *Service) UpdatePipeline(ctx context.Context, tenantID, id string, req models.UpdatePipelineRequest) (*models.Pipeline, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) DeletePipeline(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}

// === Validation ===

func (s *Service) ValidatePipeline(ctx context.Context, tenantID string, req models.CreatePipelineRequest) (*models.PipelineValidationResult, error) {
	result := &models.PipelineValidationResult{Valid: true, Errors: []string{}}
	if req.Name == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "name is required")
	}
	if req.ProjectID == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "projectId is required")
	}
	if req.YamlDefinition != "" {
		// Basic YAML validation (would use a real parser in production)
		if len(req.YamlDefinition) > 10000 {
			result.Valid = false
			result.Errors = append(result.Errors, "yamlDefinition exceeds 10KB limit")
		}
	}
	return result, nil
}

// === Runs ===

func (s *Service) StartRun(ctx context.Context, tenantID, id string) (*models.PipelineRunResult, error) {
	pipeline, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if pipeline.Status != models.PipelineStatusActive {
		return nil, fmt.Errorf("%w: pipeline must be active to start", ErrInvalidState)
	}
	// In a real implementation, this would trigger the pipeline engine
	// For now, return a placeholder result
	return &models.PipelineRunResult{
		ID:         fmt.Sprintf("run-%d", time.Now().UnixMilli()),
		PipelineID: id,
		Status:     "pending",
	}, nil
}

func (s *Service) StopRun(ctx context.Context, tenantID, runID string) error {
	// In a real implementation, this would cancel a running pipeline
	return nil
}

// === Batch Operations ===

func (s *Service) BatchStart(ctx context.Context, tenantID string, pipelineIDs []string) ([]models.BatchStartResult, error) {
	results := make([]models.BatchStartResult, 0, len(pipelineIDs))
	for _, pid := range pipelineIDs {
		result, err := s.StartRun(ctx, tenantID, pid)
		if err != nil {
			results = append(results, models.BatchStartResult{
				PipelineID: pid,
				Status:     "error",
				Error:      err.Error(),
			})
			continue
		}
		results = append(results, models.BatchStartResult{
			PipelineID: pid,
			RunID:      result.ID,
			Status:     result.Status,
		})
	}
	return results, nil
}

func (s *Service) BatchStop(ctx context.Context, tenantID string, runIDs []string) ([]models.BatchStopResult, error) {
	results := make([]models.BatchStopResult, 0, len(runIDs))
	for _, rid := range runIDs {
		err := s.StopRun(ctx, tenantID, rid)
		if err != nil {
			// Check if run not found
			results = append(results, models.BatchStopResult{
				ExecutionID: rid,
				Status:      "error",
				Error:       err.Error(),
			})
			continue
		}
		results = append(results, models.BatchStopResult{
			ExecutionID: rid,
			Status:      "stopped",
		})
	}
	return results, nil
}

func (s *Service) BatchDelete(ctx context.Context, tenantID string, pipelineIDs []string) ([]models.BatchDeleteResult, error) {
	results := make([]models.BatchDeleteResult, 0, len(pipelineIDs))
	for _, pid := range pipelineIDs {
		deleted, err := s.DeletePipeline(ctx, tenantID, pid)
		if err != nil {
			results = append(results, models.BatchDeleteResult{
				PipelineID: pid,
				Deleted:    false,
				Error:      err.Error(),
			})
			continue
		}
		results = append(results, models.BatchDeleteResult{
			PipelineID: pid,
			Deleted:    deleted,
		})
	}
	return results, nil
}

// === Stats & Versions ===

func (s *Service) GetStats(ctx context.Context, tenantID, pipelineID string) (*models.PipelineStats, error) {
	return s.repo.GetStats(ctx, tenantID, pipelineID)
}

func (s *Service) GetVersions(ctx context.Context, tenantID, pipelineID string) ([]models.PipelineVersion, error) {
	return s.repo.GetVersions(ctx, tenantID, pipelineID)
}
