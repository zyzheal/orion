package versionchart

import "go.uber.org/zap"

// ---------------------------------------------------------------------------
// ZapLogger — adapts go.uber.org/zap.Logger to the versionchart.Logger interface
// ---------------------------------------------------------------------------

// ZapLogger wraps a zap.Logger to satisfy the Logger interface used by the
// chart renderer. This keeps the renderer decoupled from zap while providing
// drop-in integration for services that already use zap.
type ZapLogger struct {
	log *zap.Logger
}

// NewZapLogger returns a Logger backed by the provided zap.Logger.
func NewZapLogger(log *zap.Logger) Logger {
	return &ZapLogger{log: log}
}

func (l *ZapLogger) Info(msg string, fields ...interface{}) {
	keysAndValues := append([]interface{}{"msg", msg}, fields...)
	l.log.Info("", zap.Any("kv", flattenFields(keysAndValues...)))
}

func (l *ZapLogger) Warn(msg string, fields ...interface{}) {
	keysAndValues := append([]interface{}{"msg", msg}, fields...)
	l.log.Warn("", zap.Any("kv", flattenFields(keysAndValues...)))
}

func (l *ZapLogger) Error(msg string, fields ...interface{}) {
	keysAndValues := append([]interface{}{"msg", msg}, fields...)
	l.log.Error("", zap.Any("kv", flattenFields(keysAndValues...)))
}

func (l *ZapLogger) Debug(msg string, fields ...interface{}) {
	keysAndValues := append([]interface{}{"msg", msg}, fields...)
	l.log.Debug("", zap.Any("kv", flattenFields(keysAndValues...)))
}

// flattenFields converts a slice of key-value pairs into a map for zap.Any.
func flattenFields(keysAndValues ...interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for i := 0; i+1 < len(keysAndValues); i += 2 {
		if k, ok := keysAndValues[i].(string); ok {
			result[k] = keysAndValues[i+1]
		}
	}
	return result
}
