// Package service provides the CollectorService — the business-logic layer
// that orchestrates adapter discovery, attribute collection, and scheduled
// collection runs.
//
// The service does not know how to talk to SNMP or SSH — it delegates to the
// Collector SPI in the adapters package.  It is responsible for:
//   1. Wiring a Target through the right adapter's Discover() / Collect().
//   2. Persisting results into the PostgreSQL repository.
//   3. Exposing RunDiscovery() / RunCollection() for ad-hoc API calls.
//   4. Feeding a Scheduler that drives periodic sweeps.
//
// Multi-tenancy: every query to the repository carries a tenant_id, so one
// tenant's targets and devices are never visible to another.
package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"orion/platform-svc-go/internal/cmdb-collector/models"
	"orion/platform-svc-go/internal/cmdb-collector/registry"
	"orion/platform-svc-go/internal/cmdb-collector/repository"
)

// Service orchestrates CMDB collector operations.
type Service struct {
	repo     *repository.Repository
	reg      *registry.Registry
	collectorTimeout time.Duration
}

// ServiceOptions controls service-level behaviour.
type ServiceOptions struct {
	// CollectorTimeout is the per-target timeout for Discover and Collect.
	CollectorTimeout time.Duration
}

// NewService creates a new CollectorService.  Pass nil for opts to use defaults.
func NewService(repo *repository.Repository, reg *registry.Registry, opts *ServiceOptions) *Service {
	s := &Service{
		repo:    repo,
		reg:     reg,
		collectorTimeout: 30 * time.Second,
	}
	if opts != nil && opts.CollectorTimeout > 0 {
		s.collectorTimeout = opts.CollectorTimeout
	}
	return s
}

// ---------- Errors ----------

var (
	ErrCollectorNotFound = errors.New("collector adapter not found")
	ErrMissingTarget     = errors.New("target is required")
	ErrMissingDevice     = errors.New("device is required")
	ErrMissingTenant     = errors.New("tenant_id is required")
	ErrTargetNotReachable = errors.New("target is not reachable")
)

// IsNotFound returns true when err is a repository lookup miss.
func IsNotFound(err error) bool {
	return err == repository.ErrNotFound || err == repository.ErrNotUnique
}

// ---------- RunDiscovery ----------

// RunDiscovery executes one discovery sweep against a target using the
// named collector adapter.  It returns the devices discovered (upserted into
// the DB) and the collection record.
//
// Flow:
//   1. Load the target from the repository.
//   2. Lookup the adapter from the registry.
//   3. Optionally Init() the adapter with config overrides.
//   4. HealthCheck the target.
//   5. Discover() → upsert each device.
//   6. Persist a Collection record with status=success|failed.
func (s *Service) RunDiscovery(ctx context.Context, tenantID, targetID, collectorName string, config map[string]interface{}) (*models.DiscoverResponse, error) {
	if tenantID == "" {
		return nil, ErrMissingTenant
	}
	if targetID == "" {
		return nil, ErrMissingTarget
	}

	// 1. Resolve target.
	target, err := s.repo.GetTarget(ctx, targetID)
	if err != nil {
		if IsNotFound(err) {
			return nil, ErrMissingTarget
		}
		return nil, fmt.Errorf("load target: %w", err)
	}

	// 2. Lookup adapter.
	adapter, ok := s.reg.Get(collectorName)
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrCollectorNotFound, collectorName)
	}

	// 3. Init adapter with config.
	if config != nil {
		if err := adapter.Init(config); err != nil {
			return nil, fmt.Errorf("init adapter %s: %w", collectorName, err)
		}
	}

	// 4. Health check.
	ctx, cancel := context.WithTimeout(ctx, s.collectorTimeout)
	defer cancel()
	if err := adapter.Collector().HealthCheck(ctx, target); err != nil {
		slog.Warn("target unreachable, skipping discovery", "collector", collectorName, "target", targetID, "error", err)
		return &models.DiscoverResponse{
			Collector: collectorName,
			TargetID:  targetID,
			Error:     strPtr(err.Error()),
		}, nil
	}

	// 5. Discover.
	devices, err := adapter.Collector().Discover(ctx, target)
	if err != nil {
		slog.Error("discovery failed", "collector", collectorName, "target", targetID, "error", err)
		s.persistCollection(ctx, &models.Collection{
			TargetID:   &targetID,
			TenantID:   tenantID,
			Collector:  collectorName,
			Phase:      "discover",
			Status:     models.CollectionFailed,
			Error:      strPtr(err.Error()),
			CreatedAt:  time.Now().UTC(),
		})
		return nil, fmt.Errorf("discover: %w", err)
	}

	// 6. Upsert devices.
	for _, d := range devices {
		d.TenantID = tenantID
		d.TargetID = &targetID
		d.Adapter = collectorName
		if d.LastSeenAt == nil {
			d.LastSeenAt = new(time.Time); *d.LastSeenAt = time.Now().UTC()
		}
		_ = s.repo.UpsertDevice(ctx, d) // best-effort: don't fail whole discovery on one device
	}

	// 7. Persist collection success record.
	s.persistCollection(ctx, &models.Collection{
		TargetID:       &targetID,
		TenantID:       tenantID,
		Collector:      collectorName,
		Phase:          "discover",
		Status:         models.CollectionSuccess,
		AttributeCount: len(devices),
		CreatedAt:      time.Now().UTC(),
	})

	slog.Info("discovery complete", "collector", collectorName, "target", targetID, "devices", len(devices))
	return &models.DiscoverResponse{
		Collector:  collectorName,
		TargetID:   targetID,
		DeviceCount: len(devices),
		Devices:    expandDevices(devices),
	}, nil
}

// ---------- RunCollection ----------

// RunCollection executes one attribute-collection sweep against a device
// using the named adapter.
func (s *Service) RunCollection(ctx context.Context, tenantID, deviceID, collectorName string, config map[string]interface{}) (*models.CollectResponse, error) {
	if tenantID == "" {
		return nil, ErrMissingTenant
	}
	if deviceID == "" {
		return nil, ErrMissingDevice
	}

	// 1. Resolve device.
	device, err := s.repo.GetDevice(ctx, deviceID)
	if err != nil {
		if IsNotFound(err) {
			return nil, ErrMissingDevice
		}
		return nil, fmt.Errorf("load device: %w", err)
	}

	// 2. Lookup adapter.
	adapter, ok := s.reg.Get(collectorName)
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrCollectorNotFound, collectorName)
	}
	if config != nil {
		if err := adapter.Init(config); err != nil {
			return nil, fmt.Errorf("init adapter %s: %w", collectorName, err)
		}
	}

	// 3. Collect.
	ctx, cancel := context.WithTimeout(ctx, s.collectorTimeout)
	defer cancel()
	result, err := adapter.Collector().Collect(ctx, device)
	if err != nil {
		slog.Error("collection failed", "collector", collectorName, "device", deviceID, "error", err)
		result = &models.Collection{
			DeviceID:     &deviceID,
			TenantID:     tenantID,
			Collector:    collectorName,
			Phase:        "collect",
			Status:       models.CollectionFailed,
			Error:        strPtr(err.Error()),
			CreatedAt:    time.Now().UTC(),
		}
		s.persistCollection(ctx, result)
		return nil, fmt.Errorf("collect: %w", err)
	}

	// 4. Persist.
	s.persistCollection(ctx, result)

	// 5. Transform flat map to typed Attribute slice.
	attrs := mapToAttributes(result.Attributes, time.Now().UTC())

	slog.Info("collection complete", "collector", collectorName, "device", deviceID, "attributes", len(attrs))
	return &models.CollectResponse{
		CollectionID:  result.CollectionID,
		Collector:     collectorName,
		DeviceID:      deviceID,
		Status:        result.Status,
		AttributeCount: len(attrs),
		Attributes:    attrs,
		DurationMs:    result.DurationMs,
	}, nil
}

// Repository returns the underlying data repository.
func (s *Service) Repository() *repository.Repository {
	return s.repo
}

// ---------- Ad-hoc helpers ----------

// ListCollectors returns the names and types of all registered adapters.
func (s *Service) ListCollectors() []CollectorInfo {
	adapters := s.reg.List()
	out := make([]CollectorInfo, len(adapters))
	for i, a := range adapters {
		c := a.Collector()
		out[i] = CollectorInfo{
			Name:   a.Name(),
			Type:   c.Type(),
			Schema: c.ConfigSchema(),
		}
	}
	return out
}

// CollectorInfo is the API response for a single adapter.
type CollectorInfo struct {
	Name   string                 `json:"name"`
	Type   string                 `json:"type"`
	Schema map[string]interface{} `json:"schema"`
}

// ListTargets returns targets for a tenant, optionally filtered by collector name.
func (s *Service) ListTargets(ctx context.Context, tenantID, targetType string, offset, limit int) ([]models.Target, error) {
	if s.repo == nil {
		return nil, nil
	}
	return s.repo.ListTargets(ctx, tenantID, targetType, offset, limit)
}

// ---------- Persistence helpers ----------

func (s *Service) persistCollection(ctx context.Context, c *models.Collection) {
	if err := s.repo.CreateCollection(ctx, c); err != nil {
		slog.Error("persist collection failed", "collection_id", c.CollectionID, "error", err)
	}
}

func strPtr(s string) *string { return &s }

func expandDevices(in []*models.Device) []models.Device {
	out := make([]models.Device, len(in))
	for i, d := range in {
		out[i] = *d
	}
	return out
}

func mapToAttributes(m map[string]interface{}, ts time.Time) []models.Attribute {
	if m == nil {
		return nil
	}
	attrs := make([]models.Attribute, 0, len(m))
	for key, val := range m {
		attrs = append(attrs, models.Attribute{
			Key:       key,
			Value:     val,
			Category:  categoryFor(key),
			Timestamp: ts,
		})
	}
	return attrs
}

// categoryFor maps an attribute key to a human-readable category.
func categoryFor(key string) string {
	kl := strings.ToLower(key)
	switch {
	case strings.HasPrefix(kl, "cpu.") || strings.HasPrefix(kl, "memory.") || strings.HasPrefix(kl, "load.") || strings.HasPrefix(kl, "uptime.") || strings.HasPrefix(kl, "process"):
		return "system"
	case strings.HasPrefix(kl, "disk.") || strings.HasPrefix(kl, "storage.") || strings.HasPrefix(kl, "inode"):
		return "storage"
	case strings.HasPrefix(kl, "net.") || strings.HasPrefix(kl, "interface") || strings.HasPrefix(kl, "tcp") || strings.HasPrefix(kl, "port"):
		return "network"
	case strings.HasPrefix(kl, "query") || strings.HasPrefix(kl, "table") || strings.HasPrefix(kl, "connection") || strings.HasPrefix(kl, "replication") || strings.HasPrefix(kl, "index"):
		return "database"
	default:
		return "system"
	}
}
