package plugin

import (
	"context"
)

// PluginCapability represents the capability type of a plugin
type PluginCapability string

const (
	CapabilityTerminal      PluginCapability = "TERMINAL"
	CapabilityBatchExecutor PluginCapability = "BATCH_EXECUTOR"
	CapabilityFileTransfer  PluginCapability = "FILE_TRANSFER"
	CapabilityScheduler     PluginCapability = "SCHEDULER"
	CapabilityMonitor       PluginCapability = "MONITOR"
)

// PluginManifest contains metadata about the plugin
type PluginManifest struct {
	Name         string            `json:"name"`
	Version      string            `json:"version"`
	Description  string            `json:"description"`
	Author       string            `json:"author"`
	Capabilities []PluginCapability `json:"capabilities"`
}

// Plugin is the base interface that all plugins must implement
type Plugin interface {
	// Manifest returns the plugin manifest
	Manifest() *PluginManifest

	// Initialize is called when the plugin is loaded
	Initialize(ctx context.Context, config map[string]interface{}) error

	// Start is called to start the plugin
	Start(ctx context.Context) error

	// Stop is called to stop the plugin
	Stop(ctx context.Context) error

	// GetCapabilities returns the list of capabilities this plugin provides
	GetCapabilities() []PluginCapability
}

// OpsPlugin is the interface for Ops-specific plugins
type OpsPlugin interface {
	Plugin

	// GetConnectionTypes returns the list of connection types this plugin supports
	GetConnectionTypes() []string

	// OnExecutionResult is called when an execution completes
	OnExecutionResult(ctx context.Context, result interface{}) error
}