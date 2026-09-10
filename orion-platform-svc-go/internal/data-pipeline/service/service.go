package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/data-pipeline/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Pipeline, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Pipeline, error)
	List(ctx context.Context, tenantID string) ([]models.Pipeline, error)
	ListRuns(ctx context.Context, tenantID, pipelineID string) ([]models.PipelineRun, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Pipeline, error)
	UpdateStatus(ctx context.Context, tenantID, id, status string) (*models.Pipeline, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Pipeline, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Pipeline, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Pipeline, error) {
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Pipeline, error) {
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
	pipeline, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	runs, err := s.repo.ListRuns(ctx, tenantID, pipeline.ID)
	if err != nil {
		return nil, err
	}
	logs := make([]string, 0, len(runs))
	for _, run := range runs {
		logs = append(logs, fmt.Sprintf("run %s: status=%s started=%s", run.ID, run.Status, run.StartedAt.Format("2006-01-02T15:04:05Z")))
	}
	return logs, nil
}

func (s *Service) ListSchemas(ctx context.Context, tenantID string) ([]string, error) {
	pipelines, err := s.repo.List(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	schemas := make(map[string]bool)
	for _, p := range pipelines {
		if p.SourceTable != "" {
			schemas[p.SourceTable] = true
		}
		if p.TargetTable != "" {
			schemas[p.TargetTable] = true
		}
	}
	out := make([]string, 0, len(schemas))
	for s := range schemas {
		out = append(out, s)
	}
	return out, nil
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
