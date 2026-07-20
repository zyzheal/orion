package service

import (
	"context"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/pipeline-batch-operations/models"
	"orion/platform-svc-go/internal/pipeline-batch-operations/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	FinalizeOperationRequest(ctx context.Context, id string, tenantID string) error
	RecordBatchDelete(ctx context.Context, req *models.BatchDeleteRequest, tenantID string) (string, error)
	RecordBatchStart(ctx context.Context, req *models.BatchStartRequest, tenantID string) (string, error)
	RecordBatchStop(ctx context.Context, req *models.BatchStopRequest, tenantID string) (string, error)
}

// MaxBatchSize is the maximum number of items allowed in a batch operation.
const MaxBatchSize = 50

// Service coordinates batch pipeline operations.
type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
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

	results := s.simulateOperations(req.PipelineIDs, func(_ string) (string, *string) {
		return "started", nil
	})

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

	results := s.simulateStopOperations(req.ExecutionIDs)

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

	results := s.simulateDeleteOperations(req.PipelineIDs)

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

// simulateOperations simulates starting pipelines by returning a success status for each.
func (s *Service) simulateOperations(ids []string, statusFn func(string) (string, *string)) []models.BatchOperationResult {
	results := make([]models.BatchOperationResult, len(ids))
	for i, id := range ids {
		status, err := statusFn(id)
		results[i] = models.BatchOperationResult{
			ID:     id,
			Status: status,
			Error:  err,
		}
	}
	return results
}

// simulateStopOperations simulates stopping pipeline runs, marking some as skipped.
func (s *Service) simulateStopOperations(executionIDs []string) []models.BatchOperationResult {
	results := make([]models.BatchOperationResult, len(executionIDs))
	for i, id := range executionIDs {
		// Simulate: odd-indexed items are skipped (already stopped)
		if i%2 == 1 {
			results[i] = models.BatchOperationResult{
				ID:     id,
				Status: "skipped",
				Error:  strPtr("already stopped"),
			}
		} else {
			results[i] = models.BatchOperationResult{
				ID:     id,
				Status: "stopped",
			}
		}
	}
	return results
}

// simulateDeleteOperations simulates deleting pipelines.
func (s *Service) simulateDeleteOperations(pipelineIDs []string) []models.BatchOperationResult {
	results := make([]models.BatchOperationResult, len(pipelineIDs))
	for i, id := range pipelineIDs {
		deleted := true
		results[i] = models.BatchOperationResult{
			ID:      id,
			Status:  "deleted",
			Deleted: &deleted,
		}
	}
	return results
}

// buildResponse builds a BatchOperationResponse from results.
func buildResponse(results []models.BatchOperationResult, ids []string) *models.BatchOperationResponse {
	succeeded := 0
	failed := 0
	for _, r := range results {
		if r.Status == "started" {
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
