package service

import (
	"context"
	"crypto/sha256"
	"fmt"

	"orion/config-mgmt-svc-go/internal/models"
	"orion/config-mgmt-svc-go/internal/repository"

	"github.com/google/uuid"
)

// FeatureFlagService manages feature flags and evaluates them for users.
type FeatureFlagService struct {
	repo *repository.Repository
}

func NewFeatureFlagService(repo *repository.Repository) *FeatureFlagService {
	return &FeatureFlagService{repo: repo}
}

func (s *FeatureFlagService) Create(ctx context.Context, tenantID string, req models.CreateFeatureFlagRequest) (*models.FeatureFlag, error) {
	enabled := false
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	env := req.Environment
	if env == "" {
		env = "production"
	}
	flagType := req.FlagType
	if flagType == "" {
		flagType = "boolean"
	}

	flag := &models.FeatureFlag{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Key:         req.Key,
		Name:        req.Name,
		Description: req.Description,
		Enabled:     enabled,
		Environment: env,
		FlagType:    flagType,
		RolloutPct:  req.RolloutPct,
		Variations:  req.Variations,
	}
	if req.Whitelist != nil {
		flag.Whitelist = models.JSONB{}
		for i, w := range req.Whitelist {
			flag.Whitelist[fmt.Sprintf("%d", i)] = w
		}
	}
	if req.Tags != nil {
		flag.Tags = models.JSONB{}
		for i, t := range req.Tags {
			flag.Tags[fmt.Sprintf("%d", i)] = t
		}
	}
	if err := s.repo.CreateFeatureFlag(ctx, flag); err != nil {
		return nil, err
	}
	return flag, nil
}

func (s *FeatureFlagService) Get(ctx context.Context, tenantID, key, environment string) (*models.FeatureFlag, error) {
	if environment == "" {
		environment = "production"
	}
	return s.repo.GetFeatureFlag(ctx, tenantID, key, environment)
}

func (s *FeatureFlagService) List(ctx context.Context, tenantID, environment string) ([]models.FeatureFlag, error) {
	return s.repo.ListFeatureFlags(ctx, tenantID, environment)
}

func (s *FeatureFlagService) Update(ctx context.Context, tenantID, key, environment string, req models.UpdateFeatureFlagRequest) (*models.FeatureFlag, error) {
	if environment == "" {
		environment = "production"
	}
	existing, err := s.repo.GetFeatureFlag(ctx, tenantID, key, environment)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}
	if req.FlagType != nil {
		existing.FlagType = *req.FlagType
	}
	if req.RolloutPct != nil {
		existing.RolloutPct = *req.RolloutPct
	}
	if req.Variations != nil {
		existing.Variations = *req.Variations
	}
	if err := s.repo.UpdateFeatureFlag(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *FeatureFlagService) Delete(ctx context.Context, tenantID, key, environment string) error {
	if environment == "" {
		environment = "production"
	}
	return s.repo.DeleteFeatureFlag(ctx, tenantID, key, environment)
}

// EvaluateFlag evaluates a feature flag for a specific user.
func (s *FeatureFlagService) EvaluateFlag(ctx context.Context, tenantID string, req models.EvaluateFlagRequest) (*models.EvaluateFlagResult, error) {
	env := req.Environment
	if env == "" {
		env = "production"
	}

	flag, err := s.repo.GetFeatureFlag(ctx, tenantID, req.Key, env)
	if err != nil {
		return &models.EvaluateFlagResult{
			Key:     req.Key,
			Enabled: false,
			Reason:  "flag_not_found",
		}, nil
	}

	if !flag.Enabled {
		return &models.EvaluateFlagResult{
			Key:     req.Key,
			Enabled: false,
			Reason:  "flag_disabled",
		}, nil
	}

	switch flag.FlagType {
	case "boolean":
		return &models.EvaluateFlagResult{
			Key:     req.Key,
			Enabled: true,
			Reason:  "boolean_flag",
		}, nil

	case "percentage":
		if req.UserID == "" {
			return &models.EvaluateFlagResult{
				Key:     req.Key,
				Enabled: flag.RolloutPct > 50,
				Reason:  "no_user_id_default",
			}, nil
		}
		hash := sha256.Sum256([]byte(flag.Key + ":" + req.UserID))
		bucket := int(hash[0]) % 100
		enabled := bucket < flag.RolloutPct
		return &models.EvaluateFlagResult{
			Key:     req.Key,
			Enabled: enabled,
			Reason:  fmt.Sprintf("percentage_bucket_%d", bucket),
		}, nil

	case "whitelist":
		if req.UserID == "" {
			return &models.EvaluateFlagResult{
				Key:     req.Key,
				Enabled: false,
				Reason:  "no_user_id",
			}, nil
		}
		if flag.Whitelist != nil {
			for _, v := range flag.Whitelist {
				if v == req.UserID {
					return &models.EvaluateFlagResult{
						Key:     req.Key,
						Enabled: true,
						Reason:  "whitelisted",
					}, nil
				}
			}
		}
		return &models.EvaluateFlagResult{
			Key:     req.Key,
			Enabled: false,
			Reason:  "not_whitelisted",
		}, nil

	default:
		return &models.EvaluateFlagResult{
			Key:     req.Key,
			Enabled: flag.Enabled,
			Reason:  "default_enabled",
		}, nil
	}
}
