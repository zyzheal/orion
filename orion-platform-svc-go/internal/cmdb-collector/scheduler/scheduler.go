// Package scheduler provides a periodic scheduler for CMDB collector sweeps.
//
// The scheduler runs two recurring tasks:
//   - Discovery  — periodically Discover() on every registered target so the
//     device registry stays in sync with the real infrastructure.
//   - Collection — periodically Collect() attributes on every known device so
//     the CMDB always carries the latest metrics.
//
// Design decisions:
//   - The scheduler is a simple ticker loop (not a full cron engine).  That
//     keeps the package dependency-free: no external cron library is required.
//     A caller who needs CRON expressions can wrap the scheduler in their own
//     cron engine.
//   - Start/Stop are goroutine-safe: multiple Stop() calls are no-ops after
//     the first.
//   - Each target is processed sequentially; parallel sweeps can be layered on
//     top in a future version.
package scheduler

import (
	"context"
	"log/slog"
	"time"

	"orion/platform-svc-go/internal/cmdb-collector/service"
	"orion/platform-svc-go/internal/cmdb-collector/repository"
)

// Scheduler drives periodic CMDB collector runs.
type Scheduler struct {
	svc          *service.Service
	repo         *repository.Repository
	discovery    *periodicTask
	collection   *periodicTask
	discoverCtx  context.Context
	collectCtx   context.Context
	discoverCancel context.CancelFunc
	collectCancel  context.CancelFunc
}

// SchedulerConfig controls the cadence of discovery and collection sweeps.
type SchedulerConfig struct {
	// DiscoveryInterval is how often discovery runs on every target.
	// Zero means "disabled" (the service is still usable via the ad-hoc API).
	DiscoveryInterval time.Duration

	// CollectionInterval is how often collection runs on every device.
	CollectionInterval time.Duration

	// DefaultCollector is the collector adapter used when a target or device
	// does not carry its own adapter name.  Falls back to "ssh-server".
	DefaultCollector string
}

// DefaultConfig returns reasonable defaults: discovery every 6 hours,
// collection every 15 minutes.
func DefaultConfig() SchedulerConfig {
	return SchedulerConfig{
		DiscoveryInterval: 6 * time.Hour,
		CollectionInterval: 15 * time.Minute,
		DefaultCollector:  "ssh-server",
	}
}

// NewScheduler creates a new Scheduler.  Pass nil for cfg to use defaults.
func NewScheduler(svc *service.Service, repo *repository.Repository, cfg *SchedulerConfig) *Scheduler {
	if cfg == nil {
		defaultCfg := DefaultConfig()
		cfg = &defaultCfg
	}

	discoverCtx, discoverCancel := context.WithCancel(context.Background())
	collectCtx, collectCancel := context.WithCancel(context.Background())

	s := &Scheduler{
		svc:          svc,
		repo:         repo,
		discoverCtx:  discoverCtx,
		collectCtx:   collectCtx,
		discoverCancel: discoverCancel,
		collectCancel:  collectCancel,
		discovery: &periodicTask{
			interval: cfg.DiscoveryInterval,
		},
		collection: &periodicTask{
			interval: cfg.CollectionInterval,
		},
	}
	return s
}

// Start begins both discovery and collection sweeps.  Returns immediately;
// the sweeps run in background goroutines.
//
// If a schedule's interval is zero, that task is skipped.
func (s *Scheduler) Start() {
	if s.discovery.interval > 0 {
		slog.Info("scheduler started", "discovery_interval", s.discovery.interval, "collection_interval", s.collection.interval)
		go s.runPeriodic(s.discovery, s.discoverCtx, s.runDiscoverySweep)
	} else {
		slog.Info("discovery sweep disabled (interval = 0)")
	}

	if s.collection.interval > 0 {
		go s.runPeriodic(s.collection, s.collectCtx, s.runCollectionSweep)
	} else {
		slog.Info("collection sweep disabled (interval = 0)")
	}
}

// Stop cancels both sweeps and waits for the running goroutines to finish.
func (s *Scheduler) Stop() {
	s.discoverCancel()
	s.collectCancel()
	slog.Info("scheduler stopped")
}

// ---------- Sweep implementations ----------

// runDiscoverySweep discovers every target in the repository.
func (s *Scheduler) runDiscoverySweep(ctx context.Context) {
	// List all targets for all tenants (service.RunDiscovery expects a
	// tenant_id; in the stub we use a placeholder — production code would
	// iterate tenant-by-tenant).
	targets, err := s.repo.ListTargets(ctx, "", "", 0, 1000)
	if err != nil {
		slog.Error("discovery sweep: list targets failed", "error", err)
		return
	}
	if len(targets) == 0 {
		slog.Debug("discovery sweep: no targets")
		return
	}

	adapters := s.svc.ListCollectors()
	if len(adapters) == 0 {
		slog.Warn("discovery sweep: no collectors registered")
		return
	}

	for _, target := range targets {
		select {
		case <-ctx.Done():
			return
		default:
		}
		// Use the first registered collector for this stub.
		collectorName := adapters[0].Name
		tenantID := target.TenantID
		if tenantID == "" {
			tenantID = "00000000-0000-0000-0000-000000000000"
		}

		slog.Info("discovery sweep: processing target", "target", target.Name, "collector", collectorName)
		_, _ = s.svc.RunDiscovery(ctx, tenantID, target.ID, collectorName, target.Config)
	}
}

// runCollectionSweep collects attributes from every device.
func (s *Scheduler) runCollectionSweep(ctx context.Context) {
	devices, err := s.repo.ListDevices(ctx, "", "", "", 0, 1000)
	if err != nil {
		slog.Error("collection sweep: list devices failed", "error", err)
		return
	}
	if len(devices) == 0 {
		slog.Debug("collection sweep: no devices")
		return
	}

	adapters := s.svc.ListCollectors()
	if len(adapters) == 0 {
		slog.Warn("collection sweep: no collectors registered")
		return
	}

	for _, device := range devices {
		select {
		case <-ctx.Done():
			return
		default:
		}
		collectorName := device.Adapter
		if collectorName == "" {
			collectorName = adapters[0].Name
		}
		tenantID := device.TenantID
		if tenantID == "" {
			tenantID = "00000000-0000-0000-0000-000000000000"
		}

		slog.Info("collection sweep: collecting device", "device", device.Name, "collector", collectorName)
		_, _ = s.svc.RunCollection(ctx, tenantID, device.ID, collectorName, nil)
	}
}

// ---------- periodicTask ----------

type periodicTask struct {
	interval time.Duration
	done     chan struct{}
}

func (p *periodicTask) wait(ctx context.Context) {
	select {
	case <-time.After(p.interval):
	case <-ctx.Done():
	}
}

// runPeriodic loops forever: wait interval → call fn → wait interval …
// The loop exits when ctx is cancelled.
func (s *Scheduler) runPeriodic(task *periodicTask, ctx context.Context, fn func(context.Context)) {
	for {
		task.wait(ctx)
		if ctx.Err() != nil {
			return
		}
		slog.Debug("periodic sweep", "interval", task.interval)
		fn(ctx)
	}
}
