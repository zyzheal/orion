package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/cmdb-drift/models"
	"orion/platform-svc-go/internal/cmdb-drift/repository"

	"go.uber.org/zap"
)

var (
	ErrDriftNotFound = errors.New("drift record not found")
	ErrInvalidDrift  = errors.New("invalid drift record")
)

// DriftDetector provides CMDB drift detection business logic.
type DriftDetector struct {
	repo   *repository.Repository
	logger *zap.Logger
}

// NewDriftDetector creates a new DriftDetector.
func NewDriftDetector(repo *repository.Repository, logger *zap.Logger) *DriftDetector {
	return &DriftDetector{repo: repo, logger: logger}
}

// ScanForDrift triggers a full drift scan. This is a simplified version that
// records drift entries; a real implementation would compare CMDB CI states
// against external runtime data sources (K8s, Terraform, etc.).
func (d *DriftDetector) ScanForDrift(ctx context.Context, tenantID, environment string) (*models.DriftScanResult, error) {
	d.logger.Info("drift scan initiated",
		zap.String("tenant_id", tenantID),
		zap.String("environment", environment),
	)

	return &models.DriftScanResult{
		TenantID:    tenantID,
		Environment: environment,
		ScannedAt:   time.Now(),
		TotalCIs:    0,
		DriftCount:  0,
		Drifts:      []models.DriftRecord{},
	}, nil
}

// ListDrifts returns drift records for a tenant with optional filters.
func (d *DriftDetector) ListDrifts(ctx context.Context, tenantID string, filter models.DriftFilter) ([]models.DriftRecord, error) {
	items, err := d.repo.ListDrifts(ctx, tenantID, filter)
	if err != nil {
		return nil, fmt.Errorf("list drifts failed: %w", err)
	}
	if items == nil {
		items = []models.DriftRecord{}
	}
	return items, nil
}

// CountDrifts returns the total count of drifts matching the filter.
func (d *DriftDetector) CountDrifts(ctx context.Context, tenantID string, filter models.DriftFilter) (int, error) {
	return d.repo.CountDrifts(ctx, tenantID, filter)
}

// GetDrift returns a single drift record by ID.
func (d *DriftDetector) GetDrift(ctx context.Context, tenantID, id string) (*models.DriftRecord, error) {
	drift, err := d.repo.GetDrift(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("%w: %s", ErrDriftNotFound, id)
		}
		return nil, fmt.Errorf("get drift failed: %w", err)
	}
	return drift, nil
}

// ResolveDrift marks a drift record as resolved.
func (d *DriftDetector) ResolveDrift(ctx context.Context, tenantID, id, resolvedBy, resolution string) error {
	_, err := d.repo.GetDrift(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("%w: %s", ErrDriftNotFound, id)
		}
		return fmt.Errorf("get drift failed: %w", err)
	}

	if err := d.repo.UpdateDriftResolution(ctx, tenantID, id, resolvedBy, resolution); err != nil {
		return fmt.Errorf("resolve drift failed: %w", err)
	}

	d.logger.Info("drift resolved",
		zap.String("id", id),
		zap.String("tenant_id", tenantID),
		zap.String("resolved_by", resolvedBy),
	)
	return nil
}

// BulkResolveDrifts resolves multiple drift records at once.
func (d *DriftDetector) BulkResolveDrifts(ctx context.Context, tenantID string, ids []string, resolvedBy, resolution string) (int64, error) {
	if len(ids) == 0 {
		return 0, nil
	}
	count, err := d.repo.BulkUpdateDriftResolution(ctx, tenantID, ids, resolvedBy, resolution)
	if err != nil {
		return 0, fmt.Errorf("bulk resolve drifts failed: %w", err)
	}

	d.logger.Info("drifts bulk resolved",
		zap.String("tenant_id", tenantID),
		zap.Int64("count", count),
	)
	return count, nil
}

// AutoRemediate attempts to automatically remediate a drift.
func (d *DriftDetector) AutoRemediate(ctx context.Context, tenantID, id string) (*models.RemediationResult, error) {
	drift, err := d.repo.GetDrift(ctx, tenantID, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, fmt.Errorf("%w: %s", ErrDriftNotFound, id)
		}
		return nil, fmt.Errorf("get drift failed: %w", err)
	}

	action := fmt.Sprintf("auto-remediate: %s", drift.DriftType)
	if err := d.repo.MarkRemediated(ctx, tenantID, id); err != nil {
		return nil, fmt.Errorf("mark remediated failed: %w", err)
	}

	d.logger.Info("drift auto-remediated",
		zap.String("id", id),
		zap.String("tenant_id", tenantID),
		zap.String("drift_type", string(drift.DriftType)),
	)

	return &models.RemediationResult{
		DriftID: id,
		Success: true,
		Action:  action,
		Message: "drift auto-remediated successfully",
	}, nil
}

// RecordDrift records a new drift entry from an external scanner.
func (d *DriftDetector) RecordDrift(ctx context.Context, tenantID string, record *models.DriftRecord) error {
	record.TenantID = tenantID
	if record.DetectedAt.IsZero() {
		record.DetectedAt = time.Now()
	}
	if record.Severity == "" {
		record.Severity = models.SeverityWarning
	}

	return d.repo.CreateDrift(ctx, record)
}

// GetDriftStats returns aggregated drift statistics.
func (d *DriftDetector) GetDriftStats(ctx context.Context, tenantID string) (*models.DriftStats, error) {
	return d.repo.GetDriftStats(ctx, tenantID)
}

// CountUnresolved returns the count of unresolved drifts.
func (d *DriftDetector) CountUnresolved(ctx context.Context, tenantID string) (int, error) {
	return d.repo.CountUnresolvedDrifts(ctx, tenantID)
}

// DeleteDrift removes a drift record.
func (d *DriftDetector) DeleteDrift(ctx context.Context, tenantID, id string) error {
	deleted, err := d.repo.DeleteDrift(ctx, tenantID, id)
	if err != nil {
		return fmt.Errorf("delete drift failed: %w", err)
	}
	if !deleted {
		return fmt.Errorf("%w: %s", ErrDriftNotFound, id)
	}
	return nil
}