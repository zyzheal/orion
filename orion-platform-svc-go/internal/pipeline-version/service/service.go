package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/pipeline-version/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CountVersionsByPipeline(ctx context.Context, pipelineID string, tenantID string) (int, error)
	CreateVersion(ctx context.Context, v *models.PipelineVersion) error
	GetVersionByID(ctx context.Context, id string, tenantID string) (*models.PipelineVersion, error)
	GetVersionByPipelineAndVersion(ctx context.Context, pipelineID string, version string, tenantID string) (*models.PipelineVersion, error)
	ListVersionsByPipeline(ctx context.Context, pipelineID string, tenantID string) ([]models.PipelineVersion, error)
	UnsetAllBaselines(ctx context.Context, pipelineID string, tenantID string) error
	UpdateBaseline(ctx context.Context, id string, tenantID string, isBaseline bool) (*models.PipelineVersion, error)
	UpdateTags(ctx context.Context, id string, tenantID string, tags string) (*models.PipelineVersion, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateVersion(ctx context.Context, pipelineID string, tenantID string, req *models.CreateVersionRequest) (*models.PipelineVersion, error) {
	version := &models.PipelineVersion{
		TenantID:       tenantID,
		PipelineID:     pipelineID,
		Version:        req.Version,
		YAMLDefinition: req.YAMLDefinition,
		Description:    req.Description,
	}
	if err := s.repo.CreateVersion(ctx, version); err != nil {
		return nil, err
	}
	return s.repo.GetVersionByPipelineAndVersion(ctx, pipelineID, req.Version, tenantID)
}

func (s *Service) GetVersion(ctx context.Context, id string, tenantID string) (*models.PipelineVersion, error) {
	return s.repo.GetVersionByID(ctx, id, tenantID)
}

func (s *Service) GetVersionByPipelineAndVersion(ctx context.Context, pipelineID string, version string, tenantID string) (*models.PipelineVersion, error) {
	return s.repo.GetVersionByPipelineAndVersion(ctx, pipelineID, version, tenantID)
}

func (s *Service) ListVersionsByPipeline(ctx context.Context, pipelineID string, tenantID string) ([]models.PipelineVersion, int, error) {
	versions, err := s.repo.ListVersionsByPipeline(ctx, pipelineID, tenantID)
	if err != nil {
		return nil, 0, err
	}
	if versions == nil {
		versions = []models.PipelineVersion{}
	}
	total, _ := s.repo.CountVersionsByPipeline(ctx, pipelineID, tenantID)
	return versions, total, nil
}

func (s *Service) DiffVersions(ctx context.Context, fromID string, toID string, tenantID string) (*models.DiffResult, error) {
	fromVer, err := s.repo.GetVersionByID(ctx, fromID, tenantID)
	if err != nil {
		return nil, ErrVersionNotFound
	}
	toVer, err := s.repo.GetVersionByID(ctx, toID, tenantID)
	if err != nil {
		return nil, ErrVersionNotFound
	}
	return computeDiff(fromVer, toVer), nil
}

func (s *Service) Rollback(ctx context.Context, versionID string, tenantID string) (*models.PipelineVersion, error) {
	// TODO: implement actual rollback logic
	return s.repo.GetVersionByID(ctx, versionID, tenantID)
}

func (s *Service) AddTag(ctx context.Context, versionID string, tenantID string, tag string) (*models.PipelineVersion, error) {
	version, err := s.repo.GetVersionByID(ctx, versionID, tenantID)
	if err != nil {
		return nil, err
	}
	var tags []string
	_ = json.Unmarshal([]byte(version.Tags), &tags)
	if contains(tags, tag) {
		return version, nil
	}
	tags = append(tags, tag)
	tagsJSON, _ := json.Marshal(tags)
	return s.repo.UpdateTags(ctx, versionID, tenantID, string(tagsJSON))
}

func (s *Service) RemoveTag(ctx context.Context, versionID string, tenantID string, tag string) (*models.PipelineVersion, error) {
	version, err := s.repo.GetVersionByID(ctx, versionID, tenantID)
	if err != nil {
		return nil, err
	}
	var tags []string
	_ = json.Unmarshal([]byte(version.Tags), &tags)
	tags = removeTag(tags, tag)
	tagsJSON, _ := json.Marshal(tags)
	return s.repo.UpdateTags(ctx, versionID, tenantID, string(tagsJSON))
}

func (s *Service) SetBaseline(ctx context.Context, versionID string, tenantID string, set bool) (*models.PipelineVersion, error) {
	if set {
		// Find the pipeline_id belonging to this version so we unset other baselines on the same pipeline.
		version, err := s.repo.GetVersionByID(ctx, versionID, tenantID)
		if err != nil {
			return nil, err
		}
		if err := s.repo.UnsetAllBaselines(ctx, version.PipelineID, tenantID); err != nil {
			return nil, err
		}
	}
	return s.repo.UpdateBaseline(ctx, versionID, tenantID, set)
}

func computeDiff(fromVer, toVer *models.PipelineVersion) *models.DiffResult {
	result := &models.DiffResult{
		FromVersion: fromVer.Version,
		ToVersion:   toVer.Version,
		Changes:     []models.Change{},
	}

	f := fromVer.YAMLDefinition
	t := toVer.YAMLDefinition
	if f != t {
		result.Changes = append(result.Changes, models.Change{
			Field:      "yamlDefinition",
			OldValue:   strPtr(fromVer.YAMLDefinition),
			NewValue:   strPtr(toVer.YAMLDefinition),
			ChangeType: "modified",
		})
		result.Summary.Modified++
	}

	d1 := ""
	d2 := ""
	if fromVer.Description != nil {
		d1 = *fromVer.Description
	}
	if toVer.Description != nil {
		d2 = *toVer.Description
	}
	if d1 != d2 {
		result.Changes = append(result.Changes, models.Change{
			Field:      "description",
			OldValue:   strPtr(d1),
			NewValue:   strPtr(d2),
			ChangeType: "modified",
		})
		result.Summary.Modified++
	}

	return result
}

func contains(tags []string, tag string) bool {
	for _, t := range tags {
		if t == tag {
			return true
		}
	}
	return false
}

func removeTag(tags []string, tag string) []string {
	result := []string{}
	for _, t := range tags {
		if t != tag {
			result = append(result, t)
		}
	}
	return result
}

func strPtr(s string) *string {
	return &s
}

var ErrVersionNotFound = errors.New("version not found")

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

func _() {
	var _ = errors.Is
	var _ = strings.Contains
	var _ sql.NullTime
}
