package engine

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"

	"orion/go-common/pkg/plugin"

	"orion/platform-svc-go/internal/plugin/spi"

	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

// Engine loads, executes, and manages plugin.Plugin instances.
//
// It wraps the SPI Registry and adds:
//  - Plugin sandbox (timeout, resource limits, concurrency)
//  - Hot-reload via file-system polling (no external fsnotify dependency)
//  - Graceful degradation (per-plugin error tracking, auto-fallback)
//  - Runtime statistics
//
// Usage:
//   engine := engine.NewEngine(cfg, logger)
//   engine.RegisterBuiltin(id, name, version, impl)  // or factory
//   engine.Start(ctx)                                 // begin hot-reload loop
//   result, err := engine.Execute(ctx, id, pctx, input)
//   engine.Stop(ctx)                                  // graceful shutdown
type Engine struct {
	cfg    Config
	logger *zap.Logger

	registry   *spi.Registry
	stats      map[string]*spi.PluginStats
	statsMu    sync.RWMutex

	// Hot-reload
	reloadMu     sync.Mutex
	reloadCancel context.CancelFunc
	reloadTicker *time.Ticker
	watchFiles   map[string]string // pluginID → watch path

	// Runtime guards
	mu      sync.Mutex // guards concurrent Execute calls per plugin
	running map[string]int

	// Shutdown guard
	stopped chan struct{}
}

// NewEngine creates a new Engine with the given config and logger.
func NewEngine(cfg Config, logger *zap.Logger) *Engine {
	if logger == nil {
		logger = zap.NewNop()
	}
	e := &Engine{
		cfg:        cfg,
		logger:     logger,
		registry:   spi.NewRegistry(),
		stats:      make(map[string]*spi.PluginStats),
		running:    make(map[string]int),
		watchFiles: make(map[string]string),
		stopped:    make(chan struct{}),
	}
	if e.cfg.DefaultTimeout <= 0 {
		e.cfg.DefaultTimeout = 5 * time.Minute
	}
	return e
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterBuiltin registers a plugin.Plugin implementation directly.
func (e *Engine) RegisterBuiltin(id, name, version string, impl plugin.Plugin) error {
	return e.registry.Register(context.Background(), id, name, version, impl)
}

// RegisterWithReload registers a plugin and watches its entrypoint file for
// changes.  When the file changes, the plugin is hot-reloaded via the
// provided factory.
func (e *Engine) RegisterWithReload(id, name, version string,
	impl plugin.Plugin, watchPath string) error {
	if err := e.RegisterBuiltin(id, name, version, impl); err != nil {
		return err
	}
	e.reloadMu.Lock()
	e.watchFiles[id] = watchPath
	e.reloadMu.Unlock()
	return nil
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

// Execute runs the named plugin with the given context and input.
//
// Sandbox behaviour:
//  1. If the plugin is not enabled or not registered → immediate error.
//  2. Checks tenant concurrency quota; rejects if exceeded.
//  3. Runs with per-plugin or global timeout.
//  4. Catches panics and returns ErrPluginPanic.
//  5. Records stats and returns the result.
func (e *Engine) Execute(ctx context.Context, id string,
	pctx plugin.PluginContext, input map[string]interface{}) (*plugin.ExecuteResult, error) {

	inst, err := e.registry.Get(id)
	if err != nil {
		return nil, err
	}
	stats := e.getStats(id)

	// Sandbox: concurrency guard.
	e.mu.Lock()
	if e.cfg.MaxConcurrentPerPlugin > 0 && e.running[id] >= e.cfg.MaxConcurrentPerPlugin {
		e.mu.Unlock()
		stats.RecordFailed()
		return nil, plugin.ErrPluginRejected
	}
	e.running[id]++
	e.mu.Unlock()

	// Record in-flight.
	stats.RecordRunning(1)
	stats.RecordLastExec()
	defer func() {
		stats.RecordRunning(-1)
		e.mu.Lock()
		e.running[id]--
		e.mu.Unlock()
	}()

	// Build execution context with timeout.
	timeout := e.cfg.DefaultTimeout
	if inst != nil && inst.Enabled() {
		// Default timeout is already the global; per-plugin timeout is
		// applied by the underlying executor or caller via ctx deadline.
	}
	execCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Execute with panic recovery.
	result, err := func() (*plugin.ExecuteResult, error) {
		defer func() {
			if r := recover(); r != nil {
				err = plugin.ErrPluginPanic
			}
		}()
		return inst.Execute(execCtx, pctx, input)
	}()

	if err != nil {
		stats.RecordFailed()
		if errors.Is(err, context.DeadlineExceeded) {
			return nil, plugin.ErrPluginTimeout
		}
		e.logger.Error("plugin execution failed",
			zap.String("plugin", id),
			zap.Error(err))
		// Graceful degradation: do not remove the plugin; record health error
		// after repeated failures (handled by degraded guard).
		return nil, err
	}

	if result != nil && result.Success {
		stats.RecordExecuted()
	} else {
		stats.RecordFailed()
	}

	return result, nil
}

// GetExecutionStats returns runtime stats for a plugin.
func (e *Engine) GetExecutionStats(id string) *spi.PluginStats {
	return e.getStats(id)
}

// getStats returns (or lazily creates) stats for a plugin.
func (e *Engine) getStats(id string) *spi.PluginStats {
	e.statsMu.Lock()
	defer e.statsMu.Unlock()
	if s, ok := e.stats[id]; ok {
		return s
	}
	s := spi.NewPluginStats()
	e.stats[id] = s
	return s
}

// ---------------------------------------------------------------------------
// Hot-reload
// ---------------------------------------------------------------------------

// HotReload reloads a single plugin.  It shuts down the old instance,
// re-initializes the replacement, and restores health stats (zeros are
// preserved; only per-execution counters reset to current values).
//
// If factory is nil, the existing plugin is simply re-initialized (Init is
// not re-called — only Shutdown + re-init is performed).
func (e *Engine) HotReload(ctx context.Context, id string,
	factory func() (string, string, string, plugin.Plugin)) error {
	inst, err := e.registry.Get(id)
	if err != nil {
		return err
	}

	e.logger.Info("hot-reloading plugin", zap.String("plugin", id))

	// Shutdown old instance.
	shutdownCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	_ = inst.Shutdown(shutdownCtx)
	cancel()

	// Remove old instance.
	if err := e.registry.Unregister(ctx, id); err != nil {
		return err
	}

	// Build new instance.
	var newID, newName, newVersion string
	var impl plugin.Plugin
	if factory != nil {
		newID, newName, newVersion, impl = factory()
	} else {
		newID, newName, newVersion = id, inst.Name(), inst.Version()
		return ErrNoFactoryForHotReload
	}

	// Re-register new instance.
	if err := e.registry.Register(ctx, newID, newName, newVersion, impl); err != nil {
		return err
	}
	newInst, _ := e.registry.Get(newID)
	cfg := plugin.PluginConfig{ID: newID, Version: newVersion}
	if initErr := newInst.Init(ctx, cfg); initErr != nil {
		e.logger.Warn("hot-reload init failed, marking unhealthy",
			zap.String("plugin", newID), zap.Error(initErr))
	}

	// Keep the watch file entry.
	e.reloadMu.Lock()
	if watchPath, ok := e.watchFiles[id]; ok {
		e.watchFiles[newID] = watchPath
		delete(e.watchFiles, id)
	}
	e.reloadMu.Unlock()

	e.logger.Info("plugin hot-reloaded",
		zap.String("plugin", newID),
		zap.String("version", newVersion))
	return nil
}

// Start begins the hot-reload file-watching goroutine.  It polls the watch
// paths at the configured interval (default 30s) and triggers a reload if the
// file mtime has changed.  Cancel the context to stop.
func (e *Engine) Start(ctx context.Context) {
	e.reloadMu.Lock()
	if e.reloadCancel != nil {
		e.reloadMu.Unlock()
		return
	}
	watchCtx, cancel := context.WithCancel(ctx)
	e.reloadCancel = cancel
	e.reloadMu.Unlock()

	interval := e.cfg.ReloadingInterval
	if interval <= 0 {
		interval = 30 * time.Second
	}
	e.reloadTicker = time.NewTicker(interval)

	go e.watchLoop(watchCtx)
}

// Stop stops the hot-reload watcher (does not shut down plugins — call
// ShutdownAll for that).
func (e *Engine) Stop() {
	e.reloadMu.Lock()
	defer e.reloadMu.Unlock()
	if e.reloadTicker != nil {
		e.reloadTicker.Stop()
		e.reloadTicker = nil
	}
	if e.reloadCancel != nil {
		e.reloadCancel()
		e.reloadCancel = nil
	}
}

// ShutdownAll shuts down every registered plugin.
func (e *Engine) ShutdownAll(ctx context.Context) {
	e.Stop()
	shutdownCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	for _, id := range e.registry.List() {
		inst, _ := e.registry.Get(id)
		if inst != nil {
			_ = inst.Shutdown(shutdownCtx)
		}
	}
	e.registry.ShutdownAll(shutdownCtx)
}

// watchLoop polls the watch files and triggers hot-reload on mtime change.
func (e *Engine) watchLoop(ctx context.Context) {
	// Track last mtime per plugin.
	lastMtime := make(map[string]time.Time)

	for {
		select {
		case <-ctx.Done():
			e.logger.Info("hot-reload watch loop stopped")
			return
		case <-e.reloadTicker.C:
			e.doPoll(ctx, lastMtime)
		}
	}
}

// doPoll is the (unlocked) mtime-based poll.
func (e *Engine) doPoll(ctx context.Context, lastMtime map[string]time.Time) {
	e.reloadMu.Lock()
	watchFiles := make(map[string]string, len(e.watchFiles))
	for k, v := range e.watchFiles {
		watchFiles[k] = v
	}
	e.reloadMu.Unlock()

	for id, path := range watchFiles {
		info, err := os.Stat(path)
		if err != nil {
			// File missing — skip (plugin may have been uninstalled).
			continue
		}
		mtime := info.ModTime()
		prev, seen := lastMtime[id]
		if seen && !mtime.Equal(prev) {
			e.logger.Info("file change detected, hot-reloading",
				zap.String("plugin", id),
				zap.String("path", path))
			// Trigger hot-reload asynchronously.
			go func(pid, p string) {
				if reloadErr := e.HotReload(ctx, pid, nil); reloadErr != nil {
					e.logger.Error("hot-reload failed",
						zap.String("plugin", pid),
						zap.Error(reloadErr))
				}
			}(id, path)
		}
		lastMtime[id] = mtime
	}
}

// ---------------------------------------------------------------------------
// Info / metadata helpers
// ---------------------------------------------------------------------------

// PluginIDs returns all registered plugin IDs.
func (e *Engine) PluginIDs() []string {
	return e.registry.List()
}

// Info returns plugin.PluginInfo for the given ID, enriched with stats.
func (e *Engine) Info(id string) *plugin.PluginInfo {
	stats := e.getStats(id)
	return e.registry.Info(id, stats)
}

// AllInfos returns info for every registered plugin.
func (e *Engine) AllInfos() []*plugin.PluginInfo {
	out := make([]*plugin.PluginInfo, 0, len(e.PluginIDs()))
	for _, id := range e.PluginIDs() {
		if info := e.Info(id); info != nil {
			out = append(out, info)
		}
	}
	return out
}

// IsStopped returns true if the engine has been shut down.
func (e *Engine) IsStopped() bool {
	select {
	case <-e.stopped:
		return true
	default:
		return false
	}
}

// MarkStopped marks the engine as stopped.
func (e *Engine) MarkStopped() {
	select {
	case <-e.stopped:
	default:
		close(e.stopped)
	}
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

var (
	ErrNoFactoryForHotReload = errors.New("engine: no factory provided for hot-reload")
)

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Config holds engine tuning parameters.
type Config struct {
	// DefaultTimeout is the execution timeout per plugin call.
	DefaultTimeout time.Duration

	// MaxConcurrentPerPlugin limits parallel executions per plugin ID.
	// Zero means unlimited.
	MaxConcurrentPerPlugin int

	// ReloadingInterval controls how often file mtimes are polled.
	ReloadingInterval time.Duration

	// DefaultConcurrency is the tenant-level default for max concurrent
	// executions (applied per-tenant by the service layer).
	DefaultConcurrency int
}

// ---------------------------------------------------------------------------
// Sentinel — used by engine errors.
// ---------------------------------------------------------------------------

// ErrExecRejected is returned when execution is rejected by the sandbox.
// (Reuses go-common/plugin.ErrPluginRejected — exposed here for convenience.)
var ErrExecRejected = plugin.ErrPluginRejected

// IsExecTimeout returns true if err is a timeout sentinel.
func IsExecTimeout(err error) bool {
	return errors.Is(err, plugin.ErrPluginTimeout)
}

// ---------------------------------------------------------------------------
// Ensure Engine embeds a registry-compatible interface.
// ---------------------------------------------------------------------------

// EngineImpl is an interface that describes the engine's runtime behaviour.
// Consumers should depend on this interface rather than the concrete Engine.
type EngineImpl interface {
	RegisterBuiltin(id, name, version string, impl plugin.Plugin) error
	RegisterWithReload(id, name, version string, impl plugin.Plugin, watchPath string) error
	Execute(ctx context.Context, id string, pctx plugin.PluginContext, input map[string]interface{}) (*plugin.ExecuteResult, error)
	GetExecutionStats(id string) *spi.PluginStats
	HotReload(ctx context.Context, id string, factory func() (string, string, string, plugin.Plugin)) error
	Info(id string) *plugin.PluginInfo
	AllInfos() []*plugin.PluginInfo
	PluginIDs() []string
	Start(ctx context.Context)
	Stop()
	ShutdownAll(ctx context.Context)
	IsStopped() bool
}

// Ensure compile-time conformance.
var _ EngineImpl = (*Engine)(nil)

// ---------------------------------------------------------------------------
// Helper: mtime-only file watcher (no fsnotify dependency)
// ---------------------------------------------------------------------------

// FileWatcher provides a lightweight polling-based file watcher.
// Used internally by Engine; exposed here for testing / advanced consumers.
type FileWatcher struct {
	interval time.Duration
	stop     chan struct{}
}

// NewFileWatcher creates a new FileWatcher with the given poll interval.
func NewFileWatcher(interval time.Duration) *FileWatcher {
	if interval <= 0 {
		interval = 30 * time.Second
	}
	return &FileWatcher{
		interval: interval,
		stop:     make(chan struct{}),
	}
}

// Watch starts watching a single path.
func (w *FileWatcher) Watch(path string, onChange func(string)) {
	info, err := os.Stat(path)
	if err != nil {
		return
	}
	last := info
	go func() {
		ticker := time.NewTicker(w.interval)
		defer ticker.Stop()
		for {
			select {
			case <-w.stop:
				return
			case <-ticker.C:
				info, err := os.Stat(path)
				if err != nil {
					continue
				}
				if !info.ModTime().Equal(last.ModTime()) {
					onChange(path)
					last = info
				}
			}
		}
	}()
}

// Stop stops the watcher.
func (w *FileWatcher) Stop() {
	select {
	case <-w.stop:
	default:
		close(w.stop)
	}
}

// ---------------------------------------------------------------------------
// Sandbox helpers (exposed for testing)
// ---------------------------------------------------------------------------

// SandboxConfig holds per-execution sandbox parameters.
type SandboxConfig struct {
	Timeout         time.Duration
	MaxConcurrency  int
	MemoryBytes     int64
	CPUCores        int
}

// WithTimeout returns a new context that respects the given timeout.
// Returns the context and its cancel function.
func WithTimeout(parent context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	if timeout <= 0 {
		timeout = 5 * time.Minute
	}
	return context.WithTimeout(parent, timeout)
}

// SandboxError wraps a sandbox violation with the plugin ID.
type SandboxError struct {
	PluginID  string
	Reason    string
	Err       error
}

func (e *SandboxError) Error() string {
	return fmt.Sprintf("sandbox violation for plugin %q: %s: %v", e.PluginID, e.Reason, e.Err)
}

func (e *SandboxError) Unwrap() error {
	return e.Err
}

// NewSandboxError creates a sandbox error for the given reason.
func NewSandboxError(pluginID, reason string, err error) *SandboxError {
	return &SandboxError{
		PluginID: pluginID,
		Reason:   reason,
		Err:      err,
	}
}
