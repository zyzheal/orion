package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"orion/platform-svc-go/internal/pipeline-batch-operations/models"
	pipeline_models "orion/platform-svc-go/internal/pipeline/models"
	"fmt"

	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	FinalizeOperationRequest(ctx context.Context, id string, tenantID string) error
	RecordBatchDelete(ctx context.Context, req *models.BatchDeleteRequest, tenantID string) (string, error)
	RecordBatchStart(ctx context.Context, req *models.BatchStartRequest, tenantID string) (string, error)
	RecordBatchStop(ctx context.Context, req *models.BatchStopRequest, tenantID string) (string, error)
}

// PipelineServiceInterface defines the pipeline service methods used by the batch operations service.
type PipelineServiceInterface interface {
	StartRun(ctx context.Context, tenantID, id string) (*pipeline_models.PipelineRunResult, error)
	StopRun(ctx context.Context, tenantID, runID string) error
	DeletePipeline(ctx context.Context, tenantID, id string) (bool, error)
}

// MaxBatchSize is the maximum number of items allowed in a batch operation.
const MaxBatchSize = 50

// Service coordinates batch pipeline operations.
type Service struct {
	repo            RepositoryInterface
	pipelineService PipelineServiceInterface
}

func NewService(repo RepositoryInterface, pipelineService PipelineServiceInterface) *Service {
	return &Service{
		repo:            repo,
		pipelineService: pipelineService,
	}
}

// BatchStart starts a batch of pipelines.
func (s *Service) BatchStart(ctx context.Context, req *models.BatchStartRequest, tenantID string) (*models.BatchOperationResponse, error) {
	if err := validateBatch(req.PipelineIDs, "pipeline"); err != nil {
		return nil, err
	}

	opID, err := s.repo.RecordBatchStart(ctx, req, tenantID)
	if err != nil {
		return nil, err
	}

	results := make([]models.BatchOperationResult, len(req.PipelineIDs))
	for i, id := range req.PipelineIDs {
		result, err := s.pipelineService.StartRun(ctx, tenantID, id)
		if err != nil {
			results[i] = models.BatchOperationResult{
				ID:     id,
				Status: "error",
				Error:  strPtr(err.Error()),
			}
		} else {
			status := "started"
			if result != nil && result.Status != "" {
				status = result.Status
			}
			results[i] = models.BatchOperationResult{
				ID:     id,
				Status: status,
			}
		}
	}

	_ = s.repo.FinalizeOperationRequest(ctx, opID, tenantID)

	return buildResponse(results, req.PipelineIDs), nil
}

// BatchStop stops a batch of pipeline runs.
func (s *Service) BatchStop(ctx context.Context, req *models.BatchStopRequest, tenantID string) (*models.BatchOperationResponse, error) {
	if err := validateBatch(req.ExecutionIDs, "execution"); err != nil {
		return nil, err
	}

	_, err := s.repo.RecordBatchStop(ctx, req, tenantID)
	if err != nil {
		return nil, err
	}

	results := make([]models.BatchOperationResult, len(req.ExecutionIDs))
	for i, id := range req.ExecutionIDs {
		err := s.pipelineService.StopRun(ctx, tenantID, id)
		if err != nil {
			results[i] = models.BatchOperationResult{
				ID:     id,
				Status: "error",
				Error:  strPtr(err.Error()),
			}
		} else {
			results[i] = models.BatchOperationResult{
				ID:     id,
				Status: "stopped",
			}
		}
	}

	_ = s.repo.FinalizeOperationRequest(ctx, "", tenantID)

	return buildStopResponse(results, req.ExecutionIDs), nil
}

// BatchDelete deletes a batch of pipelines.
func (s *Service) BatchDelete(ctx context.Context, req *models.BatchDeleteRequest, tenantID string) (*models.BatchOperationResponse, error) {
	if err := validateBatch(req.PipelineIDs, "pipeline"); err != nil {
		return nil, err
	}

	_, err := s.repo.RecordBatchDelete(ctx, req, tenantID)
	if err != nil {
		return nil, err
	}

	results := make([]models.BatchOperationResult, len(req.PipelineIDs))
	for i, id := range req.PipelineIDs {
		deleted, err := s.pipelineService.DeletePipeline(ctx, tenantID, id)
		if err != nil {
			results[i] = models.BatchOperationResult{
				ID:      id,
				Status:  "error",
				Error:   strPtr(err.Error()),
				Deleted: &deleted,
			}
		} else {
			results[i] = models.BatchOperationResult{
				ID:      id,
				Status:  "deleted",
				Deleted: &deleted,
			}
		}
	}

	_ = s.repo.FinalizeOperationRequest(ctx, "", tenantID)

	return buildResponse(results, req.PipelineIDs), nil
}

// validateBatch validates the batch size and checks for empty IDs.
func validateBatch(ids []string, entityType string) error {
	if len(ids) == 0 {
		return ErrEmptyBatch
	}
	if len(ids) > MaxBatchSize {
		return fmt.Errorf("batch size %d exceeds maximum of %d", len(ids), MaxBatchSize)
	}
	for _, id := range ids {
		if id == "" {
			return fmt.Errorf("empty %s ID found in batch", entityType)
		}
	}
	return nil
}

// buildResponse builds a BatchOperationResponse from results.
func buildResponse(results []models.BatchOperationResult, ids []string) *models.BatchOperationResponse {
	succeeded := 0
	failed := 0
	for _, r := range results {
		if r.Status == "started" || r.Status == "deleted" {
			succeeded++
		} else {
			failed++
		}
	}
	return &models.BatchOperationResponse{
		Data:      results,
		Total:     len(ids),
		Succeeded: succeeded,
		Failed:    failed,
	}
}

// buildStopResponse builds a BatchOperationResponse for stop operations, including skipped count.
func buildStopResponse(results []models.BatchOperationResult, ids []string) *models.BatchOperationResponse {
	succeeded := 0
	failed := 0
	skipped := 0
	for _, r := range results {
		switch r.Status {
		case "stopped":
			succeeded++
		case "skipped":
			skipped++
		default:
			// "error" and any unknown status are counted as failed
			failed++
		}
	}
	return &models.BatchOperationResponse{
		Data:      results,
		Total:     len(ids),
		Succeeded: succeeded,
		Failed:    failed,
		Skipped:   &skipped,
	}
}

// strPtr returns a pointer to a string.
func strPtr(s string) *string {
	return &s
}

// --- Errors ---

var (
	ErrEmptyBatch    = errors.New("batch operation requires at least one item")
	ErrBatchTooLarge = errors.New("batch size exceeds maximum of 50")
)

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}
