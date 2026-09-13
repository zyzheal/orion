// Package registry provides the Adapter registry for CMDB collector vendor
// adapters.
//
// The registry is the single lookup point: services and handlers ask for a
// Collector by name or type, and the registry returns the matching adapter.
//
// Thread-safety: the registry is built on sync.Map, so adapters may be
// registered before or during startup (e.g. via package init() hooks) without
// a separate lock.  Read-only lookups are lock-free.
package registry

import (
	"sync"

	"orion/platform-svc-go/internal/cmdb-collector/interfaces"
)

// Registry is the canonical adapter registry for CMDB collectors.
//
// It supports:
//   - Register(name, adapter) — add one adapter
//   - Get(name) — find an adapter by its Name()
//   - GetByType(type) — all adapters for an asset class ("network", "server", …)
//   - List() / Count() / Names() — introspection
type Registry struct {
	byName sync.Map // string -> interfaces.Adapter
	byType sync.Map // string -> []interfaces.Adapter
}

// NewRegistry returns a fresh, empty Registry.
func NewRegistry() *Registry {
	return &Registry{}
}

// Register adds an adapter.  If an adapter with the same Name() is already
// registered, Register replaces it in both indexes.
//
// The adapter is assumed to be immutable after this call — Register is
// designed to run at startup or from package init().
func (r *Registry) Register(adapter interfaces.Adapter) {
	name := adapter.Name()
	collector := adapter.Collector()

	// Update name -> adapter index
	r.byName.Store(name, adapter)

	// Rebuild type index entry
	var adapters []interfaces.Adapter
	if raw, ok := r.byType.Load(collector.Type()); ok {
		adapters = raw.([]interfaces.Adapter)
	}
	// Remove previous entry for this adapter in the type list (replace)
	replace := make([]interfaces.Adapter, 0, len(adapters))
	for _, a := range adapters {
		if a.Name() != name {
			replace = append(replace, a)
		}
	}
	replace = append(replace, adapter)
	r.byType.Store(collector.Type(), replace)
}

// Get returns the adapter registered under name.  ok is false when name is
// not found.
func (r *Registry) Get(name string) (interfaces.Adapter, bool) {
	raw, ok := r.byName.Load(name)
	if !ok {
		return nil, false
	}
	return raw.(interfaces.Adapter), true
}

// GetByType returns all adapters whose Collector.Type() matches t.
func (r *Registry) GetByType(t string) []interfaces.Adapter {
	raw, ok := r.byType.Load(t)
	if !ok {
		return nil
	}
	adapters := raw.([]interfaces.Adapter)
	// Return a copy so callers cannot mutate the internal slice
	out := make([]interfaces.Adapter, len(adapters))
	copy(out, adapters)
	return out
}

// List returns a shallow copy of all registered adapters.
func (r *Registry) List() []interfaces.Adapter {
	out := make([]interfaces.Adapter, 0)
	r.byName.Range(func(_, val interface{}) bool {
		out = append(out, val.(interfaces.Adapter))
		return true
	})
	return out
}

// Count returns the number of registered adapters.
func (r *Registry) Count() int {
	count := 0
	r.byName.Range(func(_, _ interface{}) bool {
		count++
		return true
	})
	return count
}

// Names returns the set of registered adapter names.
func (r *Registry) Names() []string {
	names := make([]string, 0)
	r.byName.Range(func(key, _ interface{}) bool {
		names = append(names, key.(string))
		return true
	})
	return names
}

// ---------------------------------------------------------------------------
// Default registry
//
// Default() is a process-wide registry available to code that has no injection
// point.  It is EMPTY: no Adapter implementation is registered anywhere in
// this repository, so Default().Count() is 0.  Adapters must be added by
// Register()-ing them explicitly at wiring time; ListCollectors will report an
// empty catalog until then.
// ---------------------------------------------------------------------------

var defaultRegistry = NewRegistry()

// Default returns the package-level registry. See the note above: it starts
// empty and nothing populates it automatically.
func Default() *Registry {
	return defaultRegistry
}
