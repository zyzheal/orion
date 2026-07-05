package service

import (
	"context"
	"fmt"
	"time"

	"orion/config-mgmt-svc-go/internal/models"
	"orion/config-mgmt-svc-go/internal/repository"

	"github.com/google/uuid"
)

// DriftService detects configuration drift between expected and actual state.
type DriftService struct {
	repo *repository.Repository
}

func NewDriftService(repo *repository.Repository) *DriftService {
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
	configs, err := s.repo.GetByEnvironment(ctx, tenantID, environment)
	if err != nil {
		return nil, fmt.Errorf("fetch configs: %w", err)
	}

	var drifts []models.DriftRecord
	for _, cfg := range configs {
		versions, err := s.repo.GetVersions(ctx, tenantID, cfg.ID, 1)
		if err != nil || len(versions) == 0 {
			continue
		}

		latestVersion := versions[0]
		if latestVersion.Value != cfg.Value {
			drift := models.DriftRecord{
				ID:            uuid.New().String(),
				TenantID:      tenantID,
				ConfigID:      cfg.ID,
				ConfigKey:     cfg.Key,
				Environment:   environment,
				ExpectedValue: latestVersion.Value,
				ActualValue:   cfg.Value,
				DriftType:     "value_changed",
				DetectedAt:    time.Now(),
			}
			if err := s.repo.CreateDrift(ctx, &drift); err == nil {
				drifts = append(drifts, drift)
			}
		}
	}

	return &models.DriftScanResult{
		TenantID:    tenantID,
		Environment: environment,
		ScannedAt:   time.Now(),
		TotalKeys:   len(configs),
		DriftCount:  len(drifts),
		Drifts:      drifts,
	}, nil
}

func (s *DriftService) ListDrifts(ctx context.Context, tenantID, environment string, unresolvedOnly bool) ([]models.DriftRecord, error) {
	return s.repo.ListDrifts(ctx, tenantID, environment, unresolvedOnly)
}

func (s *DriftService) ResolveDrift(ctx context.Context, tenantID, id, resolvedBy, resolution string) error {
	if resolution == "revert" {
		// Fetch the drift record to get the expected value
		drifts, err := s.repo.ListDrifts(ctx, tenantID, "", false)
		if err != nil {
			return err
		}
		for _, d := range drifts {
			if d.ID == id {
				// Revert config to expected value
				_, err := s.repo.GetByID(ctx, tenantID, d.ConfigID)
				if err != nil {
					return fmt.Errorf("config not found: %w", err)
				}
				// Update the config value back to expected
				item := &models.ConfigItem{
					ID:       d.ConfigID,
					TenantID: tenantID,
					Value:    d.ExpectedValue,
				}
				if err := s.repo.Update(ctx, item); err != nil {
					return fmt.Errorf("revert config: %w", err)
				}
				break
			}
		}
	}
	return s.repo.ResolveDrift(ctx, tenantID, id, resolvedBy)
}

func (s *DriftService) CountUnresolved(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountUnresolvedDrifts(ctx, tenantID)
}
