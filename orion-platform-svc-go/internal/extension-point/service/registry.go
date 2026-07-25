// Package service provides the Extension Point business logic: registry,
// startup lifecycle management, and an event bus for lifecycle events.
//
// This implements a service initialization lifecycle + event-driven extension
// point system similar to NeatLogic's ModuleInitializedListenerBase + IStartup
// pattern. It is the Phase 0 dependency for all NeatLogic-inspired features.
//
// Components:
//   - ExtensionRegistry: register, discover, and drive lifecycle of extensions
//   - StartupManager: execute startup tasks in priority order
//   - EventBus: publish/subscribe for extension lifecycle events
package service

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"orion/platform-svc-go/internal/extension-point/models"
	"orion/platform-svc-go/internal/extension-point/repository"

	"go.uber.org/zap"
)

// ===========================================================================
// ExtensionHandler — the interface all extension points must implement
// ===========================================================================

// ExtensionHandler is the interface that all extension points must implement.
// It mirrors NeatLogic's ModuleInitializedListenerBase + IStartup pattern.
//
// Implementations should be thread-safe with respect to the Initialize and
// Shutdown calls (they may be invoked concurrently during lifecycle management).
type ExtensionHandler interface {
	Name() string                // Unique name, e.g. "pipeline-engine"
	Category() string            // startup|api|handler|service|listener
	Description() string
	Initialize(ctx context.Context) error
	Shutdown(ctx context.Context) error
	GetConfig() map[string]string
}

// ===========================================================================
// ExtensionEvent — lifecycle event
// ===========================================================================

// ExtensionEvent is fired when an extension point changes state.
type ExtensionEvent struct {
	Type          string    `json:"type"`           // register|initialize|shutdown|error
	ExtensionName string    `json:"extension_name"`
	Status        string    `json:"status"`
	Timestamp     time.Time `json:"timestamp"`
	Error         string    `json:"error,omitempty"`
}

// ===========================================================================
// EventBus — publish/subscribe for extension lifecycle events
// ===========================================================================

// EventListener receives extension lifecycle events.
type EventListener interface {
	OnEvent(event ExtensionEvent)
}

// EventBus is a topic-based publish/subscribe bus for extension lifecycle
// events. Safe for concurrent use.
type EventBus struct {
	listeners map[string][]EventListener
	mu        sync.RWMutex
	logger    *zap.Logger
}

// NewEventBus creates a new EventBus.
func NewEventBus(logger *zap.Logger) *EventBus {
	return &EventBus{
		listeners: make(map[string][]EventListener),
		logger:    logger,
	}
}

// Subscribe registers a listener on a topic (e.g. "register", "initialize",
// "error", or "*" for all).
func (bus *EventBus) Subscribe(topic string, listener EventListener) {
	bus.mu.Lock()
	defer bus.mu.Unlock()
	bus.listeners[topic] = append(bus.listeners[topic], listener)
	bus.logger.Debug("subscribed listener", zap.String("topic", topic))
}

// Unsubscribe removes the first matching listener from a topic.
func (bus *EventBus) Unsubscribe(topic string, listener EventListener) {
	bus.mu.Lock()
	defer bus.mu.Unlock()
	l := bus.listeners[topic]
	for i, ln := range l {
		if ln == listener {
			bus.listeners[topic] = append(l[:i], l[i+1:]...)
			break
		}
	}
}

// Publish delivers an event to all listeners on the matching topic plus the
// wildcard "*" topic. Delays do not block the caller.
func (bus *EventBus) Publish(event ExtensionEvent) {
	bus.mu.RLock()
	topics := []string{event.Type, "*"}
	copied := make(map[string][]EventListener)
	for _, t := range topics {
		if ls, ok := bus.listeners[t]; ok {
			// shallow copy to avoid holding the lock during dispatch
			cp := make([]EventListener, len(ls))
			copy(cp, ls)
			copied[t] = cp
		}
	}
	bus.mu.RUnlock()

	for _, ls := range copied {
		for _, ln := range ls {
			go func(l EventListener) {
				defer func() {
					if r := recover(); r != nil {
						bus.logger.Error("listener panicked",
							zap.Any("recover", r),
							zap.String("event_type", event.Type),
							zap.String("extension", event.ExtensionName),
						)
					}
				}()
				l.OnEvent(event)
			}(ln)
		}
	}
}

// ===========================================================================
// ExtensionRegistry — register, discover, and drive extension lifecycle
// ===========================================================================

// ExtensionRegistry manages all registered extension points. It coordinates
// initialization/shutdown ordering by priority and emits lifecycle events.
type ExtensionRegistry struct {
	// in-memory index of registered handlers keyed by name
	handlers map[string]ExtensionHandler
	// repo for persistent state
	repo *repository.Repository
	// tenant for this registry instance (multi-tenant separation)
	tenantID string
	bus  *EventBus
	mu   sync.RWMutex
	wg   sync.WaitGroup // tracks in-flight InitializeAll / ShutdownAll
	logger *zap.Logger
}

// NewRegistry creates a new ExtensionRegistry.
func NewRegistry(repo *repository.Repository, bus *EventBus, tenantID string, logger *zap.Logger) *ExtensionRegistry {
	return &ExtensionRegistry{
		handlers: make(map[string]ExtensionHandler),
		repo:     repo,
		tenantID: tenantID,
		bus:      bus,
		logger:   logger,
	}
}

// TenantID returns the tenant for this registry instance.
func (r *ExtensionRegistry) TenantID() string {
	return r.tenantID
}

// Register registers an ExtensionHandler in the registry. It also persists
// a registration record to the database and emits a "register" event.
func (r *ExtensionRegistry) Register(ctx context.Context, h ExtensionHandler) error {
	r.mu.Lock()
	if _, ok := r.handlers[h.Name()]; ok {
		r.mu.Unlock()
		return fmt.Errorf("extension %q already registered", h.Name())
	}
	r.handlers[h.Name()] = h
	r.mu.Unlock()

	// Persist registration (upsert: create if new, otherwise no-op on conflict)
	ep := &models.ExtensionPoint{
		TenantID:    r.tenantID,
		Name:        h.Name(),
		Category:    h.Category(),
		Description: h.Description(),
		HandlerType: models.HandlerTypeBuiltin,
		Config:      models.JSONB{},
		Enabled:     true,
		Status:      models.StatusRegistered,
	}

	// Apply config from handler (if any)
	for k, v := range h.GetConfig() {
		ep.Config[k] = v
	}

	if err := r.repo.CreateExtensionPoint(ctx, ep); err != nil {
		// If duplicate, it's okay — already registered previously
		r.logger.Info("extension already persisted (re-registration)",
			zap.String("name", h.Name()), zap.Error(err))
	}

	event := ExtensionEvent{
		Type:          models.EventTypeRegister,
		ExtensionName: h.Name(),
		Status:        models.StatusRegistered,
		Timestamp:     time.Now().UTC(),
	}
	r.bus.Publish(event)
	r.logger.Info("extension registered", zap.String("name", h.Name()), zap.String("category", h.Category()))
	return nil
}

// Get returns the registered handler for a name.
func (r *ExtensionRegistry) Get(name string) ExtensionHandler {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.handlers[name]
}

// List returns a copy of all registered handlers.
func (r *ExtensionRegistry) List() map[string]ExtensionHandler {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make(map[string]ExtensionHandler, len(r.handlers))
	for k, v := range r.handlers {
		out[k] = v
	}
	return out
}

// Count returns the number of registered handlers.
func (r *ExtensionRegistry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.handlers)
}

// InitializeAll initializes every enabled handler, ordered by priority
// (lower first). Runs in parallel within priority groups. Stops at first error.
func (r *ExtensionRegistry) InitializeAll(ctx context.Context) error {
	// Load persisted priority from DB (authoritative source)
	ordered := make(map[string]int)
	eps, err := r.repo.ListExtensionPoints(ctx, r.tenantID, "", "", 0, 1000)
	if err != nil {
		return fmt.Errorf("load extensions failed: %w", err)
	}
	for _, ep := range eps {
		ordered[ep.Name] = ep.Priority
	}

	// Build sorted list
	r.mu.RLock()
	names := make([]string, 0, len(r.handlers))
	for name := range r.handlers {
		names = append(names, name)
	}
	r.mu.RUnlock()
	sort.Slice(names, func(i, j int) bool {
		pi, okI := ordered[names[i]]
		pj, okJ := ordered[names[j]]
		if !okI && okJ {
			return false
		}
		if okI && !okJ {
			return true
		}
		return pi < pj
	})

	// Group by priority
	groups := make(map[int][]string)
	for _, name := range names {
		_ = r.handlers[name] // ensure handler exists in registry
		p := ordered[name]
		groups[p] = append(groups[p], name)
	}

	// Sort priority keys ascending
	priorities := make([]int, 0, len(groups))
	for p := range groups {
		priorities = append(priorities, p)
	}
	sort.Ints(priorities)

	for _, p := range priorities {
		names := groups[p]
		wg := sync.WaitGroup{}
		errCh := make(chan error, len(names))
		for _, name := range names {
			wg.Add(1)
			go func(n string) {
				defer wg.Done()
				ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
				defer cancel()
				spanCtx := fmt.Sprintf("[extension=%s priority=%d]", n, p)
				r.logger.Info(spanCtx+" initializing")
				err := r.initializeOne(ctx, n)
				if err != nil {
					r.logger.Error(spanCtx+" failed", zap.Error(err))
					errCh <- fmt.Errorf("extension %q (priority %d): %w", n, p, err)
				}
			}(name)
		}
		wg.Wait()
		close(errCh)
		select {
		case err := <-errCh:
			return err
		default:
		}
	}
	return nil
}

// ShutdownAll shuts down every handler, ordered by reverse priority (higher
// first). Errors are logged but do not stop the shutdown sequence.
func (r *ExtensionRegistry) ShutdownAll(ctx context.Context) error {
	r.mu.RLock()
	names := make([]string, 0, len(r.handlers))
	for name := range r.handlers {
		names = append(names, name)
	}
	r.mu.RUnlock()

	sort.Slice(names, func(i, j int) bool {
		return names[i] > names[j] // reverse for shutdown
	})

	var firstErr error
	for _, name := range names {
		if fErr := r.shutdownOne(ctx, name); fErr != nil {
			if firstErr == nil {
				firstErr = fErr
			}
		}
	}
	return firstErr
}

// initializeOne initializes a single extension handler.
func (r *ExtensionRegistry) initializeOne(ctx context.Context, name string) error {
	// Check persisted enabled flag
	ep, err := r.repo.GetExtensionPoint(ctx, r.tenantID, name)
	if err == nil && ep != nil && !ep.Enabled {
		r.logger.Debug("skipping disabled extension", zap.String("name", name))
		return nil
	}

	h := r.Get(name)
	if h == nil {
		return fmt.Errorf("extension %q not found in registry", name)
	}

	// Create startup task
	st := &models.StartupTask{
		ExtensionID: name,
		Name:        "init:" + name,
		Status:      models.TaskStatusPending,
	}
	if err := r.repo.CreateStartupTask(ctx, st); err != nil {
		return fmt.Errorf("create startup task failed: %w", err)
	}

	// Mark running
	if err := r.repo.MarkRunning(ctx, st.ID); err != nil {
		return fmt.Errorf("mark running failed: %w", err)
	}

	start := time.Now().UTC()
	if err := h.Initialize(ctx); err != nil {
		duration := time.Since(start).Milliseconds()
		if e := r.repo.MarkFailed(ctx, st.ID, duration, err.Error()); e != nil {
			r.logger.Error("failed to persist startup failure", zap.Error(e))
		}
		r.bus.Publish(ExtensionEvent{
			Type:          models.EventTypeError,
			ExtensionName: name,
			Status:        models.StatusError,
			Timestamp:     time.Now().UTC(),
			Error:         err.Error(),
		})
		// Persist error status
		{
			se := err.Error()
			if _, e := r.repo.SetInitialized(ctx, r.tenantID, name, models.StatusError, &se); e != nil {
				r.logger.Error("failed to persist error status", zap.Error(e))
			}
		}
		return err
	}

	// Mark complete
	duration := time.Since(start).Milliseconds()
	if err := r.repo.MarkComplete(ctx, st.ID, duration); err != nil {
		return fmt.Errorf("mark complete failed: %w", err)
	}

	// Update extension status
	if _, err := r.repo.SetInitializedTime(ctx, r.tenantID, name, models.StatusActive); err != nil {
		r.logger.Error("failed to persist initialized status", zap.Error(err))
	}

	r.bus.Publish(ExtensionEvent{
		Type:          models.EventTypeInitialize,
		ExtensionName: name,
		Status:        models.StatusActive,
		Timestamp:     time.Now().UTC(),
	})
	return nil
}

// shutdownOne shuts down a single extension handler.
func (r *ExtensionRegistry) shutdownOne(ctx context.Context, name string) error {
	h := r.Get(name)
	if h == nil {
		return nil
	}

	r.logger.Info("shutting down extension", zap.String("name", name))
	err := h.Shutdown(ctx)

	r.bus.Publish(ExtensionEvent{
		Type:          models.EventTypeShutdown,
		ExtensionName: name,
		Status:        models.StatusDisabled,
		Timestamp:     time.Now().UTC(),
	})

	if err != nil {
		r.logger.Error("shutdown failed", zap.String("name", name), zap.Error(err))
	}
	// Update status to disabled regardless of error
	_, se := r.repo.SetInitialized(ctx, r.tenantID, name, models.StatusDisabled, nil)
	if se != nil {
		r.logger.Error("failed to persist shutdown status", zap.Error(se))
	}
	return err
}

// ===========================================================================
// StartupManager — execute startup tasks in priority order
// ===========================================================================

// StartupManager orchestrates startup initialization of registered extensions.
type StartupManager struct {
	registry *ExtensionRegistry
	logger   *zap.Logger
}

// NewStartupManager creates a new StartupManager.
func NewStartupManager(registry *ExtensionRegistry, logger *zap.Logger) *StartupManager {
	return &StartupManager{registry: registry, logger: logger}
}

// RunStartups executes all enabled startup (category=startup) extensions in
// priority order. If names is non-empty, only the named extensions run.
func (m *StartupManager) RunStartups(ctx context.Context, names []string) error {
	start := time.Now().UTC()
	defer func() {
		m.logger.Info("startup complete", zap.Duration("duration", time.Since(start)))
	}()

	m.logger.Info("running startups",
		zap.Strings("names", names),
		zap.Int("count", m.registry.Count()),
	)

	// If a named list is provided, only initialize those
	if len(names) > 0 {
		for _, name := range names {
			if err := m.registry.initializeOne(ctx, name); err != nil {
				return err
			}
		}
		return nil
	}

	return m.registry.InitializeAll(ctx)
}

// RunStartup initializes a single extension by name.
func (m *StartupManager) RunStartup(ctx context.Context, name string) (*models.StartupTask, error) {
	if err := m.registry.initializeOne(ctx, name); err != nil {
		return nil, err
	}
	return m.registry.repo.GetStartupTaskByExtension(ctx, name)
}

// GetStartupStatus returns the latest startup task status for an extension.
func (m *StartupManager) GetStartupStatus(name string) (*models.StartupTask, error) {
	return m.registry.repo.GetStartupTaskByExtension(context.Background(), name)
}

// ListStartupTasks returns paginated startup tasks.
func (m *StartupManager) ListStartupTasks(status string, offset, limit int) ([]models.StartupTask, int, error) {
	items, err := m.registry.repo.ListStartupTasks(context.Background(), status, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	var total int
	if status != "" {
		total, _ = m.registry.repo.CountStartupTasksByStatus(context.Background(), status)
	} else {
		total, _ = m.registry.repo.CountStartupTasks(context.Background())
	}
	return items, total, nil
}

// ===========================================================================
// Convenience constructors for wire.go
// ===========================================================================

// NewEventBusWithLogger is an alias for clarity in DI wiring.
func NewEventBusWithLogger(logger *zap.Logger) *EventBus {
	return NewEventBus(logger)
}
