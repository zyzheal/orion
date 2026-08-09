// Package factory provides the ExecutorFactory: a Registry implementation with
// sync.Map storage and init()-based auto-registration of starter plugins.
//
// Architecture (inspired by NeatLogic's plugin SPI):
//   ExecutorFactory (registry)
//       ├── Plugin: ShellExecutorPlugin
//       ├── Plugin: PythonExecutorPlugin
//       ├── Plugin: HTTPExecutorPlugin
//       ├── Plugin: SQLEXecutorPlugin
//       └── Plugin: WebhookExecutorPlugin
//
// Usage:
//   // Access the global factory
//   factory := auto_exec.Factory()
//
//   // Look up a plugin by type
//   if p, ok := factory.Get("shell"); ok {
//       result, err := p.Execute(ctx, params)
//   }
package factory

import (
	"errors"
	"fmt"
	"sync"

	"orion/platform-svc-go/internal/auto-exec/interfaces"
	"orion/platform-svc-go/internal/auto-exec/models"
	"orion/platform-svc-go/internal/auto-exec/plugins"
)

// ---------------------------------------------------------------------------
// factory — global instance
// ---------------------------------------------------------------------------

var (
	factory     *ExecutorFactory
	factoryOnce sync.Once
)

// Factory returns the global ExecutorFactory.  init() auto-registers the
// bundled starter plugins, so the factory is ready to use immediately.
func Factory() *ExecutorFactory {
	factoryOnce.Do(func() {
		factory = NewExecutorFactory()
	})
	return factory
}

// ---------------------------------------------------------------------------
// ExecutorFactory
// ---------------------------------------------------------------------------

// ExecutorFactory is a thread-safe plugin registry backed by sync.Map.
type ExecutorFactory struct {
	registry sync.Map // name (string) -> interfaces.ExecutorPlugin
}

// NewExecutorFactory creates a fresh factory (for testing).
func NewExecutorFactory() *ExecutorFactory {
	return &ExecutorFactory{}
}

// Register adds a plugin to the registry.  Replacing an existing plugin with
// the same name returns an error.
func (f *ExecutorFactory) Register(p interfaces.ExecutorPlugin) error {
	name := p.Name()
	if _, loaded := f.registry.LoadOrStore(name, p); loaded {
		return fmt.Errorf("plugin already registered: %s", name)
	}
	return nil
}

// Unregister removes a plugin from the registry.
func (f *ExecutorFactory) Unregister(name string) {
	f.registry.Delete(name)
}

// Get returns the plugin for the given name.
func (f *ExecutorFactory) Get(name string) (interfaces.ExecutorPlugin, bool) {
	v, ok := f.registry.Load(name)
	if !ok {
		return nil, false
	}
	return v.(interfaces.ExecutorPlugin), true
}

// All returns a snapshot of every registered plugin.
func (f *ExecutorFactory) All() []interfaces.ExecutorPlugin {
	var out []interfaces.ExecutorPlugin
	f.registry.Range(func(_, v any) bool {
		out = append(out, v.(interfaces.ExecutorPlugin))
		return true
	})
	return out
}

// Metadata returns a list of plugin descriptions for API consumption.
func (f *ExecutorFactory) Metadata() []models.PluginMetadata {
	var out []models.PluginMetadata
	f.registry.Range(func(_, v any) bool {
		p := v.(interfaces.ExecutorPlugin)
		out = append(out, models.PluginMetadata{
			Name:        p.Name(),
			Description: p.Description(),
			TimeoutSec:  int(p.DefaultTimeout().Seconds()),
		})
		return true
	})
	return out
}

// ---------------------------------------------------------------------------
// Init — auto-register bundled starter plugins
// ---------------------------------------------------------------------------

func init() {
	f := Factory()

	bundled := []interfaces.ExecutorPlugin{
		plugins.NewShellPlugin(),
		plugins.NewPythonPlugin(),
		plugins.NewHTTPPlugin(),
		plugins.NewSQLPlugin(),
		plugins.NewWebhookPlugin(),
	}

	for _, p := range bundled {
		if err := f.Register(p); err != nil {
			panic(fmt.Sprintf("auto-exec: failed to register plugin %q: %v", p.Name(), err))
		}
	}

	// Pipeline plugin — registered with a default no-op runner.  Production
	// deployments should call plugins.SetTriggerPipelineRunner(...) at startup
	// to inject the real pipeline-executor service.
	pipelinePlugin := plugins.NewPipelinePlugin(
		plugins.NewDefaultPipelineRunner(),
	)
	if err := f.Register(pipelinePlugin); err != nil {
		panic(fmt.Sprintf("auto-exec: failed to register plugin %q: %v", pipelinePlugin.Name(), err))
	}
}

// ---------------------------------------------------------------------------
// Helper: Validate plugin exists
// ---------------------------------------------------------------------------

// ValidatePlugin checks that a plugin type is registered.
func ValidatePlugin(name string) error {
	_, ok := Factory().Get(name)
	if !ok {
		return errors.New("unknown executor plugin: " + name)
	}
	return nil
}
