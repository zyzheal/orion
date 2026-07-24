package service

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ci-cd/artifact-version/models"
	"go.uber.org/zap"
)

type ArtifactVersionService struct {
	versions map[string]*models.ArtifactVersion
	logger   *zap.Logger
}

func NewArtifactVersionService(logger *zap.Logger) *ArtifactVersionService {
	return &ArtifactVersionService{
		versions: make(map[string]*models.ArtifactVersion),
		logger:   logger,
	}
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
		BuildJobID:  req.BuildJobID,
		CreatedAt:   now,
	}

	if req.Metadata != nil {
		version.Metadata = fmt.Sprintf("%v", req.Metadata)
	}

	s.versions[id] = version

	s.logger.Info("artifact version created",
		zap.String("versionId", id),
		zap.String("artifactId", req.ArtifactID),
		zap.String("version", req.Version),
	)
	return version, nil
}

// GetVersion returns a version by ID.
func (s *ArtifactVersionService) GetVersion(ctx context.Context, tenantID, id string) (*models.ArtifactVersion, error) {
	v, ok := s.versions[id]
	if !ok {
		return nil, fmt.Errorf("version not found: %s", id)
	}
	if v.TenantID != tenantID {
		return nil, fmt.Errorf("version not accessible: %s", id)
	}
	return v, nil
}

// QueryVersions returns paginated versions.
func (s *ArtifactVersionService) QueryVersions(ctx context.Context, tenantID string, artifactID string, limit, offset int) (models.VersionResponse, error) {
	var resp models.VersionResponse
	for _, v := range s.versions {
		if v.TenantID != tenantID {
			continue
		}
		if artifactID != "" && v.ArtifactID != artifactID {
			continue
		}
		resp.Data = append(resp.Data, *v)
	}
	resp.Total = int64(len(resp.Data))
	return resp, nil
}

// DeprecateVersion marks a version as deprecated.
func (s *ArtifactVersionService) DeprecateVersion(ctx context.Context, tenantID, id string) (*models.ArtifactVersion, error) {
	v, ok := s.versions[id]
	if !ok {
		return nil, fmt.Errorf("version not found: %s", id)
	}
	if v.TenantID != tenantID {
		return nil, fmt.Errorf("version not accessible: %s", id)
	}

	now := time.Now()
	v.Status = "deprecated"
	v.DeprecatedAt = &now
	s.versions[id] = v

	s.logger.Info("artifact version deprecated",
		zap.String("versionId", id),
	)
	return v, nil
}

// ArchiveVersion marks a version as archived.
func (s *ArtifactVersionService) ArchiveVersion(ctx context.Context, tenantID, id string) (*models.ArtifactVersion, error) {
	v, ok := s.versions[id]
	if !ok {
		return nil, fmt.Errorf("version not found: %s", id)
	}
	if v.TenantID != tenantID {
		return nil, fmt.Errorf("version not accessible: %s", id)
	}

	v.Status = "archived"
	s.versions[id] = v

	s.logger.Info("artifact version archived",
		zap.String("versionId", id),
	)
	return v, nil
}

// DeleteVersion removes a version.
func (s *ArtifactVersionService) DeleteVersion(ctx context.Context, tenantID, id string) error {
	v, ok := s.versions[id]
	if !ok {
		return fmt.Errorf("version not found: %s", id)
	}
	if v.TenantID != tenantID {
		return fmt.Errorf("version not accessible: %s", id)
	}

	delete(s.versions, id)
	s.logger.Info("artifact version deleted", zap.String("versionId", id))
	return nil
}
