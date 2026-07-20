package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/build/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CompleteBuild(ctx context.Context, tenantID, id string, status models.BuildStatus, errMsg string) (*models.Build, error)
	Create(ctx context.Context, tenantID string, req models.CreateBuildRequest) (*models.Build, error)
	CreateEnvironment(ctx context.Context, tenantID string, req models.CreateEnvironmentRequest) (*models.BuildEnvironment, error)
	Delete(ctx context.Context, tenantID, id string) (bool, error)
	DeleteEnvironment(ctx context.Context, tenantID, id string) (bool, error)
	GetBuildStats(ctx context.Context, tenantID string) (*models.BuildStats, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Build, error)
	GetByPipelineRun(ctx context.Context, tenantID, pipelineRunID string) (*models.Build, error)
	GetEnvironment(ctx context.Context, tenantID, id string) (*models.BuildEnvironment, error)
	List(ctx context.Context, tenantID string, opt models.ListBuildsOptions) ([]models.Build, int, error)
	ListEnvironments(ctx context.Context, tenantID string) ([]models.BuildEnvironment, error)
	StartBuild(ctx context.Context, tenantID, id string) (*models.Build, error)
	UpdateEnvironment(ctx context.Context, tenantID, id string, req models.UpdateEnvironmentRequest) (*models.BuildEnvironment, error)
}

var (
	ErrNotFound     = errors.New("not found")
	ErrInvalidInput = errors.New("invalid input")
	ErrInvalidState = errors.New("invalid state")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// === Environments ===

func (s *Service) GetEnvironment(ctx context.Context, tenantID, id string) (*models.BuildEnvironment, error) {
	return s.repo.GetEnvironment(ctx, tenantID, id)
}

func (s *Service) ListEnvironments(ctx context.Context, tenantID string) ([]models.BuildEnvironment, error) {
	return s.repo.ListEnvironments(ctx, tenantID)
}

func (s *Service) CreateEnvironment(ctx context.Context, tenantID string, req models.CreateEnvironmentRequest) (*models.BuildEnvironment, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("%w: name is required", ErrInvalidInput)
	}
	if req.Image == "" {
		return nil, fmt.Errorf("%w: image is required", ErrInvalidInput)
	}
	return s.repo.CreateEnvironment(ctx, tenantID, req)
}

func (s *Service) UpdateEnvironment(ctx context.Context, tenantID, id string, req models.UpdateEnvironmentRequest) (*models.BuildEnvironment, error) {
	_, err := s.repo.GetEnvironment(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return s.repo.UpdateEnvironment(ctx, tenantID, id, req)
}

func (s *Service) DeleteEnvironment(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.DeleteEnvironment(ctx, tenantID, id)
}

// === Builds ===

func (s *Service) GetBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) ListBuilds(ctx context.Context, tenantID string, opt models.ListBuildsOptions) ([]models.Build, int, error) {
	return s.repo.List(ctx, tenantID, opt)
}

func (s *Service) CreateBuild(ctx context.Context, tenantID string, req models.CreateBuildRequest) (*models.Build, error) {
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) StartBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	build, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if build.Status != models.BuildStatusPending {
		return nil, fmt.Errorf("%w: can only start pending builds", ErrInvalidState)
	}
	updated, err := s.repo.StartBuild(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	// Execute build asynchronously
	go s.executeBuild(ctx, tenantID, id)
	return updated, nil
}

func (s *Service) CancelBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	build, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if build.Status != models.BuildStatusPending && build.Status != models.BuildStatusRunning {
		return nil, fmt.Errorf("%w: can only cancel pending or running builds", ErrInvalidState)
	}
	return s.repo.CompleteBuild(ctx, tenantID, id, models.BuildStatusCancelled, "Cancelled by user")
}

func (s *Service) RetryBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	build, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if build.Status != models.BuildStatusFailed && build.Status != models.BuildStatusCancelled {
		return nil, fmt.Errorf("%w: can only retry failed or cancelled builds", ErrInvalidState)
	}
	newBuild, err := s.repo.Create(ctx, tenantID, models.CreateBuildRequest{
		ProjectID:     build.ProjectID,
		PipelineRunID: build.PipelineRunID,
		SourceRef:     build.SourceRef,
	})
	if err != nil {
		return nil, err
	}
	return s.StartBuild(ctx, tenantID, newBuild.ID)
}

func (s *Service) GetBuildByPipelineRun(ctx context.Context, tenantID, pipelineRunID string) (*models.Build, error) {
	return s.repo.GetByPipelineRun(ctx, tenantID, pipelineRunID)
}

func (s *Service) GetBuildStats(ctx context.Context, tenantID string) (*models.BuildStats, error) {
	return s.repo.GetBuildStats(ctx, tenantID)
}

func (s *Service) DeleteBuild(ctx context.Context, tenantID, id string) (bool, error) {
	return s.repo.Delete(ctx, tenantID, id)
}

// executeBuild simulates build execution
func (s *Service) executeBuild(ctx context.Context, tenantID, id string) {
	// Simulate build time
	time.Sleep(500 * time.Millisecond)

	// Simulate success with generated image tag
	_, err := s.repo.CompleteBuild(ctx, tenantID, id, models.BuildStatusSuccess, "")
	if err != nil {
		_, _ = s.repo.CompleteBuild(ctx, tenantID, id, models.BuildStatusFailed, err.Error())
	}
}
