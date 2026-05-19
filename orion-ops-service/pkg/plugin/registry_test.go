package plugin

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockOpsPlugin implements Plugin and OpsPlugin for testing
type mockOpsPlugin struct {
	name         string
	version      string
	capabilities []PluginCapability
	connectionTypes []string
	initCalled   bool
	startCalled  bool
	stopCalled   bool
}

func (m *mockOpsPlugin) Manifest() *PluginManifest {
	return &PluginManifest{
		Name:         m.name,
		Version:     m.version,
		Description: "Mock Ops plugin for testing",
		Author:      "Test",
		Capabilities: m.capabilities,
	}
}

func (m *mockOpsPlugin) Initialize(ctx context.Context, config map[string]interface{}) error {
	m.initCalled = true
	return nil
}

func (m *mockOpsPlugin) Start(ctx context.Context) error {
	m.startCalled = true
	return nil
}

func (m *mockOpsPlugin) Stop(ctx context.Context) error {
	m.stopCalled = true
	return nil
}

func (m *mockOpsPlugin) GetCapabilities() []PluginCapability {
	return m.capabilities
}

func (m *mockOpsPlugin) GetConnectionTypes() []string {
	return m.connectionTypes
}

func (m *mockOpsPlugin) OnExecutionResult(ctx context.Context, result interface{}) error {
	return nil
}

func TestNewRegistry(t *testing.T) {
	registry := NewRegistry()
	require.NotNil(t, registry)
	assert.Empty(t, registry.List())
}

func TestRegistryRegister(t *testing.T) {
	registry := NewRegistry()

	plugin := &mockOpsPlugin{
		name:         "ssh-plugin",
		version:      "1.0.0",
		capabilities: []PluginCapability{CapabilityTerminal, CapabilityBatchExecutor},
	}

	err := registry.Register("ssh-plugin", plugin)
	require.NoError(t, err)

	names := registry.List()
	assert.Len(t, names, 1)
	assert.Equal(t, "ssh-plugin", names[0])
}

func TestRegistryRegisterDuplicate(t *testing.T) {
	registry := NewRegistry()

	plugin1 := &mockOpsPlugin{name: "ssh-plugin", version: "1.0.0", capabilities: []PluginCapability{CapabilityTerminal}}
	plugin2 := &mockOpsPlugin{name: "ssh-plugin", version: "1.0.0", capabilities: []PluginCapability{CapabilityBatchExecutor}}

	err := registry.Register("ssh-plugin", plugin1)
	require.NoError(t, err)

	err = registry.Register("ssh-plugin", plugin2)
	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrPluginAlreadyRegistered)
}

func TestRegistryRegisterEmptyName(t *testing.T) {
	registry := NewRegistry()
	plugin := &mockOpsPlugin{name: "test", version: "1.0.0", capabilities: []PluginCapability{}}

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

	plugin := &mockOpsPlugin{
		name:         "sftp-plugin",
		version:      "1.0.0",
		capabilities: []PluginCapability{CapabilityFileTransfer},
		connectionTypes: []string{"sftp", "scp"},
	}

	registry.Register("sftp-plugin", plugin)

	retrieved, exists := registry.Get("sftp-plugin")
	assert.True(t, exists)
	assert.Equal(t, "sftp-plugin", retrieved.Manifest().Name)

	opsPlugin, ok := retrieved.(OpsPlugin)
	require.True(t, ok)
	assert.Equal(t, []string{"sftp", "scp"}, opsPlugin.GetConnectionTypes())

	_, exists = registry.Get("nonexistent")
	assert.False(t, exists)
}

func TestRegistryUnregister(t *testing.T) {
	registry := NewRegistry()

	plugin := &mockOpsPlugin{name: "scheduler-plugin", version: "1.0.0", capabilities: []PluginCapability{CapabilityScheduler}}
	registry.Register("scheduler-plugin", plugin)

	err := registry.Unregister("scheduler-plugin")
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

	plugin := &mockOpsPlugin{
		name:         "monitor-plugin",
		version:      "1.0.0",
		capabilities: []PluginCapability{CapabilityMonitor},
	}

	registry.Register("monitor-plugin", plugin)

	err := registry.InitializeAll(context.Background(), map[string]map[string]interface{}{
		"monitor-plugin": {"interval": 60},
	})

	require.NoError(t, err)
	assert.True(t, plugin.initCalled)
}

func TestRegistryStartAll(t *testing.T) {
	registry := NewRegistry()

	plugin := &mockOpsPlugin{name: "terminal-plugin", version: "1.0.0", capabilities: []PluginCapability{CapabilityTerminal}}
	registry.Register("terminal-plugin", plugin)

	err := registry.StartAll(context.Background())
	require.NoError(t, err)
	assert.True(t, plugin.startCalled)
}

func TestRegistryStopAll(t *testing.T) {
	registry := NewRegistry()

	plugin := &mockOpsPlugin{name: "batch-plugin", version: "1.0.0", capabilities: []PluginCapability{CapabilityBatchExecutor}}
	registry.Register("batch-plugin", plugin)

	plugin.startCalled = true // Simulate started state

	err := registry.StopAll(context.Background())
	require.NoError(t, err)
	assert.True(t, plugin.stopCalled)
}