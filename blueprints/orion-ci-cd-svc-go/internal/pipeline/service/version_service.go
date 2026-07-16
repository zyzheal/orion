package service

import (
	"context"
	"fmt"

	"orion/ci-cd-svc-go/internal/pipeline/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// VersionService manages pipeline versions
type VersionService struct {
	db *sqlx.DB
}

func NewVersionService(db *sqlx.DB) *VersionService {
	return &VersionService{db: db}
}

// Create creates a new version snapshot of a pipeline
func (s *VersionService) Create(ctx context.Context, tenantID, pipelineID string, req models.CreateVersionRequest) (*models.PipelineVersion, error) {
	version := &models.PipelineVersion{
		ID:         uuid.New().String(),
		PipelineID: pipelineID,
		TenantID:   tenantID,
		Version:    req.Version,
		YAMLConfig: req.YAMLConfig,
		Config:     req.Config,
		Changelog:  req.Changelog,
		IsActive:   true,
	}

	query := `INSERT INTO pipeline_versions (id, pipeline_id, tenant_id, version, yaml_config, config, changelog, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := s.db.ExecContext(ctx, query,
		version.ID, version.PipelineID, version.TenantID, version.Version,
		version.YAMLConfig, version.Config, version.Changelog, version.IsActive,
	)
	if err != nil {
		return nil, fmt.Errorf("create version: %w", err)
	}

	// Deactivate previous versions
	s.db.ExecContext(ctx,
		"UPDATE pipeline_versions SET is_active = false WHERE pipeline_id = $1 AND id != $2",
		pipelineID, version.ID)

	return version, nil
}

// List returns all versions of a pipeline
func (s *VersionService) List(ctx context.Context, pipelineID string) ([]models.PipelineVersion, error) {
	var versions []models.PipelineVersion
	err := s.db.SelectContext(ctx, &versions,
		"SELECT * FROM pipeline_versions WHERE pipeline_id = $1 ORDER BY created_at DESC", pipelineID)
	return versions, err
}

// GetByID returns a specific version
func (s *VersionService) GetByID(ctx context.Context, id string) (*models.PipelineVersion, error) {
	var version models.PipelineVersion
	err := s.db.GetContext(ctx, &version, "SELECT * FROM pipeline_versions WHERE id = $1", id)
	if err != nil {
		return nil, fmt.Errorf("version not found: %w", err)
	}
	return &version, nil
}

// GetActive returns the active version of a pipeline
func (s *VersionService) GetActive(ctx context.Context, pipelineID string) (*models.PipelineVersion, error) {
	var version models.PipelineVersion
	err := s.db.GetContext(ctx, &version,
		"SELECT * FROM pipeline_versions WHERE pipeline_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1", pipelineID)
	if err != nil {
		return nil, fmt.Errorf("no active version found: %w", err)
	}
	return &version, nil
}

// Rollback sets a specific version as the active version
func (s *VersionService) Rollback(ctx context.Context, pipelineID, versionID string) error {
	// Verify version exists
	var version models.PipelineVersion
	if err := s.db.GetContext(ctx, &version, "SELECT * FROM pipeline_versions WHERE id = $1 AND pipeline_id = $2", versionID, pipelineID); err != nil {
		return fmt.Errorf("version not found: %w", err)
	}

	// Deactivate all versions
	s.db.ExecContext(ctx, "UPDATE pipeline_versions SET is_active = false WHERE pipeline_id = $1", pipelineID)

	// Activate target version
	_, err := s.db.ExecContext(ctx, "UPDATE pipeline_versions SET is_active = true WHERE id = $1", versionID)
	return err
}
