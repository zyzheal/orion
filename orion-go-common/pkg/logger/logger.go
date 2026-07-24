// Package logger provides shared structured logging setup for Orion Go services.
//
// Uses zap for high-performance structured logging with consistent formatting.
package logger

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Config holds logger configuration.
type Config struct {
	// Level is the minimum log level: "debug", "info", "warn", "error". Default: "info".
	Level string
	// Development enables development mode (console output, stacktraces on warn+).
	Development bool
	// ServiceName is added as a field to all log entries.
	ServiceName string
}

// DefaultConfig returns sensible defaults.
func DefaultConfig(serviceName string) Config {
	return Config{
		Level:       "info",
		Development: false,
		ServiceName: serviceName,
	}
}

// New creates a new zap.Logger from the given configuration.
func New(cfg Config) (*zap.Logger, error) {
	level, err := parseLevel(cfg.Level)
	if err != nil {
		level = zapcore.InfoLevel
	}

	var zapCfg zap.Config
	if cfg.Development {
		zapCfg = zap.NewDevelopmentConfig()
		zapCfg.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	} else {
		zapCfg = zap.NewProductionConfig()
		zapCfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	}

	zapCfg.Level = zap.NewAtomicLevelAt(level)

	logger, err := zapCfg.Build()
	if err != nil {
		return nil, err
	}

	// Add service name as a persistent field
	if cfg.ServiceName != "" {
		logger = logger.With(zap.String("service", cfg.ServiceName))
	}

	return logger, nil
}

// Must creates a logger or panics. Use in main() where error handling is not needed.
func Must(cfg Config) *zap.Logger {
	logger, err := New(cfg)
	if err != nil {
		panic("failed to create logger: " + err.Error())
	}
	return logger
}

// parseLevel parses a log level string to zapcore.Level.
func parseLevel(s string) (zapcore.Level, error) {
	var level zapcore.Level
	return level, level.UnmarshalText([]byte(s))
}
