// Package apicomponent implements the APIComponent registry.
//
// The registry is a thread-safe collection of APIComponent instances that
// provides discovery, lookup, and registration capabilities. It serves as the
// central data structure from which the RouterBuilder constructs a Gin engine.
//
// The registry supports:
//   - Registering components by name (unique constraint)
//   - Looking up components by name
//   - Listing all registered components
//   - Iterating over all routes across all components
//   - Discovering route paths for documentation and OpenAPI generation

package apicomponent

import (
	"sync"

	"github.com/gin-gonic/gin"
)

// Registry is a thread-safe collection of APIComponent instances.
type Registry struct {
	mu       sync.RWMutex
	components map[string]*APIComponent
	// registration order for deterministic iteration
	order []string
}

// NewRegistry creates a new empty Registry.
func NewRegistry() *Registry {
	return &Registry{
		components: make(map[string]*APIComponent),
	}
}

// Register adds a component to the registry. It returns an error if a component
// with the same name is already registered, or if the component fails validation.
// Duplicate route paths within a component are also checked.
func (r *Registry) Register(comp *APIComponent) error {
	if comp == nil {
		return &ConfigError{Field: "Component", Reason: "component is nil"}
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.components[comp.Name]; exists {
		return &ConfigError{Field: "Name", Reason: "component '" + comp.Name + "' already registered"}
	}

	// Validate all routes before registering
	if err := r.validateComponent(comp); err != nil {
		return err
	}

	r.components[comp.Name] = comp
	r.order = append(r.order, comp.Name)
	comp.SetRegistered(true)
	return nil
}

// Unregister removes a component from the registry. It returns ErrComponentNotFound
// if the component was never registered.
func (r *Registry) Unregister(name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	comp, exists := r.components[name]
	if !exists {
		return ErrComponentNotFound
	}

	delete(r.components, name)
	for i, n := range r.order {
		if n == name {
			r.order = append(r.order[:i], r.order[i+1:]...)
			break
		}
	}
	comp.SetRegistered(false)
	return nil
}

// Get retrieves a component by name. Returns nil if not found.
func (r *Registry) Get(name string) *APIComponent {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.components[name]
}

// Has checks whether a component with the given name is registered.
func (r *Registry) Has(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.components[name]
	return exists
}

// All returns a slice of all registered components in registration order.
// The returned slice is a shallow copy of the internal order.
func (r *Registry) All() []*APIComponent {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]*APIComponent, len(r.order))
	for i, name := range r.order {
		result[i] = r.components[name]
	}
	return result
}

// AllRoutes returns a flat list of all routes across all components.
// Each route is wrapped with its component prefix and version for full path resolution.
func (r *Registry) AllRoutes() []FullRoute {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var routes []FullRoute
	for _, comp := range r.components {
		for _, route := range comp.Routes {
			routes = append(routes, FullRoute{
				ComponentName: comp.Name,
				Version:       comp.Version,
				Prefix:        comp.Prefix,
				Path:          route.Path,
				FullPath:      comp.FullPath(route.Path),
				Methods:       route.Methods,
				Handler:       route.Handler,
				Middleware:    route.Middleware,
				Metadata:      route.Metadata,
				Tags:          route.Tags,
				Summary:       route.Summary,
			})
		}
	}
	return routes
}

// ComponentNames returns the list of registered component names.
func (r *Registry) ComponentNames() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, len(r.order))
	copy(names, r.order)
	return names
}

// Count returns the number of registered components.
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.components)
}

// RouteCount returns the total number of routes across all components.
func (r *Registry) RouteCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	total := 0
	for _, comp := range r.components {
		total += len(comp.Routes)
	}
	return total
}

// FilterByTag returns all components that contain the given tag.
func (r *Registry) FilterByTag(tag string) []*APIComponent {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []*APIComponent
	for _, comp := range r.components {
		for _, t := range comp.Tags {
			if t == tag {
				result = append(result, comp)
				break
			}
		}
	}
	return result
}

// FullRoute represents a route with full path resolution including component prefix.
type FullRoute struct {
	ComponentName string
	Version       string
	Prefix        string
	Path          string
	FullPath      string
	Methods       []HTTPMethod
	Handler       gin.HandlerFunc
	Middleware    MiddlewareChain
	Metadata      gin.H
	Tags          []string
	Summary       string
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// validateComponent checks a component for configuration errors before registering.
func (r *Registry) validateComponent(comp *APIComponent) error {
	if comp.Name == "" {
		return &ConfigError{Field: "Name", Reason: "component name is required"}
	}
	if comp.Prefix == "" {
		return &ConfigError{Field: "Prefix", Reason: "component prefix is required"}
	}

	// Check for duplicate route paths within the component
	seen := make(map[string]bool)
	for _, route := range comp.Routes {
		if err := route.Validate(); err != nil {
			return err
		}
		if route.HasDuplicateMethods() {
			return &ConfigError{Field: "Methods", Reason: "duplicate HTTP method in route"}
		}
		fullPath := comp.FullPath(route.Path)
		for _, m := range route.Methods {
			key := string(m) + " " + fullPath
			if seen[key] {
				return &ConfigError{Field: "Routes", Reason: "duplicate route: " + key}
			}
			seen[key] = true
		}
	}

	return nil
}
