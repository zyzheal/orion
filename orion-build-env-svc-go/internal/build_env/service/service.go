package build_env

import (
	"context"

	"orion-build-env-svc-go/internal/models"
	"orion-build-env-svc-go/internal/build_env/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// CreateBuilderImage creates a new builder image
func (s *Service) CreateBuilderImage(ctx context.Context, tenantID string, req models.CreateBuilderImageRequest) (*models.BuilderImage, error) {
	img := &models.BuilderImage{
		Name:      req.Name,
		Registry:  req.Registry,
		Tag:       req.Tag,
		BaseImage: req.BaseImage,
		Status:    "active",
	}
	return s.repo.CreateBuilderImage(ctx, tenantID, img)
}

// ListBuilderImages lists all builder images
func (s *Service) ListBuilderImages(ctx context.Context, tenantID string, limit, offset int) ([]models.BuilderImage, error) {
	return s.repo.ListBuilderImages(ctx, tenantID, limit, offset)
}

// GetBuilderImage gets a builder image by ID
func (s *Service) GetBuilderImage(ctx context.Context, tenantID, id string) (*models.BuilderImage, error) {
	return s.repo.GetBuilderImage(ctx, tenantID, id)
}

// UpdateBuilderImage updates a builder image
func (s *Service) UpdateBuilderImage(ctx context.Context, tenantID, id string, req models.UpdateBuilderImageRequest) (*models.BuilderImage, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Registry != nil {
		updates["registry"] = *req.Registry
	}
	if req.Tag != nil {
		updates["tag"] = *req.Tag
	}
	if req.BaseImage != nil {
		updates["base_image"] = *req.BaseImage
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if len(updates) == 0 {
		return nil, nil
	}
	if err := s.repo.UpdateBuilderImage(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetBuilderImage(ctx, tenantID, id)
}

// DeleteBuilderImage deletes a builder image
func (s *Service) DeleteBuilderImage(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteBuilderImage(ctx, tenantID, id)
}

// CreateBuild creates a new build
func (s *Service) CreateBuild(ctx context.Context, tenantID string, req models.CreateBuildRequest) (*models.Build, error) {
	build := &models.Build{
		PipelineID: req.PipelineID,
		Status:     req.Status,
		Metadata:   req.Metadata,
	}
	if err := s.repo.CreateBuild(ctx, tenantID, build); err != nil {
		return nil, err
	}
	return build, nil
}

// ListBuilds lists builds
func (s *Service) ListBuilds(ctx context.Context, tenantID string, limit, offset int) ([]models.Build, error) {
	return s.repo.ListBuilds(ctx, tenantID, limit, offset)
}

// GetBuild gets a build by ID
func (s *Service) GetBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	return s.repo.GetBuild(ctx, tenantID, id)
}

// UpdateBuild updates a build
func (s *Service) UpdateBuild(ctx context.Context, tenantID, id string, req models.UpdateBuildRequest) (*models.Build, error) {
	updates := make(map[string]interface{})
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.Metadata != nil {
		updates["metadata"] = req.Metadata
	}
	if req.FinishedAt != nil {
		updates["finished_at"] = req.FinishedAt
	}
	if len(updates) == 0 {
		return nil, nil
	}
	if err := s.repo.UpdateBuild(ctx, tenantID, id, updates); err != nil {
		return nil, err
	}
	return s.repo.GetBuild(ctx, tenantID, id)
}

// DeleteBuild deletes a build
func (s *Service) DeleteBuild(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteBuild(ctx, tenantID, id)
}
