package service

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ci-cd/artifact-version/models"
	"orion/platform-svc-go/internal/ci-cd/artifact-version/repository"
	"go.uber.org/zap"
)

type ArtifactVersionService struct {
	repo   *repository.ArtifactVersionRepository
	logger *zap.Logger
}

func NewArtifactVersionService(logger *zap.Logger) *ArtifactVersionService {
	return &ArtifactVersionService{logger: logger}
}

func NewArtifactVersionServiceWithRepo(repo *repository.ArtifactVersionRepository, logger *zap.Logger) *ArtifactVersionService {
	return &ArtifactVersionService{repo: repo, logger: logger}
}

// CreateVersion creates a new artifact version.
func (s *ArtifactVersionService) CreateVersion(ctx context.Context, tenantID string, req *models.CreateVersionRequest) (*models.ArtifactVersion, error) {
	now := time.Now()
	id := fmt.Sprintf("vsn_%d", time.Now().UnixNano())

	checksum := req.Checksum
	if checksum == "" && req.StoragePath != "" {
		data := []byte(req.StoragePath)
		hash := md5.Sum(data)
		checksum = hex.EncodeToString(hash[:])
	}

	var metadata string
	if req.Metadata != nil {
		m, _ := json.Marshal(req.Metadata)
		metadata = string(m)
	}

	version := &models.ArtifactVersion{
		ID:          id,
		TenantID:    tenantID,
		ArtifactID:  req.ArtifactID,
		Version:     req.Version,
		BuildNumber: req.BuildNumber,
		Checksum:    checksum,
		Size:        req.Size,
		StoragePath: req.StoragePath,
		Status:      "published",
		Metadata:    metadata,
		BuildJobID:  req.BuildJobID,
		CreatedAt:   now,
	}

	if s.repo != nil {
		if err := s.repo.Create(ctx, version); err != nil {
			s.logger.Error("failed to persist artifact version", zap.Error(err))
			return nil, fmt.Errorf("create version: %w", err)
		}
	}

	s.logger.Info("artifact version created",
		zap.String("versionId", id),
		zap.String("artifactId", req.ArtifactID),
		zap.String("version", req.Version),
	)
	return version, nil
}

// GetVersion returns a version by ID.
func (s *ArtifactVersionService) GetVersion(ctx context.Context, tenantID, id string) (*models.ArtifactVersion, error) {
	if s.repo != nil {
		return s.repo.GetByID(ctx, tenantID, id)
	}
	return nil, fmt.Errorf("artifact-version repository not initialized")
}

// QueryVersions returns paginated versions.
func (s *ArtifactVersionService) QueryVersions(ctx context.Context, tenantID, artifactID string, limit, offset int) (models.VersionResponse, error) {
	if s.repo != nil {
		versions, total, err := s.repo.Query(ctx, tenantID, artifactID, limit, offset)
		return models.VersionResponse{Total: total, Data: versions}, err
	}
	return models.VersionResponse{}, fmt.Errorf("artifact-version repository not initialized")
}

// DeprecateVersion marks a version as deprecated.
func (s *ArtifactVersionService) DeprecateVersion(ctx context.Context, tenantID, id string) (*models.ArtifactVersion, error) {
	v, err := s.GetVersion(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	if s.repo != nil {
		if err := s.repo.UpdateStatus(ctx, tenantID, id, "deprecated", &now); err != nil {
			return nil, err
		}
	}
	v.Status = "deprecated"
	v.DeprecatedAt = &now

	s.logger.Info("artifact version deprecated", zap.String("versionId", id))
	return v, nil
}

// ArchiveVersion marks a version as archived.
func (s *ArtifactVersionService) ArchiveVersion(ctx context.Context, tenantID, id string) (*models.ArtifactVersion, error) {
	v, err := s.GetVersion(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if s.repo != nil {
		if err := s.repo.UpdateStatus(ctx, tenantID, id, "archived", nil); err != nil {
			return nil, err
		}
	}
	v.Status = "archived"

	s.logger.Info("artifact version archived", zap.String("versionId", id))
	return v, nil
}

// DeleteVersion removes a version.
func (s *ArtifactVersionService) DeleteVersion(ctx context.Context, tenantID, id string) error {
	_, err := s.GetVersion(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if s.repo != nil {
		if err := s.repo.Delete(ctx, tenantID, id); err != nil {
			return err
		}
	}
	s.logger.Info("artifact version deleted", zap.String("versionId", id))
	return nil
}
