package plugin

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

var (
	// ErrPluginAlreadyRegistered is returned when a plugin with the same name is already registered
	ErrPluginAlreadyRegistered = errors.New("plugin already registered")
	// ErrPluginNotFound is returned when a plugin is not found
	ErrPluginNotFound = errors.New("plugin not found")
)

// Registry manages plugin registration and lookup
type Registry struct {
	plugins map[string]Plugin
	mu      sync.RWMutex
}

// NewRegistry creates a new plugin registry
func NewRegistry() *Registry {
	return &Registry{
		plugins: make(map[string]Plugin),
	}
}

// Register adds a plugin to the registry
func (r *Registry) Register(name string, plugin Plugin) error {
	if name == "" {
		return errors.New("plugin name cannot be empty")
	}
	if plugin == nil {
		return errors.New("plugin cannot be nil")
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.plugins[name]; exists {
		return fmt.Errorf("%w: %s", ErrPluginAlreadyRegistered, name)
	}

	r.plugins[name] = plugin
	return nil
}

// Get retrieves a plugin by name
func (r *Registry) Get(name string) (Plugin, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	plugin, exists := r.plugins[name]
	return plugin, exists
}

// List returns all registered plugin names
func (r *Registry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	names := make([]string, 0, len(r.plugins))
	for name := range r.plugins {
		names = append(names, name)
	}
	return names
}

// Unregister removes a plugin from the registry
func (r *Registry) Unregister(name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.plugins[name]; !exists {
		return fmt.Errorf("%w: %s", ErrPluginNotFound, name)
	}

	delete(r.plugins, name)
	return nil
}

// InitializeAll initializes all registered plugins
func (r *Registry) InitializeAll(ctx context.Context, configs map[string]map[string]interface{}) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for name, plugin := range r.plugins {
		config := configs[name]
		if err := plugin.Initialize(ctx, config); err != nil {
			return fmt.Errorf("failed to initialize plugin %s: %w", name, err)
		}
	}
	return nil
}

// StartAll starts all registered plugins
func (r *Registry) StartAll(ctx context.Context) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for name, plugin := range r.plugins {
		if err := plugin.Start(ctx); err != nil {
			return fmt.Errorf("failed to start plugin %s: %w", name, err)
		}
	}
	return nil
}

// StopAll stops all registered plugins
func (r *Registry) StopAll(ctx context.Context) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// Stop in reverse order to handle dependencies
	for i := len(r.plugins) - 1; i >= 0; i-- {
		name := r.List()[i]
		plugin := r.plugins[name]
		if err := plugin.Stop(ctx); err != nil {
			return fmt.Errorf("failed to stop plugin %s: %w", name, err)
		}
	}
	return nil
}