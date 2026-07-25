// registry.go defines the Registry — the central discovery and registration
// point for all AlertAdapter implementations.
//
// The registry is thread-safe: Register, Discover, Get, and StartAll/StopAll
// can be called concurrently from any goroutine.
//
// Discovery filters adapters by type category ("source", "notification",
// "export"). Built-in adapters are registered at package level via init() so
// that importing "orion/platform-svc-go/internal/alert-adapter/service/spi"
// alone makes them available.
package spi

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"go.uber.org/zap"
)

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

// Registry errors.
var (
	ErrTypeEmpty   = fmt.Errorf("adapter type must not be empty")
	ErrTypeUnknown = fmt.Errorf("no adapter registered for type")
	ErrDuplicate   = fmt.Errorf("adapter type already registered")
)

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

// Registry holds a catalog of AlertAdapter factories indexed by type.
//
// Thread-safety: all public methods are safe for concurrent use.
type Registry struct {
	// mu guards writes; reads are lock-free via a separate read copy.
	mu       sync.RWMutex
	adapters map[string]AlertAdapter
	factory  AlertAdapterFactory
	logger   *zap.Logger
}

// AlertAdapterFactory is a constructor function that returns a fresh
// (unstarted) adapter instance. Each registry entry holds one instance at a
// time; create a new instance per adapter lifecycle.
type AlertAdapterFactory func() AlertAdapter

// NewRegistry creates a Registry with the given logger.
//
// The registry does not register built-ins automatically — call Register to
// add handlers, or RegisterBuiltin() to add the standard set.
func NewRegistry(logger *zap.Logger) *Registry {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &Registry{
		adapters: make(map[string]AlertAdapter),
		logger:   logger,
	}
}

// Register adds an adapter instance to the registry under its Type().
//
// If another adapter with the same type is already registered, the call is
// ignored and returns false. Returns true on success.
//
// The adapter is expected to be in AdapterStatusNew state.
func (r *Registry) Register(a AlertAdapter) (bool, error) {
	if a == nil {
		return false, ErrTypeEmpty
	}
	t := strings.ToLower(strings.TrimSpace(a.Type()))
	if t == "" {
		return false, ErrTypeEmpty
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.adapters[t]; ok {
		return false, fmt.Errorf("%w: %s", ErrDuplicate, t)
	}

	r.adapters[t] = a
	r.logger.Info("registered alert adapter",
		zap.String("type", t),
		zap.String("name", a.Name()),
	)
	return true, nil
}

// RegisterFactory adds an adapter by registering a factory function.
//
// This is the preferred way for built-in adapters: the factory is invoked
// lazily on first Start() call so that each lifecycle gets a fresh instance.
// The factory function is stored in r.factory; the adapter returned by
// RegisterFactory() itself is stored in r.adapters under its type.
//
// NOTE: For long-lived registry usage, prefer calling Register with a
// pre-constructed instance directly.
func (r *Registry) RegisterFactory(name string, fn AlertAdapterFactory) (bool, error) {
	a := fn()
	return r.Register(a)
}

// Get returns the adapter registered under the given type, or an error if none
// exists.
//
// Safe for concurrent reads.
func (r *Registry) Get(t string) (AlertAdapter, error) {
	t = strings.ToLower(strings.TrimSpace(t))
	if t == "" {
		return nil, ErrTypeEmpty
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	a, ok := r.adapters[t]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrTypeUnknown, t)
	}
	return a, nil
}

// Has returns whether an adapter of the given type is registered.
func (r *Registry) Has(t string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.adapters[strings.ToLower(t)]
	return ok
}

// Discover returns all registered adapters of the given category.
//
// Category filtering is based on the adapter's own semantics:
//   - "source"     — adapters that ingest alerts from monitoring systems
//   - "notification" — adapters that push to messaging channels
//   - "export"     — adapters that stream alerts to external sinks
//   - "" (empty)   — returns all adapters regardless of category
//
// Category is determined by the adapter's Type(); callers who want finer
// granularity should use the registry's List() method instead.
func (r *Registry) Discover(category string) []AlertAdapter {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if category == "" {
		result := make([]AlertAdapter, 0, len(r.adapters))
		for _, a := range r.adapters {
			result = append(result, a)
		}
		return result
	}

	// Category dispatch: map known categories to their type names
	catMap := categoryTypes(category)
	if catMap == nil {
		return nil
	}

	result := make([]AlertAdapter, 0, len(catMap))
	for _, a := range r.adapters {
		t := strings.ToLower(strings.TrimSpace(a.Type()))
		if catMap[t] {
			result = append(result, a)
		}
	}
	return result
}

// List returns all registered adapter types.
func (r *Registry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	types := make([]string, 0, len(r.adapters))
	for t := range r.adapters {
		types = append(types, t)
	}
	return types
}

// Len returns the number of registered adapters.
func (r *Registry) Len() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.adapters)
}

// StartAll starts every adapter with its config, logging errors for each one.
//
// Returns the number of adapters started and the number that failed.
func (r *Registry) StartAll(ctx context.Context, config map[string]string) (started, failed int) {
	r.mu.RLock()
	adapters := make([]AlertAdapter, 0, len(r.adapters))
	for _, a := range r.adapters {
		adapters = append(adapters, a)
	}
	r.mu.RUnlock()

	for _, a := range adapters {
		status, err := a.Start(ctx, config)
		if err != nil {
			r.logger.Error("failed to start adapter",
				zap.String("type", a.Type()),
				zap.Error(err),
			)
			failed++
			continue
		}
		if status == AdapterStatusRunning {
			started++
		}
	}
	return
}

// StopAll stops every adapter, logging errors for each one.
//
// Returns the number of adapters stopped and the number that failed.
func (r *Registry) StopAll(ctx context.Context) (stopped, failed int) {
	r.mu.RLock()
	adapters := make([]AlertAdapter, 0, len(r.adapters))
	for _, a := range r.adapters {
		adapters = append(adapters, a)
	}
	r.mu.RUnlock()

	for _, a := range adapters {
		status, err := a.Stop(ctx)
		if err != nil {
			r.logger.Error("failed to stop adapter",
				zap.String("type", a.Type()),
				zap.Error(err),
			)
			failed++
			continue
		}
		if status == AdapterStatusStopped || status == AdapterStatusNew {
			stopped++
		}
	}
	return
}

// HealthCheckAll probes every adapter and returns a summary map.
//
// Keys are adapter types, values are AdapterInfo.
func (r *Registry) HealthCheckAll(ctx context.Context) map[string]AdapterInfo {
	r.mu.RLock()
	adapters := make([]AlertAdapter, 0, len(r.adapters))
	for _, a := range r.adapters {
		adapters = append(adapters, a)
	}
	r.mu.RUnlock()

	result := make(map[string]AdapterInfo)
	for _, a := range adapters {
		info, err := a.HealthCheck(ctx)
		if err != nil {
			info.Status = AdapterStatusError
			info.Error = err.Error()
		}
		result[a.Type()] = info
	}
	return result
}

// ---------------------------------------------------------------------------
// categoryTypes — maps a category to the known type names for that category
// ---------------------------------------------------------------------------

func categoryTypes(cat string) map[string]bool {
	switch strings.ToLower(cat) {
	case "source":
		return map[string]bool{
			"prometheus": true,
			"grafana":    true,
			"zabbix":     true,
			"kafka":      true,
		}
	case "notification":
		return map[string]bool{
			"email":     true,
			"sms":       true,
			"wechat":    true,
			"slack":     true,
			"pagerduty": true,
		}
	case "export":
		return map[string]bool{
			"webhook": true,
		}
	}
	return nil
}
