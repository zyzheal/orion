package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/config-mgmt-svc-go/internal/models"
	"orion/config-mgmt-svc-go/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrConfigNotFound  = errors.New("config item not found")
	ErrVersionNotFound = errors.New("config version not found")
	ErrAlreadyExists   = errors.New("config already exists in target environment")
	ErrInvalidVersion  = errors.New("target version must be less than current version")
)

const (
	ChangeTypeCreate   = "create"
	ChangeTypeUpdate   = "update"
	ChangeTypeRollback = "rollback"
	DefaultEnv         = "production"
	DefaultVersion     = 1
	MaxHistoryLimit    = 200
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ==================== Core CRUD ====================

// Create creates a new config item and records the initial version.
func (s *Service) Create(ctx context.Context, tenantID string, req *models.CreateConfigRequest) (*models.ConfigItem, error) {
	env := req.Env
	if env == "" {
		env = DefaultEnv
	}

	c := &models.ConfigItem{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Key:         req.Key,
		Value:       req.Value,
		Environment: env,
		Version:     DefaultVersion,
	}

	if err := s.repo.Create(ctx, c); err != nil {
		return nil, fmt.Errorf("create config: %w", err)
	}

	// Record initial version
	if err := s.saveVersion(ctx, c, ChangeTypeCreate, "", "Initial creation"); err != nil {
		// Log but don't fail the create
		_ = err
	}

	return c, nil
}

// List returns a paginated list of config items.
func (s *Service) List(ctx context.Context, tenantID string, offset, limit int) ([]models.ConfigItem, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

// GetByID returns a config item by ID.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.ConfigItem, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

// GetByKey returns a config item by key, optionally filtering by environment.
func (s *Service) GetByKey(ctx context.Context, tenantID, key, environment string) (*models.ConfigItem, error) {
	return s.repo.GetByKey(ctx, tenantID, key, environment)
}

// Update modifies the value of a config item and records a version.
func (s *Service) Update(ctx context.Context, tenantID, id, value string) (*models.ConfigItem, error) {
	c, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrConfigNotFound
	}
	oldValue := c.Value
	c.Value = value

	if err := s.repo.Update(ctx, c); err != nil {
		return nil, fmt.Errorf("update config: %w", err)
	}

	// Refresh to get updated version number
	c, _ = s.repo.GetByID(ctx, tenantID, id)

	// Record version
	if err := s.saveVersion(ctx, c, ChangeTypeUpdate, "", ""); err != nil {
		_ = err
	}

	_ = oldValue
	return c, nil
}

// Delete removes a config item.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Count returns the total number of config items for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// ==================== SetConfig (upsert by key) ====================

// SetConfig creates or updates a config by key + environment, tracking changes.
func (s *Service) SetConfig(ctx context.Context, tenantID string, req *models.SetConfigRequest) (*models.ConfigItem, error) {
	env := req.Environment
	if env == "" {
		env = DefaultEnv
	}

	// Look up existing
	existing, err := s.repo.GetByKey(ctx, tenantID, req.Key, env)

	var changeType string
	var oldVal string

	if err != nil || existing == nil {
		// New config
		changeType = ChangeTypeCreate
		existing = &models.ConfigItem{
			ID:          uuid.New().String(),
			TenantID:    tenantID,
			Key:         req.Key,
			Value:       req.Value,
			Environment: env,
			Version:     DefaultVersion,
		}
	} else {
		// Update existing
		changeType = ChangeTypeUpdate
		oldVal = existing.Value
		existing.Value = req.Value
	}

	if err := s.repo.Upsert(ctx, existing); err != nil {
		return nil, fmt.Errorf("set config: %w", err)
	}

	// Re-fetch to get correct version
	updated, _ := s.repo.GetByKey(ctx, tenantID, req.Key, env)

	// Record version
	reason := req.Reason
	if reason == "" && changeType == ChangeTypeUpdate {
		reason = fmt.Sprintf("Updated by %s", req.ChangedBy)
	}
	if err := s.saveVersion(ctx, updated, changeType, req.ChangedBy, reason); err != nil {
		_ = err
	}

	_ = oldVal
	return updated, nil
}

// ==================== Config History ====================

// GetConfigHistory returns version history for a config by ID.
func (s *Service) GetConfigHistory(ctx context.Context, tenantID, configID string, limit int) ([]models.ConfigVersion, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > MaxHistoryLimit {
		limit = MaxHistoryLimit
	}
	return s.repo.GetVersions(ctx, tenantID, configID, limit)
}

// GetConfigHistoryByKey returns version history for a config by key.
func (s *Service) GetConfigHistoryByKey(ctx context.Context, tenantID, key, environment string, limit int) ([]models.ConfigVersion, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > MaxHistoryLimit {
		limit = MaxHistoryLimit
	}
	return s.repo.GetVersionsByKey(ctx, tenantID, key, environment, limit)
}

// ==================== DiffConfigs ====================

// DiffEnvironments compares all configs between two environments for a tenant.
func (s *Service) DiffEnvironments(ctx context.Context, tenantID, sourceEnv, targetEnv string) (*models.DiffReport, error) {
	sourceConfigs, err := s.repo.GetByEnvironment(ctx, tenantID, sourceEnv)
	if err != nil {
		return nil, fmt.Errorf("fetch source env: %w", err)
	}
	targetConfigs, err := s.repo.GetByEnvironment(ctx, tenantID, targetEnv)
	if err != nil {
		return nil, fmt.Errorf("fetch target env: %w", err)
	}

	// Build lookup maps
	targetMap := make(map[string]models.ConfigItem, len(targetConfigs))
	for _, tc := range targetConfigs {
		targetMap[tc.Key] = tc
	}
	sourceMap := make(map[string]models.ConfigItem, len(sourceConfigs))
	for _, sc := range sourceConfigs {
		sourceMap[sc.Key] = sc
	}

	var diffs []models.ConfigDiff

	// Check source against target
	for _, sc := range sourceConfigs {
		tc, exists := targetMap[sc.Key]
		if !exists {
			diffs = append(diffs, models.ConfigDiff{
				Key:         sc.Key,
				Environment: targetEnv,
				OldValue:    sc.Value,
				ChangeType:  "added",
			})
		} else if sc.Value != tc.Value {
			diffs = append(diffs, models.ConfigDiff{
				Key:         sc.Key,
				Environment: targetEnv,
				OldValue:    sc.Value,
				NewValue:    tc.Value,
				ChangeType:  "modified",
			})
		}
	}

	// Check target configs not in source (removed)
	for _, tc := range targetConfigs {
		if _, exists := sourceMap[tc.Key]; !exists {
			diffs = append(diffs, models.ConfigDiff{
				Key:         tc.Key,
				Environment: targetEnv,
				NewValue:    tc.Value,
				ChangeType:  "removed",
			})
		}
	}

	var added, removed, modified int
	for _, d := range diffs {
		switch d.ChangeType {
		case "added":
			added++
		case "removed":
			removed++
		case "modified":
			modified++
		}
	}

	return &models.DiffReport{
		SourceEnv:    sourceEnv,
		TargetEnv:    targetEnv,
		Diffs:        diffs,
		TotalChanges: len(diffs),
		Added:        added,
		Removed:      removed,
		Modified:     modified,
		GeneratedAt:  nowUTC(),
	}, nil
}

// DiffVersions compares two specific versions of a config item.
func (s *Service) DiffVersions(ctx context.Context, tenantID, configID string, fromVersion, toVersion int) (*models.VersionDiffReport, error) {
	versions, err := s.repo.GetVersions(ctx, tenantID, configID, MaxHistoryLimit)
	if err != nil {
		return nil, fmt.Errorf("fetch versions: %w", err)
	}

	var from, to *models.ConfigVersion
	for i := range versions {
		if versions[i].VersionNumber == fromVersion {
			from = &versions[i]
		}
		if versions[i].VersionNumber == toVersion {
			to = &versions[i]
		}
	}

	if from == nil {
		return nil, fmt.Errorf("version %d: %w", fromVersion, ErrVersionNotFound)
	}
	if to == nil {
		return nil, fmt.Errorf("version %d: %w", toVersion, ErrVersionNotFound)
	}

	return &models.VersionDiffReport{
		ConfigID:    configID,
		Key:         from.ConfigKey,
		Environment: from.Environment,
		FromVersion: fromVersion,
		ToVersion:   toVersion,
		OldValue:    from.Value,
		NewValue:    to.Value,
		GeneratedAt: nowUTC(),
	}, nil
}

// ==================== ExportConfig ====================

// ExportConfigs exports all configs for a tenant, optionally filtered by environment.
func (s *Service) ExportConfigs(ctx context.Context, tenantID, environment string) (*models.ExportData, error) {
	var items []models.ConfigItem
	var err error

	if environment != "" {
		items, err = s.repo.GetByEnvironment(ctx, tenantID, environment)
	} else {
		items, err = s.repo.GetAll(ctx, tenantID)
	}
	if err != nil {
		return nil, fmt.Errorf("export configs: %w", err)
	}

	return &models.ExportData{
		TenantID:    tenantID,
		Environment: environment,
		ExportedAt:  nowUTC(),
		Count:       len(items),
		Items:       items,
	}, nil
}

// ImportConfigs bulk-imports config items.
func (s *Service) ImportConfigs(ctx context.Context, tenantID string, items []models.SetConfigRequest, changedBy string) (created int, skipped int, errs []string) {
	for _, item := range items {
		if item.ChangedBy == "" {
			item.ChangedBy = changedBy
		}
		_, err := s.SetConfig(ctx, tenantID, &item)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s: %s", item.Key, err.Error()))
			continue
		}
		created++
	}
	return
}

// ==================== Rollback ====================

// RollbackConfig rolls a config back to a specific version.
func (s *Service) RollbackConfig(ctx context.Context, tenantID, configID string, req *models.RollbackRequest) (*models.RollbackResult, error) {
	existing, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, ErrConfigNotFound
	}

	if req.TargetVersion >= existing.Version {
		return nil, ErrInvalidVersion
	}

	// Find the target version
	versions, err := s.repo.GetVersions(ctx, tenantID, configID, MaxHistoryLimit)
	if err != nil {
		return nil, fmt.Errorf("fetch versions: %w", err)
	}

	var target *models.ConfigVersion
	for i := range versions {
		if versions[i].VersionNumber == req.TargetVersion {
			target = &versions[i]
			break
		}
	}
	if target == nil {
		return nil, ErrVersionNotFound
	}

	// Apply the rollback value
	existing.Value = target.Value
	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, fmt.Errorf("rollback update: %w", err)
	}

	// Refresh to get new version
	updated, _ := s.repo.GetByID(ctx, tenantID, configID)

	// Record rollback version
	if err := s.saveVersion(ctx, updated, ChangeTypeRollback, req.RolledBackBy,
		fmt.Sprintf("Rolled back to version %d", req.TargetVersion)); err != nil {
		_ = err
	}

	// Refresh again after version save
	updated, _ = s.repo.GetByID(ctx, tenantID, configID)

	return &models.RollbackResult{
		Success:          true,
		NewVersionID:     updated.ID,
		NewVersionNumber: updated.Version,
		RolledBackTo:     req.TargetVersion,
		RolledBackBy:     req.RolledBackBy,
		RolledBackAt:     nowUTC(),
	}, nil
}

// ==================== Validation ====================

// ValidateConfig checks a config value for common issues.
func (s *Service) ValidateConfig(_ context.Context, key, value, environment string) *models.ValidationResult {
	var issues []models.ValidationIssue

	// Validate key format
	if strings.TrimSpace(key) == "" {
		issues = append(issues, models.ValidationIssue{
			Key: key, Field: "key", Message: "config key must not be empty", Level: "error",
		})
	}
	if len(key) > 256 {
		issues = append(issues, models.ValidationIssue{
			Key: key, Field: "key", Message: "config key must not exceed 256 characters", Level: "error",
		})
	}

	// Validate environment
	validEnvs := map[string]bool{"dev": true, "staging": true, "production": true, "test": true}
	if environment != "" && !validEnvs[environment] {
		issues = append(issues, models.ValidationIssue{
			Key: key, Field: "environment",
			Message: fmt.Sprintf("invalid environment '%s'; expected: dev, staging, production, test", environment),
			Level:   "warning",
		})
	}

	// Validate value is valid JSON if it looks like JSON
	trimmed := strings.TrimSpace(value)
	if len(trimmed) > 0 && (trimmed[0] == '{' || trimmed[0] == '[' || trimmed[0] == '"') {
		if !json.Valid([]byte(value)) {
			issues = append(issues, models.ValidationIssue{
				Key: key, Field: "value", Message: "value appears to be JSON but is not valid", Level: "error",
			})
		}
	}

	// Check for empty value
	if strings.TrimSpace(value) == "" {
		issues = append(issues, models.ValidationIssue{
			Key: key, Field: "value", Message: "config value is empty", Level: "warning",
		})
	}

	return &models.ValidationResult{
		Valid:  !hasErrors(issues),
		Issues: issues,
	}
}

// ==================== Clone ====================

// CloneConfig copies a config to a different environment.
func (s *Service) CloneConfig(ctx context.Context, tenantID, configID, targetEnv, changedBy string) (*models.ConfigItem, error) {
	source, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, ErrConfigNotFound
	}

	// Check target doesn't already exist
	existing, _ := s.repo.GetByKey(ctx, tenantID, source.Key, targetEnv)
	if existing != nil {
		return nil, ErrAlreadyExists
	}

	clone := &models.ConfigItem{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Key:         source.Key,
		Value:       source.Value,
		Environment: targetEnv,
		Version:     DefaultVersion,
	}

	if err := s.repo.Create(ctx, clone); err != nil {
		return nil, fmt.Errorf("clone config: %w", err)
	}

	return clone, nil
}

// ==================== Internal Helpers ====================

func (s *Service) saveVersion(ctx context.Context, c *models.ConfigItem, changeType, changedBy, reason string) error {
	if c == nil {
		return nil
	}
	v := &models.ConfigVersion{
		ID:            uuid.New().String(),
		TenantID:      c.TenantID,
		ConfigID:      c.ID,
		ConfigKey:     c.Key,
		Environment:   c.Environment,
		Value:         c.Value,
		VersionNumber: c.Version,
		ChangeType:    changeType,
		ChangedBy:     changedBy,
		ChangeReason:  reason,
	}
	return s.repo.SaveVersion(ctx, v)
}

func hasErrors(issues []models.ValidationIssue) bool {
	for _, i := range issues {
		if i.Level == "error" {
			return true
		}
	}
	return false
}

func nowUTC() time.Time {
	return time.Now().UTC()
}
