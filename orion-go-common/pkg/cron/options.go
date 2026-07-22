// Package cron provides a shared, global Cron scheduler for Orion Go services.
//
// It wraps github.com/robfig/cron/v3 with named job registration, lifecycle
// control (start/stop/pause/resume), and structured zap logging.
//
// The scheduler is framework-level (not domain-specific): services import this
// package and register their own Job functions.
package cron

import (
	"time"

	"go.uber.org/zap"
)

// Option is a functional option applied to Scheduler configuration.
type Option func(*Config)

// Config holds Scheduler configuration.
type Config struct {
	// Location is the time zone in which cron expressions are evaluated.
	// Defaults to time.UTC.
	Location *time.Location

	// Logger is the zap logger used for job execution logs.
	// Defaults to a no-op logger if nil.
	Logger *zap.Logger

	// Running indicates whether the scheduler starts automatically.
	// When false, the caller must call Start() explicitly.
	Running bool

	// WithSeconds enables six-field cron expressions (sec min hour dom month dow).
	// When false, the standard five-field format is used.
	WithSeconds bool
}

// DefaultConfig returns a Config with safe defaults (UTC, nil logger, not auto-starting).
func DefaultConfig() Config {
	return Config{
		Location:  time.UTC,
		Logger:    nil,
		Running:   false,
		WithSeconds: false,
	}
}

// WithLocation sets the time zone for cron expression evaluation.
func WithLocation(loc *time.Location) Option {
	return func(c *Config) {
		c.Location = loc
	}
}

// WithLogger sets the zap logger for job execution logs.
func WithLogger(logger *zap.Logger) Option {
	return func(c *Config) {
		c.Logger = logger
	}
}

// AutoStart configures the scheduler to begin running immediately after New().
func AutoStart() Option {
	return func(c *Config) {
		c.Running = true
	}
}

// WithSeconds enables the six-field (seconds-precision) cron expression format.
func WithSeconds() Option {
	return func(c *Config) {
		c.WithSeconds = true
	}
}
