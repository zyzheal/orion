package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

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
	source, err := s.repo.GetVersionByID(ctx, versionID, tenantID)
	if err != nil {
		return nil, err
	}
	if source.IsBaseline {
		// Already the current version — nothing to restore.
		return source, nil
	}
	// Listing versions is best-effort: any failure (including an absent
	// pipeline_versions table) falls back to a deterministic suffix label
	// rather than failing the rollback.
	restoredVersion := nextRestoredVersion(ctx, source, tenantID, s.repo)

	// Unset all baselines first so the update below is never a no-op: the
	// baseline is always moved to the restored version, even if the source
	// version was the current baseline.
	if err := s.repo.UnsetAllBaselines(ctx, source.PipelineID, tenantID); err != nil {
		return nil, err
	}

	restored := &models.PipelineVersion{
		TenantID:       tenantID,
		PipelineID:     source.PipelineID,
		Version:        restoredVersion,
		YAMLDefinition: source.YAMLDefinition,
		Description:    rollbackDescription(source, versionID),
		Tags:           buildRollbackTags(source.Tags, versionID),
		CreatedBy:      "system:rollback",
	}
	if err := s.repo.CreateVersion(ctx, restored); err != nil {
		return nil, err
	}

	// Source baseline is already unset by UnsetAllBaselines; best-effort only,
	// since skipping this still leaves the restored version as baseline.
	s.repo.UpdateBaseline(ctx, versionID, tenantID, false)
	return s.repo.UpdateBaseline(ctx, restored.ID, tenantID, true)
}

// nextRestoredVersion picks a version label for the restored copy:
// the next integer above the latest numeric version (1 -> 1.0.0.1), or a
// deterministic timestamped suffix when no numeric version exists.
func nextRestoredVersion(ctx context.Context, source *models.PipelineVersion, tenantID string, repo RepositoryInterface) string {
	versions, err := repo.ListVersionsByPipeline(ctx, source.PipelineID, tenantID)
	if err == nil {
		max := -1
		for _, v := range versions {
			if n, err := strconv.Atoi(v.Version); err == nil && n > max {
				max = n
			}
		}
		if max >= 0 {
			return strconv.Itoa(max+1) + "." + source.Version
		}
	}
	return fmt.Sprintf("%s-rollback-%d", source.Version, time.Now().UTC().Unix())
}

func rollbackDescription(source *models.PipelineVersion, sourceID string) *string {
	d := fmt.Sprintf("Rolled back to version %s (source: %s)", source.Version, source.ID)
	return &d
}

func buildRollbackTags(existing string, sourceID string) string {
	var tags []string
	_ = json.Unmarshal([]byte(existing), &tags)
	tag := "rollback-from:" + sourceID
	if !contains(tags, tag) {
		tags = append(tags, tag)
	}
	tagsJSON, _ := json.Marshal(tags)
	return string(tagsJSON)
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
