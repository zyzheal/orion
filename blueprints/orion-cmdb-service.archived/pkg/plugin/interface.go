package plugin

import (
	"context"
)

// PluginCapability represents the capability type of a plugin
type PluginCapability string

const (
	CapabilityCMDBProvider    PluginCapability = "CMDB_PROVIDER"
	CapabilityCIType          PluginCapability = "CI_TYPE"
	CapabilityTopology        PluginCapability = "TOPOLOGY"
	CapabilityImpactAnalysis PluginCapability = "IMPACT_ANALYSIS"
)

// PluginManifest contains metadata about the plugin
type PluginManifest struct {
	Name        string            `json:"name"`
	Version     string            `json:"version"`
	Description string            `json:"description"`
	Author      string            `json:"author"`
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

// CMDBPlugin is the interface for CMDB-specific plugins
type CMDBPlugin interface {
	Plugin

	// GetCITypes returns the list of CI types this plugin handles
	GetCITypes() []string

	// OnCICreated is called when a new CI is created
	OnCICreated(ctx context.Context, ci interface{}) error

	// OnCIUpdated is called when a CI is updated
	OnCIUpdated(ctx context.Context, oldCI, newCI interface{}) error

	// OnCIDeleted is called when a CI is deleted
	OnCIDeleted(ctx context.Context, ci interface{}) error
}