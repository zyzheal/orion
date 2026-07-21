package spi

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"orion/go-common/pkg/plugin"
)

// ---------------------------------------------------------------------------
// PluginInterface — local SPI that mirrors go-common/plugin.Plugin with
// metadata accessor methods (ID, Name, Version).
// ---------------------------------------------------------------------------

// PluginInstance wraps a concrete plugin.Plugin implementation and exposes
// metadata (ID, name, version) that the engine needs for lifecycle management.
type PluginInstance struct {
	ID        string
	Name      string
	Version   string
	impl      plugin.Plugin
	enabled   atomic.Bool
	healthErr atomic.Value // nil = healthy; error = degraded

	// Lifecycle state
	mu      sync.RWMutex
	initialized bool
}

// NewPluginInstance creates a new PluginInstance wrapping the given impl.
func NewPluginInstance(id, name, version string, impl plugin.Plugin) *PluginInstance {
	p := &PluginInstance{
		ID:      id,
		Name:    name,
		Version: version,
		impl:    impl,
	}
	p.enabled.Store(true)
	return p
}

// ID returns the unique plugin identifier.
func (p *PluginInstance) ID() string { return p.ID }

// Name returns the human-readable plugin name.
func (p *PluginInstance) Name() string { return p.Name }

// Version returns the semantic version.
func (p *PluginInstance) Version() string { return p.Version }

// Enabled returns whether the plugin is enabled.
func (p *PluginInstance) Enabled() bool { return p.enabled.Load() }

// SetEnabled updates the enabled flag.
func (p *PluginInstance) SetEnabled(v bool) { p.enabled.Store(v) }

// Init calls the underlying plugin's Init method.
// Returns ErrNotInitialized if already initialized.
func (p *PluginInstance) Init(ctx context.Context, cfg plugin.PluginConfig) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.initialized {
		return ErrAlreadyInitialized
	}
	if !p.enabled.Load() {
		return plugin.ErrPluginDisabled
	}
	err := p.impl.Init(ctx, cfg)
	if err != nil {
		p.setHealthErr(err)
		return err
	}
	p.initialized = true
	p.setHealthErr(nil)
	return nil
}

// Execute runs the plugin with the given context and input.
// Returns plugin.ErrPluginNotReady if the plugin is not initialized or unhealthy.
func (p *PluginInstance) Execute(ctx context.Context, pctx plugin.PluginContext, input map[string]interface{}) (*plugin.ExecuteResult, error) {
	if !p.Enabled() {
		return nil, plugin.ErrPluginDisabled
	}
	if p.HealthErr() != nil {
		return nil, plugin.ErrPluginNotReady
	}
	if !p.isInitialized() {
		return nil, plugin.ErrPluginNotReady
	}
	return p.impl.Execute(ctx, pctx, input)
}

// Shutdown calls the underlying plugin's Shutdown method.
// Safe to call multiple times (idempotent on the impl side — we guard on initialized).
func (p *PluginInstance) Shutdown(ctx context.Context) error {
	if !p.isInitialized() {
		return nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if !p.initialized {
		return nil
	}
	err := p.impl.Shutdown(ctx)
	if err == nil {
		p.initialized = false
	}
	return err
}

// Health checks plugin health via the underlying Health method.
func (p *PluginInstance) Health(ctx context.Context) error {
	if !p.Enabled() {
		return plugin.ErrPluginDisabled
	}
	if !p.isInitialized() {
		return plugin.ErrPluginNotReady
	}
	return p.impl.Health(ctx)
}

// HealthErr returns the last known health error (nil = healthy).
func (p *PluginInstance) HealthErr() error {
	v := p.healthErr.Load()
	if v == nil {
		return nil
	}
	return v.(error)
}

func (p *PluginInstance) setHealthErr(err error) {
	if err == nil {
		p.healthErr.Store(nil)
	} else {
		p.healthErr.Store(err)
	}
}

func (p *PluginInstance) isInitialized() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.initialized
}

// ---------------------------------------------------------------------------
// PluginRegistry — manages plugin instances
// ---------------------------------------------------------------------------

// Registry manages the lifecycle of plugin.Plugin implementations.
// Register → Init → Execute → Shutdown.
type Registry struct {
	mu       sync.RWMutex
	plugins  map[string]*PluginInstance // keyed by ID
	initOnce sync.Once

	// Stats
	initializedCount atomic.Int32
}

// NewRegistry creates a new empty plugin registry.
func NewRegistry() *Registry {
	return &Registry{
		plugins: make(map[string]*PluginInstance),
	}
}

// Register adds a plugin to the registry.  Returns ErrAlreadyRegistered if
// a plugin with the same ID already exists.
func (r *Registry) Register(ctx context.Context, id, name, version string, impl plugin.Plugin) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.plugins[id]; ok {
		return ErrAlreadyRegistered
	}
	inst := NewPluginInstance(id, name, version, impl)
	r.plugins[id] = inst
	return nil
}

// Unregister removes a plugin from the registry and shuts it down.
func (r *Registry) Unregister(ctx context.Context, id string) error {
	r.mu.Lock()
	inst, ok := r.plugins[id]
	if !ok {
		delete(r.plugins, id)
		return ErrNotRegistered
	}
	delete(r.plugins, id)
	r.mu.Unlock()

	if inst != nil {
		_ = inst.Shutdown(ctx)
	}
	return nil
}

// Get returns a plugin instance by ID. Returns ErrNotRegistered if not found.
func (r *Registry) Get(id string) (*PluginInstance, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	inst, ok := r.plugins[id]
	if !ok {
		return nil, ErrNotRegistered
	}
	return inst, nil
}

// List returns all registered plugin IDs.
func (r *Registry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]string, 0, len(r.plugins))
	for id := range r.plugins {
		out = append(out, id)
	}
	return out
}

// All returns a snapshot of all plugin instances (read-only view).
func (r *Registry) All() map[string]*PluginInstance {
	r.mu.RLock()
	defer r.mu.RUnlock()
	snap := make(map[string]*PluginInstance, len(r.plugins))
	for id, inst := range r.plugins {
		snap[id] = inst
	}
	return snap
}

// Contains checks whether a plugin is registered.
func (r *Registry) Contains(id string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.plugins[id]
	return ok
}

// InitAll initializes all registered plugins.  Non-fatal — plugins that fail
// init are marked unhealthy but the others proceed.
func (r *Registry) InitAll(ctx context.Context, cfgMap map[string]plugin.PluginConfig) map[string]error {
	errors := make(map[string]error)
	for id, inst := range r.All() {
		cfg, ok := cfgMap[id]
		if !ok {
			// Use defaults if no config provided.
			cfg = plugin.PluginConfig{ID: id, Version: inst.Version()}
		}
		if err := inst.Init(ctx, cfg); err != nil {
			errors[id] = err
		}
	}
	return errors
}

// ShutdownAll shuts down all plugins.
func (r *Registry) ShutdownAll(ctx context.Context) map[string]error {
	errors := make(map[string]error)
	for id, inst := range r.All() {
		if err := inst.Shutdown(ctx); err != nil {
			errors[id] = err
		}
	}
	return errors
}

// Count returns the number of registered plugins.
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.plugins)
}

// Info returns a PluginInfo for a given plugin ID.
func (r *Registry) Info(id string, stats *PluginStats) *plugin.PluginInfo {
	inst, err := r.Get(id)
	if err != nil {
		return nil
	}
	info := &plugin.PluginInfo{
		ID:       inst.ID(),
		Version:  inst.Version(),
		Healthy:  inst.HealthErr() == nil && inst.isInitialized() && inst.Enabled(),
	}
	if stats != nil {
		info.Running = int(stats.Running())
		info.Executed = int(stats.Executed())
		info.Failed = int(stats.Failed())
	}
	return info
}

// ---------------------------------------------------------------------------
// PluginStats — runtime statistics for a plugin instance
// ---------------------------------------------------------------------------

// PluginStats tracks execution statistics for a single plugin.
type PluginStats struct {
	running atomic.Int32
	executed atomic.Int32
	failed atomic.Int32
	lastExec atomic.Int64
}

// NewPluginStats creates a fresh stats tracker.
func NewPluginStats() *PluginStats {
	return &PluginStats{}
}

// RecordRunning marks an execution as in-flight.
func (s *PluginStats) RecordRunning(delta int32) { s.running.Add(delta) }

// RecordExecuted marks a successful execution.
func (s *PluginStats) RecordExecuted() { s.executed.Add(1) }

// RecordFailed marks a failed execution.
func (s *PluginStats) RecordFailed() { s.failed.Add(1) }

// Running returns the current number of in-flight executions.
func (s *PluginStats) Running() int32 { return s.running.Load() }

// Executed returns total successful executions.
func (s *PluginStats) Executed() int32 { return s.executed.Load() }

// Failed returns total failed executions.
func (s *PluginStats) Failed() int32 { return s.failed.Load() }

// RecordLastExec records the last execution timestamp.
func (s *PluginStats) RecordLastExec() {
	s.lastExec.Store(time.Now().UnixMilli())
}

// LastExec returns the last execution time, or zero if never executed.
func (s *PluginStats) LastExec() time.Time {
	ts := s.lastExec.Load()
	if ts == 0 {
		return time.Time{}
	}
	return time.UnixMilli(ts)
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

var (
	ErrAlreadyRegistered    = plugin.ErrPluginRejected  // reuse go-common sentinel
	ErrAlreadyInitialized   = plugin.ErrPluginRejected  // reuse — plugin init is single-shot
	ErrNotRegistered        = plugin.ErrPluginNotFound  // reuse
)
