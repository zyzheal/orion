package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/artifact-lifecycle/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Archive(ctx context.Context, tenantID, id string) error
	Count(ctx context.Context, tenantID string) (int, error)
	Create(ctx context.Context, lc *models.ArtifactLifecycle) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByArtifactID(ctx context.Context, tenantID, artifactID string) (*models.ArtifactLifecycle, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.ArtifactLifecycle, error)
	GetStageHistory(ctx context.Context, tenantID, id string) ([]models.ArtifactLifecycle, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.ArtifactLifecycle, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
}

var (
	ErrAlreadyExists = errors.New("artifact lifecycle already exists")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateArtifactLifecycleRequest) (*models.ArtifactLifecycle, error) {
	_, err := s.repo.GetByArtifactID(ctx, tenantID, req.ArtifactID)
	if err != nil && !errors.Is(err, sentinel.NotFound) {
		return nil, err
	}
	if err == nil {
		return nil, ErrAlreadyExists
	}
	lc := &models.ArtifactLifecycle{
		TenantID:   tenantID,
		ArtifactID: req.ArtifactID,
		Stage:      req.Stage,
		Status:     req.Status,
	}
	if err := s.repo.Create(ctx, lc); err != nil {
		return nil, err
	}
	return lc, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.ArtifactLifecycle, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) GetByArtifactID(ctx context.Context, tenantID, artifactID string) (*models.ArtifactLifecycle, error) {
	return s.repo.GetByArtifactID(ctx, tenantID, artifactID)
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) (*models.ListLifecycleResponse, error) {
	items, err := s.repo.List(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	total, err := s.repo.Count(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &models.ListLifecycleResponse{Items: items, Total: total}, nil
}

func (s *Service) AdvanceStage(ctx context.Context, tenantID, id string, req models.AdvanceStageRequest) (*models.ArtifactLifecycle, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	updates := map[string]interface{}{
		"stage": req.Stage,
	}
	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return sentinel.NotFound
	}
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) GetStageHistory(ctx context.Context, tenantID, artifactID string) ([]models.ArtifactLifecycle, error) {
	return s.repo.GetStageHistory(ctx, tenantID, artifactID)
}

func (s *Service) Archive(ctx context.Context, tenantID, id string) (*models.ArtifactLifecycle, error) {
	_, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, sentinel.NotFound
	}
	if err := s.repo.Archive(ctx, tenantID, id); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, tenantID, id)
}

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound)
}
