package service

import (
	"context"

	"orion/platform-svc-go/internal/data-pipeline/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)
	UpdateStatus(ctx context.Context, tenantID, id, status string) (*models.Record, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) RunPipeline(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.UpdateStatus(ctx, tenantID, id, "running")
	return err
}

func (s *Service) GetStatus(ctx context.Context, tenantID, id string) (string, error) {
	record, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return "", err
	}
	return record.Status, nil
}

func (s *Service) Pause(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.UpdateStatus(ctx, tenantID, id, "paused")
	return err
}

func (s *Service) Resume(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.UpdateStatus(ctx, tenantID, id, "running")
	return err
}

func (s *Service) GetLogs(ctx context.Context, tenantID, id string) ([]string, error) {
	// Verify pipeline exists and is accessible; logs would be stored in a
	// separate run-log table (future).
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return []string{}, nil
}

func (s *Service) ListSchemas(ctx context.Context, tenantID string) ([]string, error) {
	// Schemas are managed per-tenant by the DBA / data-platform service; no
	// direct table in data_pipelines. Return empty for now.
	return []string{}, nil
}

func (s *Service) GetLineage(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	// Verify pipeline exists; lineage is resolved from config at runtime.
	pipeline, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return map[string]interface{}{}, err
	}
	// Lineage is derived from the pipeline config; return a thin envelope so
	// callers don't treat empty-as-absent as an error.
	return map[string]interface{}{
		"pipelineId": pipeline.ID,
		"sources":    []string{},
		"sinks":      []string{},
	}, nil
}
