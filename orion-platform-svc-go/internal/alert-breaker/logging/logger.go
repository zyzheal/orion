package logging

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Config controls the behavior of the circuit breaker logger.
type Config struct {
	Level      zapcore.Level
	DevMode    bool
	MaxSize    int    // MB per log file (0 = no file output)
	MaxBackups int    // max old log files to keep
	MaxAge     int    // max days to keep old files
}

// DefaultConfig returns a logger config suitable for production.
func DefaultConfig() Config {
	return Config{
		Level:      zapcore.InfoLevel,
		DevMode:    false,
		MaxSize:    100,
		MaxBackups: 7,
		MaxAge:     30,
	}
}

// Logger wraps a zap.Logger for circuit breaker operations.
type Logger struct {
	zap *zap.Logger
}

// New creates a new Logger with the given config.
func New(cfg Config) (*Logger, error) {
	ec := zap.NewProductionEncoderConfig()
	ec.TimeKey = "ts"
	ec.EncodeTime = zapcore.ISO8601TimeEncoder
	ec.StacktraceKey = "stacktrace"

	encoder := zapcore.NewJSONEncoder(ec)

	level := cfg.Level
	if cfg.DevMode {
		encoder = zapcore.NewConsoleEncoder(ec)
		level = zapcore.DebugLevel
	}

	core := zapcore.NewCore(encoder, zapcore.AddSync(os.Stdout), level)

	zl := zap.New(core,
		zap.AddCallerSkip(1),
		zap.AddCaller(),
	)

	return &Logger{zap: zl}, nil
}

// NewProductionLogger creates a production-ready logger (JSON output).
func NewProductionLogger() (*Logger, error) {
	return New(DefaultConfig())
}

// NewDevLogger creates a development logger (color console output).
func NewDevLogger() (*Logger, error) {
	return New(Config{Level: zapcore.DebugLevel, DevMode: true})
}

// Info logs structured info messages.
func (l *Logger) Info(msg string, fields ...zap.Field) {
	l.zap.Info(msg, fields...)
}

// Debug logs structured debug messages.
func (l *Logger) Debug(msg string, fields ...zap.Field) {
	l.zap.Debug(msg, fields...)
}

// Warn logs structured warning messages.
func (l *Logger) Warn(msg string, fields ...zap.Field) {
	l.zap.Warn(msg, fields...)
}

// Error logs structured error messages.
func (l *Logger) Error(msg string, fields ...zap.Field) {
	l.zap.Error(msg, fields...)
}

// Sync flushes any buffered log entries.
func (l *Logger) Sync() error {
	return l.zap.Sync()
}

// With creates a new logger with additional fields.
func (l *Logger) With(fields ...zap.Field) *Logger {
	return &Logger{zap: l.zap.With(fields...)}
}

// Common fields used throughout the circuit breaker package.

// ConfigIDField returns a zap field for a config ID.
func ConfigIDField(configID string) zap.Field {
	return zap.String("config_id", configID)
}

// StateField returns a zap field for a breaker state.
func StateField(state string) zap.Field {
	return zap.String("state", state)
}

// StrategyField returns a zap field for a strategy name.
func StrategyField(strategy string) zap.Field {
	return zap.String("strategy", strategy)
}

// FailureCountField returns a zap field for a failure count.
func FailureCountField(count int) zap.Field {
	return zap.Int("failure_count", count)
}

// SuccessCountField returns a zap field for a success count.
func SuccessCountField(count int) zap.Field {
	return zap.Int("success_count", count)
}

// ReasonField returns a zap field for a transition reason.
func ReasonField(reason string) zap.Field {
	return zap.String("reason", reason)
}

// ErrorField returns a zap field for an error.
func ErrorField(err error) zap.Field {
	return zap.Error(err)
}

// LatencyField returns a zap field for a latency duration in ms.
func LatencyField(ms float64) zap.Field {
	return zap.Float64("latency_ms", ms)
}
