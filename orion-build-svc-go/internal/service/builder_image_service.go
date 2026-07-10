package service

import (
	"context"
	"errors"
	"fmt"

	"orion/build-svc-go/internal/models"
	"orion/build-svc-go/internal/repository"
)

var (
	ErrImageNotFound  = errors.New("builder image not found")
	ErrImageDisabled  = errors.New("builder image already exists")
	ErrImageProtected = errors.New("cannot modify preset images")
)

// BuilderImageService manages builder image lifecycle.
type BuilderImageService struct {
	repo *repository.BuilderImageRepository
}

func NewBuilderImageService(repo *repository.BuilderImageRepository) *BuilderImageService {
	return &BuilderImageService{repo: repo}
}

// Register creates a new custom builder image.
func (s *BuilderImageService) Register(ctx context.Context, input models.CreateBuilderImageInput) (*models.BuilderImage, error) {
	// Check for duplicate name
	existing, err := s.repo.FindByName(ctx, input.Name)
	if err != nil {
		return nil, err
	}
	if existing != nil && existing.Status != models.BuilderImageStatusDisabled {
		return nil, fmt.Errorf("%w: '%s' already exists", ErrImageDisabled, input.Name)
	}

	img := &models.BuilderImage{
		Name:        input.Name,
		DisplayName: input.Name,
		Image:       input.Image,
		Type:        models.PresetImageTypeCustom,
		Version:     "latest",
		Status:      models.BuilderImageStatusActive,
		IsPreset:    false,
	}
	if input.DisplayName != "" {
		img.DisplayName = input.DisplayName
	}
	if input.Type != "" {
		img.Type = models.PresetImageType(input.Type)
	}
	if input.Version != "" {
		img.Version = input.Version
	}
	if input.PullPolicy != "" {
		img.PullPolicy = models.ImagePullPolicy(input.PullPolicy)
	} else {
		img.PullPolicy = models.ImagePullPolicyIfNotPresent
	}
	if input.Description != "" {
		img.Description = input.Description
	}
	if len(input.Env) > 0 {
		img.Env = input.Env
	}
	if len(input.Labels) > 0 {
		img.Labels = input.Labels
	}
	if input.CreatedBy != "" {
		img.CreatedBy = input.CreatedBy
	}

	if err := s.repo.Create(ctx, img); err != nil {
		return nil, err
	}
	return img, nil
}

// GetByID returns a builder image by ID.
func (s *BuilderImageService) GetByID(ctx context.Context, id string) (*models.BuilderImage, error) {
	img, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return img, nil
}

// GetByName returns a builder image by name.
func (s *BuilderImageService) GetByName(ctx context.Context, name string) (*models.BuilderImage, error) {
	return s.repo.FindByName(ctx, name)
}

// List returns builder images with optional filters.
func (s *BuilderImageService) List(ctx context.Context, opts models.BuilderImageQueryOptions) ([]models.BuilderImage, error) {
	var result []models.BuilderImage
	var err error

	switch {
	case opts.IsPreset != nil:
		result, err = s.repo.ListByIsPreset(ctx, *opts.IsPreset)
	case opts.Type != "":
		result, err = s.repo.ListByType(ctx, string(opts.Type))
	case opts.Status != "":
		result, err = s.repo.ListByStatus(ctx, string(opts.Status))
	default:
		result, err = s.repo.ListAll(ctx, opts.Offset, opts.Limit)
	}
	if err != nil {
		return nil, err
	}
	return result, nil
}

// Update modifies a builder image's metadata.
func (s *BuilderImageService) Update(ctx context.Context, id string, input models.UpdateBuilderImageInput) (*models.BuilderImage, error) {
	img, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if img.IsPreset {
		return nil, fmt.Errorf("%w: cannot update preset images", ErrImageProtected)
	}

	if input.DisplayName != "" {
		img.DisplayName = input.DisplayName
	}
	if input.Description != "" {
		img.Description = input.Description
	}
	if input.PullPolicy != "" {
		img.PullPolicy = models.ImagePullPolicy(input.PullPolicy)
	}
	if input.Status != "" {
		img.Status = models.BuilderImageStatus(input.Status)
	}
	if len(input.Env) > 0 {
		img.Env = input.Env
	}
	if len(input.Labels) > 0 {
		img.Labels = input.Labels
	}

	if err := s.repo.Update(ctx, img); err != nil {
		return nil, err
	}
	return img, nil
}

// Disable marks an image as disabled (soft delete).
func (s *BuilderImageService) Disable(ctx context.Context, id string) error {
	img, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if img.IsPreset {
		return fmt.Errorf("%w: use deprecate instead", ErrImageProtected)
	}
	_, err = s.repo.UpdateStatus(ctx, id, string(models.BuilderImageStatusDisabled))
	if err != nil {
		return err
	}
	return nil
}

// Deprecate marks an image as deprecated.
func (s *BuilderImageService) Deprecate(ctx context.Context, id string) (*models.BuilderImage, error) {
	updated, err := s.repo.UpdateStatus(ctx, id, string(models.BuilderImageStatusDeprecated))
	if err != nil {
		return nil, err
	}
	return updated, nil
}

// Restore re-enables a disabled or deprecated image.
func (s *BuilderImageService) Restore(ctx context.Context, id string) (*models.BuilderImage, error) {
	updated, err := s.repo.UpdateStatus(ctx, id, string(models.BuilderImageStatusActive))
	if err != nil {
		return nil, err
	}
	return updated, nil
}

// GetPresets returns all preset images.
func (s *BuilderImageService) GetPresets(ctx context.Context) ([]models.BuilderImage, error) {
	return s.repo.ListByIsPreset(ctx, true)
}

// GetAvailable returns all active images.
func (s *BuilderImageService) GetAvailable(ctx context.Context) ([]models.BuilderImage, error) {
	return s.repo.FindActive(ctx)
}

// GetByType returns active images of a given type.
func (s *BuilderImageService) GetByType(ctx context.Context, typ string) ([]models.BuilderImage, error) {
	return s.repo.FindByTypeAndActive(ctx, typ)
}

// GetPullPolicy returns the pull policy for an image by name.
func (s *BuilderImageService) GetPullPolicy(ctx context.Context, name string) models.ImagePullPolicy {
	img, _ := s.repo.FindByName(ctx, name)
	if img == nil {
		return models.ImagePullPolicyIfNotPresent
	}
	return img.PullPolicy
}

// Delete permanently removes a custom builder image.
func (s *BuilderImageService) Delete(ctx context.Context, id string) error {
	img, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if img.IsPreset {
		return fmt.Errorf("%w: cannot delete preset images", ErrImageProtected)
	}
	return s.repo.Delete(ctx, id)
}

// InitPresets seeds the database with default preset images.
func (s *BuilderImageService) InitPresets(ctx context.Context) error {
	for _, preset := range models.DefaultPresetImages() {
		existing, err := s.repo.FindByName(ctx, preset.Name)
		if err != nil {
			return err
		}
		if existing != nil {
			continue
		}

		img := &models.BuilderImage{
			Name:        preset.Name,
			DisplayName: preset.DisplayName,
			Image:       preset.Image,
			Type:        preset.Type,
			Version:     preset.Version,
			Description: preset.Description,
			PullPolicy:  models.ImagePullPolicyIfNotPresent,
			Status:      models.BuilderImageStatusActive,
			IsPreset:    true,
		}

		if err := s.repo.Create(ctx, img); err != nil {
			return fmt.Errorf("failed to seed preset %s: %w", preset.Name, err)
		}
	}
	return nil
}
