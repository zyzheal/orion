package startup

import (
	"context"
	"fmt"
	"sync"

	"orion/platform-svc-go/internal/startup/service"

	"go.uber.org/zap"
)

// Bridge connects the phase-based PhaseManager with the existing IStartup
// module system from service.Manager. It lets an operator drive module
// lifecycle at a specific phase boundary while still benefiting from ordered
// phase initialization.
//
// Typical usage:
//   pm := startup.NewPhaseManager(logger)
//   sm := service.NewStartupManager(repo, logger)
//
//   bridge := startup.NewBridge(pm, sm)
//   // Register modules; bridge wires them to the Services phase.
//   bridge.Register(sm, myModule)
//   bridge.Register(sm, anotherModule)
//
//   pm.Start(ctx) // runs phases incl. "services" which initializes modules
//   pm.Stop(ctx)  // reverse-order shutdown incl. modules
//
// Bridge does not replace either manager — it delegates to them.
type Bridge struct {
	pm *PhaseManager
	sm *service.StartupManager
}

// NewBridge creates a new Bridge that forwards module registration and
// lifecycle calls between PhaseManager and the existing StartupManager.
func NewBridge(pm *PhaseManager, sm *service.StartupManager) *Bridge {
	return &Bridge{pm: pm, sm: sm}
}

// Register registers an IStartup module with the service manager AND
// registers a phase handler (for initialization in the Services phase
// and for shutdown) with the phase manager.
func (b *Bridge) Register(s service.IStartup) {
	b.sm.Register(s)

	b.pm.RegisterHandler(PhaseHandler{
		Name:  "module:" + s.Name(),
		Phase: PhaseServices,
		Handler: func(ctx context.Context) error {
			return b.sm.StartModule(ctx, s.Name())
		},
		HealthCheck: func(_ context.Context) error {
			status := b.sm.GetModuleStatus(s.Name())
			if status != "active" {
				return fmt.Errorf("module %s not active during health check (status=%s)", s.Name(), status)
			}
			return nil
		},
		Shutdown: func(_ context.Context) error {
			return s.Shutdown()
		},
	})
}

// PhaseStartupManager is a convenience wrapper that lets the existing
// service.StartupManager participate as a single phase in a PhaseManager.
// Call PhaseManager.Start() to drive the full phased initialization,
// including the wrapped StartupManager's modules at the Services phase.
type PhaseStartupManager struct {
	PhaseManager    *PhaseManager
	StartupManager  *service.StartupManager
	moduleRegistry  *ModuleRegistry
}

// NewPhaseStartupManager constructs a combined manager and auto-wires the
// StartupManager into the Services phase.
func NewPhaseStartupManager(logger *zap.Logger, sm *service.StartupManager) *PhaseStartupManager {
	pm := NewPhaseManager(logger)
	return &PhaseStartupManager{
		PhaseManager:    pm,
		StartupManager:  sm,
		moduleRegistry:  NewModuleRegistry(),
	}
}

// Register wires an IStartup module into both managers.
func (psm *PhaseStartupManager) Register(s service.IStartup) {
	psm.StartupManager.Register(s)
	psm.moduleRegistry.Register(s)

	psm.PhaseManager.RegisterHandler(PhaseHandler{
		Name:  "module:" + s.Name(),
		Phase: PhaseServices,
		Handler: func(ctx context.Context) error {
			return psm.StartupManager.StartModule(ctx, s.Name())
		},
		HealthCheck: func(_ context.Context) error {
			status := psm.StartupManager.GetModuleStatus(s.Name())
			if status != "active" {
				return fmt.Errorf("module %s not active during health check (status=%s)", s.Name(), status)
			}
			return nil
		},
		Shutdown: func(_ context.Context) error {
			return psm.moduleRegistry.Shutdown(context.Background(), s.Name())
		},
	})
}

// Start delegates to PhaseManager.Start.
func (psm *PhaseStartupManager) Start(ctx context.Context) error {
	return psm.PhaseManager.Start(ctx)
}

// Stop delegates to PhaseManager.Stop.
func (psm *PhaseStartupManager) Stop(ctx context.Context) error {
	return psm.PhaseManager.Stop(ctx)
}

// ---------------------------------------------------------------------------
// Pre-built phase handlers for common Orion Go service initialization tasks.
// These can be registered directly with a PhaseManager.
// ---------------------------------------------------------------------------

// NewConfigPhaseHandler returns a PhaseHandler for the Configuration phase.
// The validateFn is called during init; return nil to accept the config.
func NewConfigPhaseHandler(name string, validateFn func(context.Context) error) PhaseHandler {
	return PhaseHandler{
		Name:  name,
		Phase: PhaseConfig,
		Handler: validateFn,
		Shutdown: func(context.Context) error { return nil },
	}
}

// NewDatabasePhaseHandler returns a PhaseHandler for the Database phase.
// connectFn establishes the connection; migrateFn runs migrations;
// closeFn is called on shutdown.
func NewDatabasePhaseHandler(name string, connectFn, migrateFn, closeFn func(context.Context) error) PhaseHandler {
	return PhaseHandler{
		Name:  name,
		Phase: PhaseDatabase,
		Handler: func(ctx context.Context) error {
			if err := connectFn(ctx); err != nil {
				return err
			}
			return migrateFn(ctx)
		},
		Shutdown: closeFn,
	}
}

// NewCachePhaseHandler returns a PhaseHandler for the Cache phase.
func NewCachePhaseHandler(name string, connectFn, pingFn, closeFn func(context.Context) error) PhaseHandler {
	return PhaseHandler{
		Name:  name,
		Phase: PhaseCache,
		Handler: func(ctx context.Context) error {
			if err := connectFn(ctx); err != nil {
				return err
			}
			return pingFn(ctx)
		},
		Shutdown: closeFn,
	}
}

// NewMiddlewarePhaseHandler returns a PhaseHandler for the Middleware phase.
func NewMiddlewarePhaseHandler(name string, registerFn func(context.Context) error) PhaseHandler {
	return PhaseHandler{
		Name:  name,
		Phase: PhaseMiddleware,
		Handler: registerFn,
		Shutdown: func(context.Context) error { return nil },
	}
}

// NewReadyPhaseHandler returns a PhaseHandler for the Ready phase.
// This is the final phase that marks the system as serving traffic.
func NewReadyPhaseHandler(name string, onReady func(context.Context) error) PhaseHandler {
	return PhaseHandler{
		Name:  name,
		Phase: PhaseReady,
		Handler: onReady,
		Shutdown: func(context.Context) error { return nil },
	}
}

// ---------------------------------------------------------------------------
// ModuleRegistry tracks modules so Shutdown can be called on the right
// IStartup instance during reverse-order cleanup.
// ---------------------------------------------------------------------------

// ModuleRegistry tracks modules registered via Bridge / PhaseStartupManager.
type ModuleRegistry struct {
	mu      sync.RWMutex
	modules map[string]service.IStartup
}

func NewModuleRegistry() *ModuleRegistry {
	return &ModuleRegistry{modules: make(map[string]service.IStartup)}
}

func (r *ModuleRegistry) Register(s service.IStartup) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.modules[s.Name()] = s
}

func (r *ModuleRegistry) Get(name string) service.IStartup {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.modules[name]
}

func (r *ModuleRegistry) Shutdown(ctx context.Context, name string) error {
	mod := r.Get(name)
	if mod == nil {
		return fmt.Errorf("module %q not found", name)
	}
	_ = ctx
	return mod.Shutdown()
}
