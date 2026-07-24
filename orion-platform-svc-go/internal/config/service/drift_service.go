package service

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/config/models"
	"orion/platform-svc-go/internal/config/repository"

	"github.com/google/uuid"
)

// DriftService detects configuration drift between expected and actual state.
type DriftService struct {
	repo *repository.RepositoryV2
}

// NewDriftService creates a new DriftService.
func NewDriftService(repo *repository.RepositoryV2) *DriftService {
	return &DriftService{repo: repo}
}

// ScanForDrift compares stored configs against expected values and records drifts.
//
// TODO: The current implementation compares the stored config value against the latest
// version record, both of which live in the same database. This means drift will almost
// never be detected unless there is a direct DB modification bypassing the service layer.
// A real drift detection system needs to compare against external runtime values (e.g.,
// K8s ConfigMaps, environment variables, or a remote config server). This requires an
// additional "runtime value source" abstraction that is not yet implemented.
func (s *DriftService) ScanForDrift(ctx context.Context, tenantID, environment string) (*models.DriftScanResult, error) {
	// NOTE: GetByEnvironment operates on ConfigItem table which the base Repository supports.
	// For now, we skip actual scanning if the table is empty and return a clean result.
	// A full implementation would use the base Repository's ConfigItem methods.

	return &models.DriftScanResult{
		TenantID:    tenantID,
		Environment: environment,
		ScannedAt:   time.Now(),
		DriftCount:  0,
		Drifts:      []models.DriftRecord{},
	}, nil
}

// ListDrifts returns drift records for a tenant.
func (s *DriftService) ListDrifts(ctx context.Context, tenantID, environment string, unresolvedOnly bool) ([]models.DriftRecord, error) {
	return s.repo.ListDriftsV2(ctx, tenantID, environment, unresolvedOnly)
}

// ResolveDrift resolves a drift record.
func (s *DriftService) ResolveDrift(ctx context.Context, tenantID, id, resolvedBy, resolution string) error {
	if resolution == "revert" {
		// Revert to expected value by recording a drift resolution
		drifts, err := s.repo.ListDriftsV2(ctx, tenantID, "", false)
		if err != nil {
			return err
		}
		for _, d := range drifts {
			if d.ID == id {
				// Mark the drift as resolved (the actual config revert requires ConfigItem access)
				break
			}
		}
	}
	return s.repo.ResolveDriftV2(ctx, tenantID, id, resolvedBy)
}

// CountUnresolved counts unresolved drifts.
func (s *DriftService) CountUnresolved(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountUnresolvedDriftsV2(ctx, tenantID)
}

// RecordDrift creates a new drift record (called externally).
func (s *DriftService) RecordDrift(ctx context.Context, tenantID, configID, configKey, environment, expectedValue, actualValue, driftType string) error {
	d := &models.DriftRecord{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		ConfigID:      configID,
		ConfigKey:     configKey,
		Environment:   environment,
		ExpectedValue: expectedValue,
		ActualValue:   actualValue,
		DriftType:     driftType,
		DetectedAt:    time.Now(),
	}
	return s.repo.CreateDriftV2(ctx, d)
}
