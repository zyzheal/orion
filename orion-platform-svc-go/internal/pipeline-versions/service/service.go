package service

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"orion/platform-svc-go/internal/pipeline-versions/models"
	"orion/platform-svc-go/internal/pipeline-versions/repository"
)

var (
	ErrNotFound  = errors.New("version not found")
	ErrBadRequest = errors.New("bad request")
	ErrLocked    = errors.New("version locked")
	ErrAlreadyPublished = errors.New("version already published")
	ErrNoRollbackTarget = errors.New("no rollback target")
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound) || errors.Is(err, repository.ErrNotFound)
}

func IsBadRequest(err error) bool {
	return errors.Is(err, ErrBadRequest)
}

func IsLocked(err error) bool {
	return errors.Is(err, ErrLocked)
}

// --- Version CRUD ---

func (s *Service) CreateVersion(ctx context.Context, tenantID, pipelineID string, req *models.CreateVersionRequest, createdBy string) (*models.Version, error) {
	if req == nil || req.Name == "" || req.Config == "" {
		return nil, ErrBadRequest
	}

	// Validate JSON config
	var cfg any
	if err := json.Unmarshal([]byte(req.Config), &cfg); err != nil {
		return nil, ErrBadRequest
	}

	// Generate version number: v1.<N>.0
	versionNum, err := s.generateVersionNumber(ctx, tenantID, pipelineID)
	if err != nil {
		return nil, err
	}

	// Parse optional tags
	var tags string
	if req.Tags != nil && *req.Tags != "" {
		// Normalize tags as JSON array string
		var arr []any
		if err := json.Unmarshal([]byte(*req.Tags), &arr); err != nil {
			return nil, ErrBadRequest
		}
		raw, _ := json.Marshal(arr)
		tags = string(raw)
	}

	v := &models.Version{
		TenantID:      tenantID,
		PipelineID:    pipelineID,
		VersionNum:    versionNum,
		Name:          req.Name,
		Description:   req.Description,
		Config:        req.Config,
		Status:        models.StatusDraft,
		IsDefault:     false,
		CreatedBy:     createdBy,
		ChangeLog:     req.ChangeLog,
		Tags:          tags,
		ParentVersionID: req.BaseVersionID,
	}

	if err := s.repo.CreateVersion(ctx, v); err != nil {
		return nil, err
	}
	return v, nil
}

func (s *Service) GetVersion(ctx context.Context, tenantID, versionID string) (*models.Version, error) {
	v, err := s.repo.GetVersion(ctx, tenantID, versionID)
	if err != nil {
		return nil, ErrNotFound
	}
	return v, nil
}

func (s *Service) ListVersions(ctx context.Context, tenantID, pipelineID string, q *models.ListQuery) (*models.VersionListResult, error) {
	if q.Limit <= 0 {
		q.Limit = 20
	}
	return s.repo.ListVersions(ctx, tenantID, pipelineID, q)
}

func (s *Service) UpdateVersion(ctx context.Context, tenantID, versionID string, req *models.UpdateVersionRequest) (*models.Version, error) {
	if req == nil {
		return nil, ErrBadRequest
	}

	v, err := s.repo.GetVersion(ctx, tenantID, versionID)
	if err != nil {
		return nil, ErrNotFound
	}

	if v.Status == models.StatusPublished {
		return nil, ErrLocked
	}

	updates := make(map[string]any)
	if req.Name != nil && *req.Name != "" {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Config != nil {
		var cfg any
		if err := json.Unmarshal([]byte(*req.Config), &cfg); err != nil {
			return nil, ErrBadRequest
		}
		updates["config"] = *req.Config
	}
	if req.ChangeLog != nil {
		updates["change_log"] = *req.ChangeLog
	}
	if req.Tags != nil && *req.Tags != "" {
		var arr []any
		if err := json.Unmarshal([]byte(*req.Tags), &arr); err != nil {
			return nil, ErrBadRequest
		}
		raw, _ := json.Marshal(arr)
		updates["tags"] = string(raw)
	}

	updated, err := s.repo.UpdateVersion(ctx, tenantID, versionID, updates)
	if err != nil {
		return nil, ErrNotFound
	}
	return updated, nil
}

func (s *Service) DeleteVersion(ctx context.Context, tenantID, versionID string) error {
	deleted, err := s.repo.DeleteVersion(ctx, tenantID, versionID)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}
	return nil
}

// --- Publish ---

func (s *Service) PublishVersion(ctx context.Context, tenantID, versionID string, req *models.PublishVersionRequest) (*models.Version, error) {
	v, err := s.repo.GetVersion(ctx, tenantID, versionID)
	if err != nil {
		return nil, ErrNotFound
	}

	if v.Status == models.StatusPublished {
		return nil, ErrAlreadyPublished
	}

	makeDefault := false
	if req != nil && req.MakeDefault != nil {
		makeDefault = *req.MakeDefault
	}

	if makeDefault {
		if err := s.repo.ClearDefaultForPipeline(ctx, tenantID, v.PipelineID); err != nil {
			return nil, err
		}
	}

	publishedAt := time.Now().UTC()
	if err := s.repo.SetStatusPublished(ctx, tenantID, versionID, publishedAt, makeDefault); err != nil {
		return nil, err
	}
	updated, err := s.repo.GetVersion(ctx, tenantID, versionID)
	if err != nil {
		return nil, ErrNotFound
	}
	return updated, nil
}

// --- Deprecate ---

func (s *Service) DeprecateVersion(ctx context.Context, tenantID, versionID string) (*models.Version, error) {
	if _, err := s.repo.GetVersion(ctx, tenantID, versionID); err != nil {
		return nil, ErrNotFound
	}

	if err := s.repo.SetStatusDeprecated(ctx, tenantID, versionID); err != nil {
		return nil, err
	}
	updated, err := s.repo.GetVersion(ctx, tenantID, versionID)
	if err != nil {
		return nil, ErrNotFound
	}
	return updated, nil
}

// --- Rollback ---

func (s *Service) RollbackVersion(ctx context.Context, tenantID, pipelineID string, req *models.RollbackVersionRequest) (*models.Version, error) {
	if req == nil || req.Reason == "" {
		return nil, ErrBadRequest
	}

	if req.TargetVersionID != nil && *req.TargetVersionID != "" {
		return s.repo.GetVersion(ctx, tenantID, *req.TargetVersionID)
	}

	// Find second-to-last published version (rollback target)
	published, err := s.repo.ListPublishedVersions(ctx, tenantID, pipelineID)
	if err != nil {
		return nil, err
	}
	if len(published) < 2 {
		return nil, ErrNoRollbackTarget
	}
	return &published[1], nil
}

// --- Compare ---

func (s *Service) CompareVersions(ctx context.Context, tenantID string, req *models.CompareVersionsRequest) (*models.CompareResult, error) {
	if req == nil || req.FromVersionID == "" || req.ToVersionID == "" {
		return nil, ErrBadRequest
	}

	from, err := s.repo.GetVersion(ctx, tenantID, req.FromVersionID)
	if err != nil {
		return nil, ErrNotFound
	}
	to, err := s.repo.GetVersion(ctx, tenantID, req.ToVersionID)
	if err != nil {
		return nil, ErrNotFound
	}

	includeConfig := true
	if req.IncludeConfig != nil {
		includeConfig = *req.IncludeConfig
	}

	diff := calculateDiff(from.Config, to.Config, includeConfig)

	return &models.CompareResult{
		From:    *from,
		To:      *to,
		Diff:    diff,
		Fields:  buildDiffKeys(diff),
	}, nil
}

// --- Internal ---

func (s *Service) generateVersionNumber(ctx context.Context, tenantID, pipelineID string) (string, error) {
	versions, err := s.repo.ListPublishedVersions(ctx, tenantID, pipelineID)
	if err != nil {
		return "", err
	}
	// Count published versions to determine next minor
	n := len(versions) + 1
	return "v1." + strconv.Itoa(n) + ".0", nil
}

func calculateDiff(fromConfig, toConfig string, includeConfig bool) map[string]any {
	diff := make(map[string]any)

	if includeConfig {
		// Deep config diff
		var fromMap, toMap map[string]any
		if err := json.Unmarshal([]byte(fromConfig), &fromMap); err != nil {
			fromMap = map[string]any{}
		}
		if err := json.Unmarshal([]byte(toConfig), &toMap); err != nil {
			toMap = map[string]any{}
		}
		for k := range fromMap {
			if toMap[k] == nil || jsonMarshal(fromMap[k]) != jsonMarshal(toMap[k]) {
				diff[k] = map[string]any{"from": fromMap[k], "to": nil}
			}
		}
		for k := range toMap {
			if fromMap[k] == nil {
				diff[k] = map[string]any{"from": nil, "to": toMap[k]}
			} else if jsonMarshal(fromMap[k]) != jsonMarshal(toMap[k]) {
				diff[k] = map[string]any{"from": fromMap[k], "to": toMap[k]}
			}
		}
	}

	return diff
}

func jsonMarshal(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func buildDiffKeys(diff map[string]any) []string {
	keys := make([]string, 0, len(diff))
	for k := range diff {
		keys = append(keys, k)
	}
	return keys
}
