package plugin

import "errors"

// Sentinel errors for the plugin SPI.
var (
	// ErrPluginNotFound is returned when the requested plugin is not registered.
	ErrPluginNotFound = errors.New("plugin: not found")

	// ErrPluginNotReady is returned when the plugin is not initialised or
	// reports unhealthy.
	ErrPluginNotReady = errors.New("plugin: not ready")

	// ErrPluginTimeout is returned when execution exceeds the configured
	// timeout.
	ErrPluginTimeout = errors.New("plugin: execution timed out")

	// ErrPluginKilled is returned when execution was forcibly killed (e.g.
	// resource limit exceeded or manual kill).
	ErrPluginKilled = errors.New("plugin: execution killed")

	// ErrPluginRejected is returned when the execution was rejected before
	// starting (e.g. concurrency limit reached).
	ErrPluginRejected = errors.New("plugin: execution rejected")

	// ErrPluginPanic is returned when the plugin panics during execution.
	ErrPluginPanic = errors.New("plugin: execution panicked")

	// ErrPluginDisabled is returned when the plugin is disabled and cannot
	// execute.
	ErrPluginDisabled = errors.New("plugin: disabled")
)