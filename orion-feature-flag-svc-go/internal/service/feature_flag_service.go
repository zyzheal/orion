package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"orion/feature-flag-svc-go/internal/models"
	"orion/feature-flag-svc-go/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrFlagNotFound    = errors.New("feature flag not found")
	ErrDuplicateKey    = errors.New("feature flag with this key already exists")
	ErrInvalidRollout  = errors.New("rollout percentage must be between 0 and 100")
)

// Service implements the feature flag business logic.
type Service struct {
	repo *repository.Repository
}

// NewService creates a new Service instance.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// -------------------------------------------------------
// CRUD Operations
// -------------------------------------------------------

// Create creates a new feature flag after checking for duplicate keys.
func (s *Service) Create(ctx context.Context, tenantID, createdBy string, req *models.CreateFlagRequest) (*models.FeatureFlag, error) {
	// Check for duplicate key within tenant.
	existing, _ := s.repo.GetByKey(ctx, tenantID, req.Key)
	if existing != nil {
		return nil, ErrDuplicateKey
	}

	now := time.Now()
	flag := &models.FeatureFlag{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		Name:            req.Name,
		Key:             req.Key,
		Description:     req.Description,
		Status:          models.FlagStatusActive,
		DefaultValue:    false,
		RolloutPct:      0,
		RolloutStrategy: models.RolloutPercentage,
		TargetingRules:  models.JSONArray{},
		Environments:    models.StringArray{"development", "staging", "production"},
		Tags:            models.StringArray{},
		CreatedBy:       createdBy,
		UpdatedBy:       createdBy,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	// Apply optional fields from request.
	if req.DefaultValue != nil {
		flag.DefaultValue = *req.DefaultValue
	}
	if req.RolloutPct != nil {
		flag.RolloutPct = *req.RolloutPct
	}
	if req.RolloutStrategy != nil {
		flag.RolloutStrategy = *req.RolloutStrategy
	}
	if req.TargetingRules != nil {
		rules := make(models.JSONArray, len(req.TargetingRules))
		for i, tr := range req.TargetingRules {
			rules[i] = tr
		}
		flag.TargetingRules = rules
	}
	if req.Environments != nil {
		flag.Environments = models.StringArray(req.Environments)
	}
	if req.Tags != nil {
		flag.Tags = models.StringArray(req.Tags)
	}

	if err := s.repo.Create(ctx, flag); err != nil {
		return nil, fmt.Errorf("failed to create feature flag: %w", err)
	}
	return flag, nil
}

// GetByID retrieves a feature flag by id.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.FeatureFlag, error) {
	flag, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrFlagNotFound
	}
	return flag, nil
}

// GetByKey retrieves a feature flag by key.
func (s *Service) GetByKey(ctx context.Context, tenantID, key string) (*models.FeatureFlag, error) {
	flag, err := s.repo.GetByKey(ctx, tenantID, key)
	if err != nil {
		return nil, ErrFlagNotFound
	}
	return flag, nil
}

// List retrieves feature flags with optional filters and pagination.
func (s *Service) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.FeatureFlag, error) {
	return s.repo.List(ctx, tenantID, filter, offset, limit)
}

// Search performs a text search across flag name, key, and description.
func (s *Service) Search(ctx context.Context, tenantID, query string, offset, limit int) ([]models.FeatureFlag, error) {
	return s.repo.Search(ctx, tenantID, query, offset, limit)
}

// Update modifies an existing feature flag using partial update semantics.
func (s *Service) Update(ctx context.Context, tenantID, id, updatedBy string, req *models.UpdateFlagRequest) (*models.FeatureFlag, error) {
	flag, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrFlagNotFound
	}

	if req.Name != nil {
		flag.Name = *req.Name
	}
	if req.Description != nil {
		flag.Description = *req.Description
	}
	if req.Status != nil {
		flag.Status = *req.Status
	}
	if req.DefaultValue != nil {
		flag.DefaultValue = *req.DefaultValue
	}
	if req.RolloutPct != nil {
		flag.RolloutPct = *req.RolloutPct
	}
	if req.RolloutStrategy != nil {
		flag.RolloutStrategy = *req.RolloutStrategy
	}
	if req.TargetingRules != nil {
		rules := make(models.JSONArray, len(req.TargetingRules))
		for i, tr := range req.TargetingRules {
			rules[i] = tr
		}
		flag.TargetingRules = rules
	}
	if req.Environments != nil {
		flag.Environments = models.StringArray(req.Environments)
	}
	if req.Tags != nil {
		flag.Tags = models.StringArray(req.Tags)
	}

	flag.UpdatedBy = updatedBy
	flag.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, flag); err != nil {
		return nil, fmt.Errorf("failed to update feature flag: %w", err)
	}
	return flag, nil
}

// Delete removes a feature flag by id.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Count returns the total number of feature flags for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// -------------------------------------------------------
// Rollout Management
// -------------------------------------------------------

// SetRolloutPercentage sets the rollout percentage for a flag (0-100).
func (s *Service) SetRolloutPercentage(ctx context.Context, tenantID, id, updatedBy string, percentage int) (*models.FeatureFlag, error) {
	if percentage < 0 || percentage > 100 {
		return nil, ErrInvalidRollout
	}
	pct := percentage
	req := &models.UpdateFlagRequest{RolloutPct: &pct}
	return s.Update(ctx, tenantID, id, updatedBy, req)
}

// -------------------------------------------------------
// Flag Evaluation
// -------------------------------------------------------

// EvaluateFlag evaluates a single feature flag given a context.
// Follows the Node.js evaluation order: status check -> environment check -> targeting rules -> percentage rollout -> default.
func (s *Service) EvaluateFlag(ctx context.Context, tenantID string, req *models.EvaluateFlagRequest) (*models.FlagEvaluationResult, error) {
	now := time.Now()

	flag, err := s.repo.GetByKey(ctx, tenantID, req.FlagKey)
	if err != nil {
		return &models.FlagEvaluationResult{
			Key:         req.FlagKey,
			Enabled:     false,
			Reason:      "Flag not found",
			EvaluatedAt: now,
		}, nil
	}

	// Check status: only active flags are evaluated.
	if flag.Status != models.FlagStatusActive {
		return &models.FlagEvaluationResult{
			FlagID:      flag.ID,
			Key:         req.FlagKey,
			Enabled:     false,
			Reason:      fmt.Sprintf("Flag is %s", flag.Status),
			EvaluatedAt: now,
		}, nil
	}

	// Check environment: if an environment is specified but not in the flag's environments list, return default.
	if req.Environment != "" && !containsEnvironment(flag.Environments, req.Environment) {
		return &models.FlagEvaluationResult{
			FlagID:      flag.ID,
			Key:         req.FlagKey,
			Enabled:     flag.DefaultValue,
			Reason:      "Environment not enabled",
			EvaluatedAt: now,
		}, nil
	}

	// Check targeting rules: all rules must match for the flag to be enabled.
	if len(flag.TargetingRules) > 0 && req.Attributes != nil {
		if matchTargetingRules(flag.TargetingRules, req.Attributes) {
			return &models.FlagEvaluationResult{
				FlagID:      flag.ID,
				Key:         req.FlagKey,
				Enabled:     true,
				Reason:      "Targeting rules matched",
				EvaluatedAt: now,
			}, nil
		}
	}

	// Percentage-based rollout with deterministic user bucketing.
	if flag.RolloutStrategy == models.RolloutPercentage && req.UserID != "" {
		hash := hashUserID(req.UserID, req.FlagKey)
		enabled := hash < flag.RolloutPct
		reason := fmt.Sprintf("Rollout %d%%: user excluded", flag.RolloutPct)
		if enabled {
			reason = fmt.Sprintf("Rollout %d%%: user included", flag.RolloutPct)
		}
		return &models.FlagEvaluationResult{
			FlagID:      flag.ID,
			Key:         req.FlagKey,
			Enabled:     enabled,
			Reason:      reason,
			EvaluatedAt: now,
		}, nil
	}

	// Fall back to default value.
	return &models.FlagEvaluationResult{
		FlagID:      flag.ID,
		Key:         req.FlagKey,
		Enabled:     flag.DefaultValue,
		Reason:      "Default value",
		EvaluatedAt: now,
	}, nil
}

// EvaluateFlags evaluates multiple flags in batch for a given tenant.
func (s *Service) EvaluateFlags(ctx context.Context, tenantID string, reqs []models.EvaluateFlagRequest) ([]models.FlagEvaluationResult, error) {
	results := make([]models.FlagEvaluationResult, len(reqs))
	for i, req := range reqs {
		result, err := s.EvaluateFlag(ctx, tenantID, &req)
		if err != nil {
			return nil, err
		}
		results[i] = *result
	}
	return results, nil
}

// -------------------------------------------------------
// Toggle History
// -------------------------------------------------------

// RecordToggle records a toggle event in the history table.
func (s *Service) RecordToggle(ctx context.Context, flagID string, oldValue, newValue bool, changedBy, reason string) error {
	rec := &models.FlagToggleRecord{
		ID:        uuid.New().String(),
		FlagID:    flagID,
		OldValue:  oldValue,
		NewValue:  newValue,
		ChangedBy: changedBy,
		Reason:    reason,
		ChangedAt: time.Now(),
	}
	return s.repo.InsertToggleRecord(ctx, rec)
}

// ListToggleHistory retrieves the toggle history for a flag.
func (s *Service) ListToggleHistory(ctx context.Context, flagID string, limit int) ([]models.FlagToggleRecord, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.repo.ListToggleHistory(ctx, flagID, limit)
}

// -------------------------------------------------------
// Internal helpers
// -------------------------------------------------------

// hashUserID produces a deterministic 0-99 bucket for a user+flag combination.
// Mirrors the Node.js hashUserId function.
func hashUserID(userID, flagKey string) int {
	str := userID + ":" + flagKey
	var hash int32
	for i := 0; i < len(str); i++ {
		hash = (hash << 5) - hash + int32(str[i])
	}
	return int(math.Abs(float64(hash))) % 100
}

// containsEnvironment checks if an environment string is in the environments array.
func containsEnvironment(envs models.StringArray, env string) bool {
	for _, e := range envs {
		if e == env {
			return true
		}
	}
	return false
}

// matchTargetingRules evaluates all targeting rules against the given attributes.
// All rules must match (AND logic), mirroring the Node.js implementation.
func matchTargetingRules(rules models.JSONArray, attributes map[string]interface{}) bool {
	for _, r := range rules {
		ruleMap, ok := r.(map[string]interface{})
		if !ok {
			continue
		}
		attr, _ := ruleMap["attribute"].(string)
		op, _ := ruleMap["operator"].(string)
		ruleValue := ruleMap["value"]

		attrValue, exists := attributes[attr]
		if !exists {
			return false
		}

		if !evaluateRule(op, ruleValue, attrValue) {
			return false
		}
	}
	return true
}

// evaluateRule evaluates a single targeting rule operator.
func evaluateRule(operator string, ruleValue, attrValue interface{}) bool {
	switch operator {
	case "equals":
		return fmt.Sprintf("%v", attrValue) == fmt.Sprintf("%v", ruleValue)
	case "contains":
		return strings.Contains(fmt.Sprintf("%v", attrValue), fmt.Sprintf("%v", ruleValue))
	case "in":
		values, ok := ruleValue.([]interface{})
		if !ok {
			return false
		}
		attrStr := fmt.Sprintf("%v", attrValue)
		for _, v := range values {
			if fmt.Sprintf("%v", v) == attrStr {
				return true
			}
		}
		return false
	case "gt":
		attrNum, err1 := toFloat(attrValue)
		ruleNum, err2 := toFloat(ruleValue)
		if err1 != nil || err2 != nil {
			return false
		}
		return attrNum > ruleNum
	case "lt":
		attrNum, err1 := toFloat(attrValue)
		ruleNum, err2 := toFloat(ruleValue)
		if err1 != nil || err2 != nil {
			return false
		}
		return attrNum < ruleNum
	case "regex":
		pattern, ok := ruleValue.(string)
		if !ok {
			return false
		}
		matched, err := regexp.MatchString(pattern, fmt.Sprintf("%v", attrValue))
		return err == nil && matched
	default:
		return false
	}
}

// toFloat converts an interface{} to float64 for numeric comparisons.
func toFloat(v interface{}) (float64, error) {
	switch n := v.(type) {
	case float64:
		return n, nil
	case float32:
		return float64(n), nil
	case int:
		return float64(n), nil
	case int64:
		return float64(n), nil
	case string:
		return strconv.ParseFloat(n, 64)
	default:
		return 0, fmt.Errorf("cannot convert %T to float64", v)
	}
}
