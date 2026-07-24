package service

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"

	"orion/platform-svc-go/internal/ci-cd/artifact-registry/models"
	"orion/platform-svc-go/internal/ci-cd/artifact-registry/repository"
	"go.uber.org/zap"
)

type ArtifactRegistryService struct {
	repo   *repository.ArtifactRegistryRepository
	logger *zap.Logger
}

func NewArtifactRegistryService(repo *repository.ArtifactRegistryRepository, logger *zap.Logger) *ArtifactRegistryService {
	return &ArtifactRegistryService{repo: repo, logger: logger}
}

// CreateRegistry creates a new registry.
func (s *ArtifactRegistryService) CreateRegistry(ctx context.Context, tenantID string, req *models.CreateRegistryRequest) (*models.ArtifactRegistry, error) {
	reg, err := s.repo.CreateRegistry(ctx, tenantID, req)
	if err != nil {
		s.logger.Error("failed to create artifact registry",
			zap.String("name", req.Name),
			zap.Error(err),
		)
		return nil, err
	}
	s.logger.Info("artifact registry created",
		zap.String("registryId", reg.ID),
		zap.String("type", reg.Type),
	)
	return reg, nil
}

// QueryRegistries returns paginated registries.
func (s *ArtifactRegistryService) QueryRegistries(ctx context.Context, tenantID string, limit, offset int) (models.RegistryResponse, error) {
	return s.repo.QueryRegistries(ctx, tenantID, limit, offset)
}

// GetRegistry returns a registry by ID.
func (s *ArtifactRegistryService) GetRegistry(ctx context.Context, tenantID, id string) (*models.ArtifactRegistry, error) {
	return s.repo.GetRegistry(ctx, tenantID, id)
}

// PushArtifact pushes an artifact.
func (s *ArtifactRegistryService) PushArtifact(ctx context.Context, tenantID string, req *models.PushArtifactRequest) (*models.ArtifactEntry, error) {
	// Verify registry exists
	_, err := s.repo.GetRegistry(ctx, tenantID, req.RegistryID)
	if err != nil {
		return nil, fmt.Errorf("registry not accessible: %s", req.RegistryID)
	}

	// Generate checksum if not provided
	if req.Checksum == "" && req.StoragePath != "" {
		req.Checksum = md5Checksum(req.StoragePath)
	}

	art, err := s.repo.PushArtifact(ctx, tenantID, req)
	if err != nil {
		s.logger.Error("failed to push artifact",
			zap.String("registryId", req.RegistryID),
			zap.String("name", req.Name),
			zap.Error(err),
		)
		return nil, err
	}

	s.logger.Info("artifact pushed",
		zap.String("artifactId", art.ID),
		zap.String("registryId", req.RegistryID),
		zap.String("version", art.Version),
		zap.Int64("size", art.Size),
	)
	return art, nil
}

// QueryArtifacts returns paginated artifacts.
func (s *ArtifactRegistryService) QueryArtifacts(ctx context.Context, tenantID string, registryID, name string, limit, offset int) (models.ArtifactResponse, error) {
	return s.repo.QueryArtifacts(ctx, tenantID, registryID, name, limit, offset)
}

// DeleteRegistry removes a registry.
func (s *ArtifactRegistryService) DeleteRegistry(ctx context.Context, tenantID, id string) error {
	if err := s.repo.DeleteRegistry(ctx, tenantID, id); err != nil {
		s.logger.Error("failed to delete registry",
			zap.String("registryId", id),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("artifact registry deleted", zap.String("registryId", id))
	return nil
}

// DeleteArtifact removes an artifact.
func (s *ArtifactRegistryService) DeleteArtifact(ctx context.Context, tenantID, id string) error {
	if err := s.repo.DeleteArtifact(ctx, tenantID, id); err != nil {
		s.logger.Error("failed to delete artifact",
			zap.String("artifactId", id),
			zap.Error(err),
		)
		return err
	}
	s.logger.Info("artifact deleted", zap.String("artifactId", id))
	return nil
}

func md5Checksum(path string) string {
	data := []byte(path)
	hash := md5.Sum(data)
	return hex.EncodeToString(hash[:])
}
