package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/config/internal/config/models"
	"orion/platform-svc-go/internal/config/internal/config/repository"
	"orion/go-common/pkg/otel"

	"github.com/google/uuid"
)

// CanaryService manages canary deployments for configurations.
type CanaryService struct {
	repo *repository.Repository
}

func NewCanaryService(repo *repository.Repository) *CanaryService {
	return &CanaryService{repo: repo}
}

// Create starts a canary deployment for a config.
func (s *CanaryService) Create(ctx context.Context, tenantID, configID string, req *models.CreateCanaryRequest) (*models.ConfigCanary, error) {
	ctx, span := otel.Tracer("orion-config-mgmt-svc").Start(ctx, "CanaryService.Create")
	defer span.End()

	// Check config exists
	cfg, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, fmt.Errorf("config not found: %w", err)
	}

	// Check if there's already an active canary for this config
	existing, _ := s.repo.GetActiveCanary(ctx, tenantID, configID)
	if existing != nil {
		return nil, fmt.Errorf("an active canary already exists for this config")
	}

	canary := &models.ConfigCanary{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		ConfigID:      configID,
		CanaryValue:   req.CanaryValue,
		BaselineValue: cfg.Value,
		Status:        models.CanaryStatusActive,
		CreatedBy:     req.CreatedBy,
		CreatedAt:     time.Now().UTC(),
	}

	if err := s.repo.CreateCanary(ctx, canary); err != nil {
		return nil, fmt.Errorf("create canary: %w", err)
	}

	return canary, nil
}

// Promote promotes a canary to become the official config value.
func (s *CanaryService) Promote(ctx context.Context, tenantID, configID, canaryID string) (*models.ConfigItem, error) {
	ctx, span := otel.Tracer("orion-config-mgmt-svc").Start(ctx, "CanaryService.Promote")
	defer span.End()

	canary, err := s.repo.GetCanary(ctx, tenantID, canaryID)
	if err != nil {
		return nil, fmt.Errorf("canary not found: %w", err)
	}

	if canary.Status != models.CanaryStatusActive {
		return nil, fmt.Errorf("canary is not in active state, current status: %s", canary.Status)
	}

	// Update the config with the canary value
	cfg, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, fmt.Errorf("config not found: %w", err)
	}
	cfg.Value = canary.CanaryValue

	if err := s.repo.Update(ctx, cfg); err != nil {
		return nil, fmt.Errorf("promote canary: %w", err)
	}

	// Mark canary as promoted
	if err := s.repo.UpdateCanaryStatus(ctx, tenantID, canaryID, models.CanaryStatusPromoted); err != nil {
		return nil, fmt.Errorf("update canary status: %w", err)
	}

	// Re-fetch to get updated version
	updated, _ := s.repo.GetByID(ctx, tenantID, configID)

	// Record version
	v := &models.ConfigVersion{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		ConfigID:      configID,
		ConfigKey:     cfg.Key,
		Environment:   cfg.Environment,
		Value:         canary.CanaryValue,
		VersionNumber: updated.Version,
		ChangeType:    "canary_promote",
		ChangedBy:     canary.CreatedBy,
		ChangeReason:  fmt.Sprintf("Promoted from canary %s", canaryID),
	}
	_ = s.repo.SaveVersion(ctx, v)

	return updated, nil
}

// Rollback reverts a canary, keeping the baseline value.
func (s *CanaryService) Rollback(ctx context.Context, tenantID, configID, canaryID string) (*models.ConfigItem, error) {
	ctx, span := otel.Tracer("orion-config-mgmt-svc").Start(ctx, "CanaryService.Rollback")
	defer span.End()

	canary, err := s.repo.GetCanary(ctx, tenantID, canaryID)
	if err != nil {
		return nil, fmt.Errorf("canary not found: %w", err)
	}

	if canary.Status != models.CanaryStatusActive {
		return nil, fmt.Errorf("canary is not in active state, current status: %s", canary.Status)
	}

	// Mark canary as rolled back (no config change needed since baseline is already the current value)
	if err := s.repo.UpdateCanaryStatus(ctx, tenantID, canaryID, models.CanaryStatusRolledBack); err != nil {
		return nil, fmt.Errorf("update canary status: %w", err)
	}

	// Re-fetch current config
	cfg, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, fmt.Errorf("config not found: %w", err)
	}

	// Record version
	v := &models.ConfigVersion{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		ConfigID:      configID,
		ConfigKey:     cfg.Key,
		Environment:   cfg.Environment,
		Value:         cfg.Value,
		VersionNumber: cfg.Version,
		ChangeType:    "canary_rollback",
		ChangedBy:     canary.CreatedBy,
		ChangeReason:  fmt.Sprintf("Rolled back canary %s", canaryID),
	}
	_ = s.repo.SaveVersion(ctx, v)

	return cfg, nil
}