package plugin

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockPlugin implements Plugin for testing
type mockPlugin struct {
	name        string
	version     string
	capabilities []PluginCapability
	ciTypes     []string
	initCalled  bool
	startCalled bool
	stopCalled  bool
}

func (m *mockPlugin) Manifest() *PluginManifest {
	return &PluginManifest{
		Name:         m.name,
		Version:     m.version,
		Description: "Mock plugin for testing",
		Author:      "Test",
		Capabilities: m.capabilities,
	}
}

func (m *mockPlugin) Initialize(ctx context.Context, config map[string]interface{}) error {
	m.initCalled = true
	return nil
}

func (m *mockPlugin) Start(ctx context.Context) error {
	m.startCalled = true
	return nil
}

func (m *mockPlugin) Stop(ctx context.Context) error {
	m.stopCalled = true
	return nil
}

func (m *mockPlugin) GetCapabilities() []PluginCapability {
	return m.capabilities
}

func (m *mockPlugin) GetCITypes() []string {
	return m.ciTypes
}

func (m *mockPlugin) OnCICreated(ctx context.Context, ci interface{}) error {
	return nil
}

func (m *mockPlugin) OnCIUpdated(ctx context.Context, oldCI, newCI interface{}) error {
	return nil
}

func (m *mockPlugin) OnCIDeleted(ctx context.Context, ci interface{}) error {
	return nil
}

func TestNewRegistry(t *testing.T) {
	registry := NewRegistry()
	require.NotNil(t, registry)
	assert.Empty(t, registry.List())
}

func TestRegistryRegister(t *testing.T) {
	registry := NewRegistry()

	plugin := &mockPlugin{
		name:        "test-plugin",
		version:     "1.0.0",
		capabilities: []PluginCapability{CapabilityCMDBProvider},
	}

	err := registry.Register("test-plugin", plugin)
	require.NoError(t, err)

	names := registry.List()
	assert.Len(t, names, 1)
	assert.Equal(t, "test-plugin", names[0])
}

func TestRegistryRegisterDuplicate(t *testing.T) {
	registry := NewRegistry()

	plugin1 := &mockPlugin{name: "test-plugin", version: "1.0.0", capabilities: []PluginCapability{CapabilityCMDBProvider}}
	plugin2 := &mockPlugin{name: "test-plugin", version: "1.0.0", capabilities: []PluginCapability{CapabilityCIType}}

	err := registry.Register("test-plugin", plugin1)
	require.NoError(t, err)

	err = registry.Register("test-plugin", plugin2)
	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrPluginAlreadyRegistered)
}

func TestRegistryRegisterEmptyName(t *testing.T) {
	registry := NewRegistry()
	plugin := &mockPlugin{name: "test", version: "1.0.0", capabilities: []PluginCapability{}}

	err := registry.Register("", plugin)
	assert.Error(t, err)
}

func TestRegistryRegisterNil(t *testing.T) {
	registry := NewRegistry()
	err := registry.Register("test", nil)
	assert.Error(t, err)
}

func TestRegistryGet(t *testing.T) {
	registry := NewRegistry()

	plugin := &mockPlugin{
		name:        "test-plugin",
		version:     "1.0.0",
		capabilities: []PluginCapability{CapabilityTopology},
	}

	registry.Register("test-plugin", plugin)

	retrieved, exists := registry.Get("test-plugin")
	assert.True(t, exists)
	assert.Equal(t, "test-plugin", retrieved.Manifest().Name)

	_, exists = registry.Get("nonexistent")
	assert.False(t, exists)
}

func TestRegistryUnregister(t *testing.T) {
	registry := NewRegistry()

	plugin := &mockPlugin{name: "test-plugin", version: "1.0.0", capabilities: []PluginCapability{}}
	registry.Register("test-plugin", plugin)

	err := registry.Unregister("test-plugin")
	require.NoError(t, err)

	assert.Empty(t, registry.List())
}

func TestRegistryUnregisterNotFound(t *testing.T) {
	registry := NewRegistry()
	err := registry.Unregister("nonexistent")
	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrPluginNotFound)
}

func TestRegistryInitializeAll(t *testing.T) {
	registry := NewRegistry()

	plugin := &mockPlugin{
		name:        "test-plugin",
		version:     "1.0.0",
		capabilities: []PluginCapability{CapabilityImpactAnalysis},
	}

	registry.Register("test-plugin", plugin)

	err := registry.InitializeAll(context.Background(), map[string]map[string]interface{}{
		"test-plugin": {"key": "value"},
	})

	require.NoError(t, err)
	assert.True(t, plugin.initCalled)
}

func TestRegistryStartAll(t *testing.T) {
	registry := NewRegistry()

	plugin := &mockPlugin{name: "test-plugin", version: "1.0.0", capabilities: []PluginCapability{}}
	registry.Register("test-plugin", plugin)

	err := registry.StartAll(context.Background())
	require.NoError(t, err)
	assert.True(t, plugin.startCalled)
}

func TestRegistryStopAll(t *testing.T) {
	registry := NewRegistry()

	plugin := &mockPlugin{name: "test-plugin", version: "1.0.0", capabilities: []PluginCapability{}}
	registry.Register("test-plugin", plugin)

	plugin.startCalled = true // Simulate started state

	err := registry.StopAll(context.Background())
	require.NoError(t, err)
	assert.True(t, plugin.stopCalled)
}