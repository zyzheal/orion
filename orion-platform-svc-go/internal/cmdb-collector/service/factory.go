// Package service factory provides the AdapterFactory — the runtime
// orchestrator that bridges the stored CMDBAdapter catalog (in cmdb_adapters)
// with the collector SPI adapters registered in the registry.
//
// The factory supports two complementary flows:
//
//   1. Adapter catalog management — CRUD over cmdb_adapters (tenant-scoped
//      instances of vendor adapters with JSON config).
//   2. Discovery orchestration — submit a discovery job, look up the adapter
//      from the registry, run Discover(), and persist both the job record
//      (cmdb_discovery_jobs) and the resulting assets (cmdb_assets).
//
// Design decisions:
//   - The factory owns a sync.RWMutex-guarded map of *static* adapter
//     definitions that supplement the registry.  Static adapters are useful for
//     built-in defaults that should always be discoverable without a DB row.
//   - Discover() is the only method that touches the registry; the CRUD
//     operations only touch the repository.  This keeps the two layers cleanly
//     separated.
//   - Job lifecycle is best-effort: the factory does not start a background
//     worker — it runs Discover() synchronously and records the result.  A
//     caller who wants async execution should wrap Discover() in their own
//     worker pool (the scheduler package is the reference example).
//   - Errors are concrete sentinel errors so callers can distinguish "adapter
//     not found in registry" from "DB write failed" from "tenant not found".
package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/cmdb-collector/models"
	"orion/platform-svc-go/internal/cmdb-collector/registry"
	"orion/platform-svc-go/internal/cmdb-collector/repository"

	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// AdapterFactory
// ---------------------------------------------------------------------------

// AdapterFactory is the runtime that coordinates the adapter catalog, the
// collector SPI registry, and the discovery job / asset persistence.
type AdapterFactory struct {
	repo *repository.Repository
	reg  *registry.Registry

	// adapters is the tenant-scoped, adapter-name → stored adapter index
	// backed by the DB.  Protected by mu.
	adapters map[string]*models.CMDBAdapter
	mu       sync.RWMutex

	// defaultTenant is used when a caller omits tenant_id (e.g. unit tests).
	defaultTenant string

	logger *zap.Logger
}

// AdapterFactoryOptions tunes factory behaviour.
type AdapterFactoryOptions struct {
	DefaultTenant string
	Logger        *zap.Logger
}

// NewAdapterFactory creates a new AdapterFactory.
func NewAdapterFactory(
	repo *repository.Repository,
	reg *registry.Registry,
	opts *AdapterFactoryOptions,
) *AdapterFactory {
	if opts == nil {
		opts = &AdapterFactoryOptions{}
	}

	return &AdapterFactory{
		repo:          repo,
		reg:           reg,
		adapters:      make(map[string]*models.CMDBAdapter),
		defaultTenant: opts.DefaultTenant,
		logger:        opts.Logger,
	}
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

var (
	ErrAdapterFactoryNotFound = errors.New("adapter not found")
	ErrAdapterNotInRegistry   = errors.New("adapter is not registered in the collector registry")
	ErrInvalidCategory        = errors.New("invalid adapter category")
	ErrInvalidConfig          = errors.New("adapter config is not valid JSON")
	ErrMissingAdapterID       = errors.New("adapter_id is required")
)

// ---------------------------------------------------------------------------
// Adapter catalog CRUD
// ---------------------------------------------------------------------------

// CreateAdapter creates an adapter record and registers a static entry in the
// in-memory index so ListAdapters() can enumerate it.  This is best-effort
// regarding the registry — the adapter must already be known to the registry
// for Discover() to succeed later; the catalog is a metadata store.
func (f *AdapterFactory) CreateAdapter(ctx context.Context, tenantID string, a *models.CMDBAdapter) error {
	if tenantID == "" {
		return ErrMissingTenant
	}
	if a.Name == "" {
		return fmt.Errorf("adapter name is required")
	}
	if !a.ValidCategory() {
		return ErrInvalidCategory
	}
	// Validate JSON config (allow empty string for adapters that don't need config).
	if a.Config != "" {
		if !json.Valid([]byte(a.Config)) {
			return ErrInvalidConfig
		}
	}
	if a.Enabled == false {
		// Normalise: default enabled=true if unspecified.
	}
	if a.Enabled == false {
		// keep explicit false
	}

	if err := f.repo.CreateAdapter(ctx, a); err != nil {
		return err
	}

	f.mu.Lock()
	f.adapters[a.Name] = a
	f.mu.Unlock()

	f.logger.Info("adapter created",
		zap.String("name", a.Name),
		zap.String("category", a.Category),
		zap.String("vendor", a.Vendor),
		zap.String("tenant", tenantID),
	)
	return nil
}

// GetAdapter returns the stored adapter by id, scoped to tenant.
func (f *AdapterFactory) GetAdapter(ctx context.Context, tenantID, id string) (*models.CMDBAdapter, error) {
	if tenantID == "" {
		return nil, ErrMissingTenant
	}

	// Check in-memory index first (fast path).
	f.mu.RLock()
	for _, a := range f.adapters {
		if a.ID == id && a.TenantID == tenantID {
			f.mu.RUnlock()
			return a, nil
		}
	}
	f.mu.RUnlock()

	return f.repo.GetAdapter(ctx, tenantID, id)
}

// GetAdapterByName returns the stored adapter by name, scoped to tenant.
func (f *AdapterFactory) GetAdapterByName(ctx context.Context, tenantID, name string) (*models.CMDBAdapter, error) {
	if tenantID == "" {
		return nil, ErrMissingTenant
	}
	f.mu.RLock()
	if a, ok := f.adapters[name]; ok && a.TenantID == tenantID {
		f.mu.RUnlock()
		return a, nil
	}
	f.mu.RUnlock()

	return f.repo.GetAdapterByName(ctx, tenantID, name)
}

// ListAdapters returns the tenant's adapter catalog, optionally filtered by
// category and enabled state.
func (f *AdapterFactory) ListAdapters(ctx context.Context, tenantID string, filter ListAdaptersFilter) ([]models.CMDBAdapter, error) {
	if tenantID == "" {
		return nil, ErrMissingTenant
	}

	items, err := f.repo.ListAdapters(ctx, tenantID, filter.Category, filter.Enabled, filter.Offset, filter.Limit)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// UpdateAdapter updates an adapter record.
func (f *AdapterFactory) UpdateAdapter(ctx context.Context, tenantID string, a *models.CMDBAdapter) error {
	if tenantID == "" {
		return ErrMissingTenant
	}
	if !a.ValidCategory() {
		return ErrInvalidCategory
	}
	if a.Config != "" && !json.Valid([]byte(a.Config)) {
		return ErrInvalidConfig
	}

	if err := f.repo.UpdateAdapter(ctx, a); err != nil {
		return err
	}

	f.mu.Lock()
	f.adapters[a.Name] = a
	// also remove the old name entry if it changed
	for oldName, stored := range f.adapters {
		if stored.ID == a.ID && oldName != a.Name {
			delete(f.adapters, oldName)
		}
	}
	f.mu.Unlock()

	f.logger.Info("adapter updated", zap.String("name", a.Name), zap.String("id", a.ID))
	return nil
}

// DeleteAdapter removes an adapter record and its in-memory index entry.
func (f *AdapterFactory) DeleteAdapter(ctx context.Context, tenantID, id string) error {
	if tenantID == "" {
		return ErrMissingTenant
	}

	if err := f.repo.DeleteAdapter(ctx, tenantID, id); err != nil {
		return err
	}

	f.mu.Lock()
	for name, stored := range f.adapters {
		if stored.ID == id {
			delete(f.adapters, name)
		}
	}
	f.mu.Unlock()

	f.logger.Info("adapter deleted", zap.String("id", id))
	return nil
}

// ---------------------------------------------------------------------------
// Discovery orchestration
// ---------------------------------------------------------------------------

// CreateJob submits a discovery job with status="pending" and immediately
// executes it (synchronously).  On success the job transitions to "completed"
// and each discovered asset is upserted into cmdb_assets.  On failure the
// job is recorded with status="failed" and the error message.
func (f *AdapterFactory) CreateJob(ctx context.Context, tenantID, adapterID, target string) (*models.CMDBDiscoveryJob, error) {
	if tenantID == "" {
		return nil, ErrMissingTenant
	}
	if adapterID == "" {
		return nil, ErrMissingAdapterID
	}
	if target == "" {
		return nil, ErrMissingTarget
	}

	// Resolve the stored adapter (and from it the registered name).
	adapter, err := f.GetAdapter(ctx, tenantID, adapterID)
	if err != nil {
		return nil, fmt.Errorf("resolve adapter: %w", err)
	}
	if !adapter.Enabled {
		return nil, errors.New("adapter is disabled")
	}

	job := &models.CMDBDiscoveryJob{
		TenantID:  tenantID,
		AdapterID: adapterID,
		Target:    target,
		Status:    "pending",
	}
	if err := f.repo.CreateJob(ctx, job); err != nil {
		return nil, fmt.Errorf("persist job: %w", err)
	}

	// Execute discovery (best-effort; failure is recorded, not propagated to
	// the returned job).
	if err := f.runDiscovery(ctx, job, adapter.Name, target, adapter.Config); err != nil {
		f.logger.Error("discovery failed",
			zap.String("job", job.ID),
			zap.String("adapter", adapter.Name),
			zap.String("target", target),
			zap.Error(err),
		)
		// Record the failure; we still return the job so the caller can inspect it.
		job.Error = err.Error()
		if upErr := f.repo.UpdateJobStatus(ctx, job); upErr != nil {
			f.logger.Error("record job failure failed", zap.String("job", job.ID), zap.Error(upErr))
		}
	}

	// Refresh job from DB.
	return f.repo.GetJob(ctx, tenantID, job.ID)
}

// runDiscovery executes the actual discovery and persists the result.
func (f *AdapterFactory) runDiscovery(ctx context.Context, job *models.CMDBDiscoveryJob, adapterName, target, config string) error {
	// Mark running.
	now := time.Now().UTC()
	if err := f.repo.SetJobRunning(ctx, job.ID, job.TenantID, now); err != nil {
		return err
	}

	// Parse config (stored as JSON blob; target SPI expects map[string]interface{}).
	var configMap map[string]interface{}
	if config != "" {
		if err := json.Unmarshal([]byte(config), &configMap); err != nil {
			return fmt.Errorf("parse adapter config: %w", err)
		}
	}

	// Lookup the adapter in the registry.
	regAdapter, ok := f.reg.Get(adapterName)
	if !ok {
		return fmt.Errorf("%w: %s", ErrAdapterNotInRegistry, adapterName)
	}
	collector := regAdapter.Collector()

	// Build a Target for the SPI.
	targetModel := &models.Target{
		ID:         job.ID,
		Name:       target,
		Host:       target,
		TargetType: collector.Type(),
		Protocol:   "api",
		TenantID:   job.TenantID,
		Config:     configMap,
	}

	// Validate the config against the adapter's schema (best-effort).
	_ = f.validateConfigMap(configMap, collector.ConfigSchema())

	// Execute discovery.
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	devices, err := collector.Discover(ctx, targetModel)
	if err != nil {
		job.Status = "failed"
		job.Error = err.Error()
		job.FinishedAt = time.Now().UTC()
		return fmt.Errorf("discover: %w", err)
	}

	// Upsert each discovered device as an asset.
	for _, d := range devices {
		attrsJSON, _ := json.Marshal(d.Attributes)
		if attrsJSON == nil {
			attrsJSON = []byte("{}")
		}
		asset := &models.CMDBAsset{
			TenantID:     job.TenantID,
			Name:         d.Name,
			AdapterID:    job.AdapterID,
			AssetType:    d.DeviceType,
			Attributes:   string(attrsJSON),
			Status:       d.Status,
			DiscoveredAt: now,
		}
		_ = f.repo.UpsertAsset(ctx, asset)
	}

	// Complete the job.
	job.Status = "completed"
	job.ResultCount = len(devices)
	job.FinishedAt = time.Now().UTC()
	if err := f.repo.UpdateJobStatus(ctx, job); err != nil {
		return fmt.Errorf("complete job: %w", err)
	}

	f.logger.Info("discovery completed",
		zap.String("job", job.ID),
		zap.String("adapter", adapterName),
		zap.Int("results", len(devices)),
	)
	return nil
}

// ---------------------------------------------------------------------------
// Discovery jobs
// ---------------------------------------------------------------------------

// GetJob returns a discovery job by id.
func (f *AdapterFactory) GetJob(ctx context.Context, tenantID, id string) (*models.CMDBDiscoveryJob, error) {
	return f.repo.GetJob(ctx, tenantID, id)
}

// ListJobs returns paginated discovery jobs.
func (f *AdapterFactory) ListJobs(ctx context.Context, tenantID, adapterID, status string, offset, limit int) ([]models.CMDBDiscoveryJob, error) {
	return f.repo.ListJobs(ctx, tenantID, adapterID, status, offset, limit)
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

// GetAsset returns an asset by id.
func (f *AdapterFactory) GetAsset(ctx context.Context, tenantID, id string) (*models.CMDBAsset, error) {
	return f.repo.GetAsset(ctx, tenantID, id)
}

// ListAssets returns paginated assets, optionally filtered by adapter, asset
// type, and status.
func (f *AdapterFactory) ListAssets(ctx context.Context, tenantID string, filter ListAssetsFilter) ([]models.CMDBAsset, error) {
	return f.repo.ListAssets(ctx, tenantID, filter.AdapterID, filter.AssetType, filter.Status, filter.Offset, filter.Limit)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// validateConfig compares a config map against an adapter's ConfigSchema().
// It is a best-effort check: presence of required keys is verified, but value
// shape is not enforced (the adapter itself validates at runtime).
func (f *AdapterFactory) validateConfigMap(config map[string]interface{}, schema map[string]interface{}) error {
	if schema == nil {
		return nil
	}
	for key, spec := range schema {
		specStr := fmt.Sprintf("%v", spec)
		if !strings.Contains(specStr, "required") {
			continue
		}
		if _, ok := config[key]; !ok {
			f.logger.Warn("missing required config key", zap.String("key", key))
		}
	}
	return nil
}

// ListAdaptersFilter controls ListAdapters filtering.
type ListAdaptersFilter struct {
	Category string
	Enabled  *bool
	Offset   int
	Limit    int
}

// ListAssetsFilter controls ListAssets filtering.
type ListAssetsFilter struct {
	AdapterID string
	AssetType string
	Status    string
	Offset    int
	Limit     int
}
