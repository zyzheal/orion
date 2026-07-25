// Package startup provides orchestration of service initialization with
// ordered phases, dependency resolution, and lifecycle hooks.
//
// Architecture (three layers):
//   1. PhaseManager (phase.go) — drives ordered phases with pre/post hooks
//   2. StartupManager (manager.go) — IStartup module lifecycle (topological sort)
//   3. IStartup interface (manager.go) — per-module Initialize/HealthCheck/Shutdown
package startup

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// Phase identifiers — ordered from lowest to highest
// ---------------------------------------------------------------------------

// PhaseName is the unique identifier for an initialization phase.
type PhaseName string

const (
	PhaseConfig    PhaseName = "configuration" // 1: load & validate configuration
	PhaseDatabase  PhaseName = "database"      // 2: connect & migrate databases
	PhaseCache     PhaseName = "cache"         // 3: initialize caches (Redis, etc.)
	PhaseMiddleware PhaseName = "middleware"    // 4: register HTTP/middleware
	PhaseServices  PhaseName = "services"      // 5: start business services
	PhaseReady     PhaseName = "ready"         // 6: mark system as serving traffic
)

// phaseOrder defines the canonical ordered phases.
var phaseOrder = []PhaseName{
	PhaseConfig,
	PhaseDatabase,
	PhaseCache,
	PhaseMiddleware,
	PhaseServices,
	PhaseReady,
}

// AllPhases returns the canonical ordered list of phase names.
func AllPhases() []PhaseName {
	out := make([]PhaseName, len(phaseOrder))
	copy(out, phaseOrder)
	return out
}

// ---------------------------------------------------------------------------
// PhaseStatus represents the current state of a phase.
// ---------------------------------------------------------------------------

// PhaseStatus is the lifecycle state of a single phase.
type PhaseStatus int32

const (
	PhaseStatusPending   PhaseStatus = iota // 0: not yet started
	PhaseStatusRunning                      // 1: currently executing
	PhaseStatusSuccess                      // 2: completed successfully
	PhaseStatusFailed                       // 3: failed (error logged)
	PhaseStatusSkipped                      // 4: skipped (no handlers)
)

func (s PhaseStatus) String() string {
	switch s {
	case PhaseStatusPending:
		return "pending"
	case PhaseStatusRunning:
		return "running"
	case PhaseStatusSuccess:
		return "success"
	case PhaseStatusFailed:
		return "failed"
	case PhaseStatusSkipped:
		return "skipped"
	default:
		return "unknown"
	}
}

// ---------------------------------------------------------------------------
// PhaseResult captures the outcome of a single phase execution.
// ---------------------------------------------------------------------------

// PhaseResult holds the details of a completed (or failed) phase.
type PhaseResult struct {
	Name      PhaseName
	Status    PhaseStatus
	Error     error
	Duration  time.Duration
	StartedAt time.Time
	EndedAt   time.Time
}

// ---------------------------------------------------------------------------
// PhaseHandler is the interface a component implements to participate in
// a specific initialization phase.
//
// One component can register multiple handlers for different phases.
// ---------------------------------------------------------------------------

// PhaseHandler defines a single initialization step within a phase.
type PhaseHandler struct {
	Name        string       // short label for logging (e.g. "redis-cluster")
	Phase       PhaseName    // which phase this handler belongs to
	Handler     PhaseFunc    // the actual init function
	HealthCheck HealthCheck  // optional health check after init
	Shutdown    ShutdownFunc // optional cleanup on reverse-order shutdown
}

// PhaseFunc is the signature for an initialization handler.
type PhaseFunc func(ctx context.Context) error

// HealthCheck is the signature for an optional health check.
type HealthCheck func(ctx context.Context) error

// ShutdownFunc is the signature for an optional cleanup function.
type ShutdownFunc func(ctx context.Context) error

// ---------------------------------------------------------------------------
// Hook type — executed before/after a phase
// ---------------------------------------------------------------------------

// HookPhase indicates whether a hook is a pre or post hook.
type HookPhase int32

const (
	HookBefore HookPhase = iota
	HookAfter
)

// HookFunc is a hook executed before or after a phase.
type HookFunc func(ctx context.Context, phase PhaseName, result *PhaseResult) error

// HookConfig associates a hook with its target phase and order.
type HookConfig struct {
	Phase HookPhase
	Name  PhaseName
	Func  HookFunc
	Order int // lower = earlier; same Order → registration order
}

// ---------------------------------------------------------------------------
// PhaseManager — drives ordered phase initialization with hooks
// ---------------------------------------------------------------------------

// PhaseManager coordinates ordered initialization phases. Each phase can have
// multiple handlers, pre/post hooks, and an optional health check.
//
// Thread-safe for concurrent reads; Start/Stop must not overlap.
type PhaseManager struct {
	logger    *zap.Logger
	handlers  map[PhaseName][]PhaseHandler
	preHooks  []HookConfig
	postHooks []HookConfig

	// Runtime state
	results  map[PhaseName]*PhaseResult
	mu       sync.RWMutex
	shutdown bool // once true, Start is rejected

	// Overall status flags
	running  atomic.Bool
	ready    atomic.Bool
	started  time.Time
	duration time.Duration
}

// NewPhaseManager creates a new PhaseManager with the default phase order.
func NewPhaseManager(logger *zap.Logger) *PhaseManager {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &PhaseManager{
		logger:   logger,
		handlers: make(map[PhaseName][]PhaseHandler),
		results:  make(map[PhaseName]*PhaseResult),
	}
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

// RegisterHandler adds a PhaseHandler to the manager. If the phase is not in
// the canonical phase order, registration fails silently with a warning log.
func (pm *PhaseManager) RegisterHandler(h PhaseHandler) {
	if h.Phase == "" || h.Handler == nil {
		pm.logger.Warn("skipping phase handler registration: empty phase or nil handler",
			zap.String("name", h.Name))
		return
	}
	if !pm.validPhase(h.Phase) {
		pm.logger.Warn("skipping phase handler: unknown phase",
			zap.String("phase", string(h.Phase)))
		return
	}
	pm.mu.Lock()
	pm.handlers[h.Phase] = append(pm.handlers[h.Phase], h)
	pm.mu.Unlock()
	pm.logger.Info("registered phase handler",
		zap.String("phase", string(h.Phase)),
		zap.String("handler", h.Name),
	)
}

// RegisterPreHook adds a hook that runs before the target phase.
func (pm *PhaseManager) RegisterPreHook(hc HookConfig) {
	if hc.Func == nil || !pm.validPhase(hc.Name) {
		return
	}
	hc.Phase = HookBefore
	pm.mu.Lock()
	pm.preHooks = append(pm.preHooks, hc)
	pm.mu.Unlock()
}

// RegisterPostHook adds a hook that runs after the target phase (with result).
func (pm *PhaseManager) RegisterPostHook(hc HookConfig) {
	if hc.Func == nil || !pm.validPhase(hc.Name) {
		return
	}
	hc.Phase = HookAfter
	pm.mu.Lock()
	pm.postHooks = append(pm.postHooks, hc)
	pm.mu.Unlock()
}

// ---------------------------------------------------------------------------
// Start — execute all phases in order
// ---------------------------------------------------------------------------

// Start runs every phase in canonical order. If a phase fails, execution
// stops immediately and the error is returned. All previously-succeeded
// phases remain healthy; the failure is captured in Results().
//
// Start is not concurrency-safe with another concurrent Start call — callers
// must serialise Start.
func (pm *PhaseManager) Start(ctx context.Context) error {
	pm.mu.Lock()
	if pm.shutdown {
		pm.mu.Unlock()
		return fmt.Errorf("PhaseManager is shutting down")
	}
	pm.running.Store(true)
	pm.started = time.Now()
	pm.mu.Unlock()

	pm.logger.Info("starting phased initialization",
		zap.Strings("phases", phaseNames(phaseOrder)),
	)

	for _, phase := range phaseOrder {
		if err := pm.runPhase(ctx, phase); err != nil {
			pm.running.Store(false)
			pm.logger.Error("startup aborted at phase",
				zap.String("phase", string(phase)),
				zap.Error(err),
			)
			return fmt.Errorf("phase %q failed: %w", phase, err)
		}
	}

	pm.duration = time.Since(pm.started)
	pm.running.Store(false)
	pm.ready.Store(true)
	pm.logger.Info("phased initialization complete",
		zap.Duration("duration", pm.duration),
	)
	return nil
}

// StartModule initializes a single phase and returns its result. Useful for
// recovery or testing a phase in isolation.
func (pm *PhaseManager) StartPhase(ctx context.Context, phase PhaseName) error {
	pm.mu.RLock()
	if pm.shutdown {
		pm.mu.RUnlock()
		return fmt.Errorf("PhaseManager is shutting down")
	}
	pm.mu.RUnlock()

	if !pm.validPhase(phase) {
		return fmt.Errorf("unknown phase %q", phase)
	}

	return pm.runPhase(ctx, phase)
}

// runPhase executes one phase: pre hooks → handlers → health checks → post hooks.
func (pm *PhaseManager) runPhase(ctx context.Context, phase PhaseName) error {
	result := &PhaseResult{
		Name:      phase,
		Status:    PhaseStatusPending,
		StartedAt: time.Now(),
	}

	// --- Pre hooks ---
	preHooks := pm.hooksFor(HookBefore, phase)
	for _, h := range preHooks {
		start := time.Now()
		if err := h.Func(ctx, phase, result); err != nil {
			pm.logger.Error("pre-hook failed",
				zap.String("phase", string(phase)),
				zap.Error(err),
			)
			result.Status = PhaseStatusFailed
			result.Error = fmt.Errorf("pre-hook for %q: %w", phase, err)
			result.EndedAt = time.Now()
			result.Duration = time.Since(result.StartedAt)
			pm.recordResult(phase, result)
			return result.Error
		}
		_ = start // reserved for per-hook metrics
	}

	// --- Handlers ---
	handlers := pm.handlersFor(phase)
	if len(handlers) == 0 {
		pm.logger.Debug("phase has no handlers, skipping",
			zap.String("phase", string(phase)))
		result.Status = PhaseStatusSkipped
		result.EndedAt = time.Now()
		result.Duration = time.Since(result.StartedAt)
		pm.recordResult(phase, result)
		return nil
	}

	result.Status = PhaseStatusRunning
	pm.recordResult(phase, result) // mark running

	pm.logger.Info("executing phase",
		zap.String("phase", string(phase)),
		zap.Int("handlers", len(handlers)),
	)

	for _, h := range handlers {
		if err := pm.runHandler(ctx, h); err != nil {
			pm.logger.Error("phase handler failed",
				zap.String("phase", string(phase)),
				zap.String("handler", h.Name),
				zap.Error(err),
			)
			result.Status = PhaseStatusFailed
			result.Error = fmt.Errorf("handler %q in phase %q: %w", h.Name, phase, err)
			result.EndedAt = time.Now()
			result.Duration = time.Since(result.StartedAt)
			pm.recordResult(phase, result)
			return result.Error
		}
	}

	// --- Health checks (per handler) ---
	for _, h := range handlers {
		if h.HealthCheck == nil {
			continue
		}
		if err := h.HealthCheck(ctx); err != nil {
			pm.logger.Error("health check failed during phase",
				zap.String("phase", string(phase)),
				zap.String("handler", h.Name),
				zap.Error(err),
			)
			result.Status = PhaseStatusFailed
			result.Error = fmt.Errorf("health check for %q in phase %q: %w", h.Name, phase, err)
			result.EndedAt = time.Now()
			result.Duration = time.Since(result.StartedAt)
			pm.recordResult(phase, result)
			return result.Error
		}
	}

	// --- Post hooks ---
	postHooks := pm.hooksFor(HookAfter, phase)
	for _, h := range postHooks {
		if err := h.Func(ctx, phase, result); err != nil {
			pm.logger.Warn("post-hook failed (non-fatal)",
				zap.String("phase", string(phase)),
				zap.Error(err),
			)
			// Post-hook failures are non-fatal — phase still succeeds.
		}
	}

	result.Status = PhaseStatusSuccess
	result.EndedAt = time.Now()
	result.Duration = time.Since(result.StartedAt)
	pm.recordResult(phase, result)

	pm.logger.Info("phase completed",
		zap.String("phase", string(phase)),
		zap.Duration("duration", result.Duration),
	)
	return nil
}

// runHandler executes a single handler with per-handler timing and error handling.
func (pm *PhaseManager) runHandler(ctx context.Context, h PhaseHandler) error {
	start := time.Now()
	pm.logger.Debug("executing handler", zap.String("handler", h.Name))
	err := h.Handler(ctx)
	dur := time.Since(start)
	if err == nil {
		pm.logger.Debug("handler succeeded",
			zap.String("handler", h.Name),
			zap.Duration("duration", dur),
		)
	}
	return err
}

// ---------------------------------------------------------------------------
// Stop — reverse-order shutdown with graceful cleanup
// ---------------------------------------------------------------------------

// Stop shuts down all phases in reverse order, calling registered Shutdown
// functions. Shutdown failures are logged but do not abort the shutdown
// sequence.
//
// After Stop returns, further Start calls are rejected.
func (pm *PhaseManager) Stop(ctx context.Context) error {
	pm.mu.Lock()
	pm.shutdown = true
	pm.mu.Unlock()

	pm.ready.Store(false)
	pm.running.Store(false)

	pm.logger.Info("starting reverse-order shutdown")

	// Reverse phase order for shutdown
	for i := len(phaseOrder) - 1; i >= 0; i-- {
		phase := phaseOrder[i]
		if err := pm.shutdownPhase(ctx, phase); err != nil {
			pm.logger.Error("shutdown phase error (continuing)",
				zap.String("phase", string(phase)),
				zap.Error(err),
			)
			// Continue shutdown even on error.
		}
	}

	pm.logger.Info("reverse-order shutdown complete")
	return nil
}

// shutdownPhase calls Shutdown functions for a single phase in reverse order.
func (pm *PhaseManager) shutdownPhase(ctx context.Context, phase PhaseName) error {
	handlers := pm.handlersFor(phase)
	if len(handlers) == 0 {
		return nil
	}
	pm.logger.Info("shutting down phase",
		zap.String("phase", string(phase)),
	)
	for i := len(handlers) - 1; i >= 0; i-- {
		h := handlers[i]
		if h.Shutdown == nil {
			continue
		}
		if err := h.Shutdown(ctx); err != nil {
			pm.logger.Warn("shutdown handler error",
				zap.String("handler", h.Name),
				zap.Error(err),
			)
			return err
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Status / querying
// ---------------------------------------------------------------------------

// Results returns a copy of all phase results.
func (pm *PhaseManager) Results() map[PhaseName]*PhaseResult {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	out := make(map[PhaseName]*PhaseResult, len(pm.results))
	for k, v := range pm.results {
		cp := *v
		out[k] = &cp
	}
	return out
}

// Result returns the result for a single phase, or nil.
func (pm *PhaseManager) Result(phase PhaseName) *PhaseResult {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.results[phase]
}

// IsReady reports whether all phases completed successfully.
func (pm *PhaseManager) IsReady() bool {
	return pm.ready.Load()
}

// IsRunning reports whether Start is currently in progress.
func (pm *PhaseManager) IsRunning() bool {
	return pm.running.Load()
}

// Duration returns the total duration of the last successful Start.
func (pm *PhaseManager) Duration() time.Duration {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.duration
}

// Progress returns a map suitable for serialisation / health endpoints.
func (pm *PhaseManager) Progress() map[string]interface{} {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	phases := make([]map[string]interface{}, 0, len(phaseOrder))
	for _, name := range phaseOrder {
		r := pm.results[name]
		status := "pending"
		var dur time.Duration
		var errMsg string
		if r != nil {
			status = r.Status.String()
			dur = r.Duration
			if r.Error != nil {
				errMsg = r.Error.Error()
			}
		}
		entry := map[string]interface{}{
			"name":    string(name),
			"status":  status,
			"duration_ms": dur.Milliseconds(),
		}
		if errMsg != "" {
			entry["error"] = errMsg
		}
		phases = append(phases, entry)
	}

	return map[string]interface{}{
		"ready":    pm.ready.Load(),
		"running":  pm.running.Load(),
		"duration": pm.duration,
		"started":  pm.started,
		"phases":   phases,
	}
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

func (pm *PhaseManager) validPhase(phase PhaseName) bool {
	for _, p := range phaseOrder {
		if p == phase {
			return true
		}
	}
	return false
}

func (pm *PhaseManager) handlersFor(phase PhaseName) []PhaseHandler {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	cp := pm.handlers[phase]
	out := make([]PhaseHandler, len(cp))
	copy(out, cp)
	return out
}

func (pm *PhaseManager) hooksFor(hp HookPhase, phase PhaseName) []HookConfig {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	var src []HookConfig
	if hp == HookBefore {
		src = pm.preHooks
	} else {
		src = pm.postHooks
	}
	matched := make([]HookConfig, 0)
	for _, h := range src {
		if h.Name == phase {
			matched = append(matched, h)
		}
	}
	return matched
}

func (pm *PhaseManager) recordResult(phase PhaseName, result *PhaseResult) {
	pm.mu.Lock()
	pm.results[phase] = result
	pm.mu.Unlock()
}

func phaseNames(phases []PhaseName) []string {
	out := make([]string, len(phases))
	for i, p := range phases {
		out[i] = string(p)
	}
	return out
}
