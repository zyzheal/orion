package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/config-mgmt-svc-go/internal/config/models"
	"orion/config-mgmt-svc-go/internal/config/repository"
	"orion/go-common/pkg/otel"

	"github.com/google/uuid"
)

// SnapshotService manages configuration snapshots.
type SnapshotService struct {
	repo *repository.Repository
}

func NewSnapshotService(repo *repository.Repository) *SnapshotService {
	return &SnapshotService{repo: repo}
}

// Create creates a new snapshot of the current config state.
func (s *SnapshotService) Create(ctx context.Context, tenantID, configID string, req *models.CreateSnapshotRequest) (*models.ConfigSnapshot, error) {
	ctx, span := otel.Tracer("orion-config-mgmt-svc").Start(ctx, "SnapshotService.Create")
	defer span.End()

	// Fetch the current config to snapshot
	cfg, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, fmt.Errorf("config not found: %w", err)
	}

	// Build snapshot data as JSONB
	data := models.JSONB{
		"key":         cfg.Key,
		"value":       cfg.Value,
		"environment": cfg.Environment,
		"version":     cfg.Version,
	}

	snapshot := &models.ConfigSnapshot{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		ConfigID:    configID,
		Data:        data,
		Description: req.Description,
		CreatedBy:   req.CreatedBy,
		CreatedAt:   time.Now().UTC(),
	}

	if err := s.repo.CreateSnapshot(ctx, snapshot); err != nil {
		return nil, fmt.Errorf("create snapshot: %w", err)
	}

	return snapshot, nil
}

// List returns paginated snapshots for a config.
func (s *SnapshotService) List(ctx context.Context, tenantID, configID string, offset, limit int) ([]models.ConfigSnapshot, error) {
	ctx, span := otel.Tracer("orion-config-mgmt-svc").Start(ctx, "SnapshotService.List")
	defer span.End()

	return s.repo.ListSnapshots(ctx, tenantID, configID, offset, limit)
}

// GetByID returns a single snapshot by ID.
func (s *SnapshotService) GetByID(ctx context.Context, tenantID, id string) (*models.ConfigSnapshot, error) {
	ctx, span := otel.Tracer("orion-config-mgmt-svc").Start(ctx, "SnapshotService.GetByID")
	defer span.End()

	return s.repo.GetSnapshot(ctx, tenantID, id)
}

// Restore restores a config to the state captured in a snapshot.
func (s *SnapshotService) Restore(ctx context.Context, tenantID, configID, snapshotID string, restoredBy string) (*models.ConfigItem, error) {
	ctx, span := otel.Tracer("orion-config-mgmt-svc").Start(ctx, "SnapshotService.Restore")
	defer span.End()

	snapshot, err := s.repo.GetSnapshot(ctx, tenantID, snapshotID)
	if err != nil {
		return nil, fmt.Errorf("snapshot not found: %w", err)
	}

	// Extract value from snapshot data
	val, ok := snapshot.Data["value"]
	if !ok {
		return nil, fmt.Errorf("snapshot data missing 'value' field")
	}

	valueStr := fmt.Sprintf("%v", val)
	// Handle JSON values that might be serialized as complex types
	if jsonStr, err := json.Marshal(val); err == nil {
		valueStr = string(jsonStr)
	}

	// Update the config with the snapshot value
	cfg, err := s.repo.GetByID(ctx, tenantID, configID)
	if err != nil {
		return nil, fmt.Errorf("config not found: %w", err)
	}
	cfg.Value = valueStr

	if err := s.repo.Update(ctx, cfg); err != nil {
		return nil, fmt.Errorf("restore config: %w", err)
	}

	// Re-fetch to get updated version
	updated, _ := s.repo.GetByID(ctx, tenantID, configID)

	// Record a version entry for the restore
	v := &models.ConfigVersion{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		ConfigID:      configID,
		ConfigKey:     cfg.Key,
		Environment:   cfg.Environment,
		Value:         valueStr,
		VersionNumber: updated.Version,
		ChangeType:    "restore",
		ChangedBy:     restoredBy,
		ChangeReason:  fmt.Sprintf("Restored from snapshot %s", snapshotID),
	}
	_ = s.repo.SaveVersion(ctx, v)

	return updated, nil
}

// Delete removes a snapshot.
func (s *SnapshotService) Delete(ctx context.Context, tenantID, id string) error {
	ctx, span := otel.Tracer("orion-config-mgmt-svc").Start(ctx, "SnapshotService.Delete")
	defer span.End()

	return s.repo.DeleteSnapshot(ctx, tenantID, id)
}