package config

import (
	"time"

	"github.com/spf13/viper"
)

// Config holds all configuration for the knowledge service.
type Config struct {
	ServiceName  string        `mapstructure:"SERVICE_NAME"`
	Environment  string        `mapstructure:"ENVIRONMENT"`
	HTTPAddr     string        `mapstructure:"HTTP_ADDR"`
	DatabaseURL  string        `mapstructure:"DATABASE_URL"`
	RedisAddr    string        `mapstructure:"REDIS_ADDR"`
	RedisDB      int           `mapstructure:"REDIS_DB"`
	JWTSecret    string        `mapstructure:"JWT_SECRET"`
	OTelEndpoint string        `mapstructure:"OTEL_ENDPOINT"`
	NATSAddr     string        `mapstructure:"nats_addr"`
	NATSStream   string        `mapstructure:"nats_stream"`
}

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	viper.SetDefault("SERVICE_NAME", "orion-knowledge-svc-go")
	viper.SetDefault("ENVIRONMENT", "development")
	viper.SetDefault("HTTP_ADDR", ":8089")
	viper.SetDefault("REDIS_ADDR", "localhost:6379")
	viper.SetDefault("REDIS_DB", 0)
	viper.SetDefault("OTEL_ENDPOINT", "")
	viper.SetDefault("nats_addr", "nats://localhost:4222")
	viper.SetDefault("nats_stream", "EVENTS")

	viper.AutomaticEnv()

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	if cfg.DatabaseURL == "" {
		return nil, &ConfigError{Field: "DATABASE_URL", Message: "database URL is required"}
	}
	if cfg.JWTSecret == "" {
		return nil, &ConfigError{Field: "JWT_SECRET", Message: "JWT secret is required"}
	}

	return &cfg, nil
}

// ConfigError represents a configuration validation error.
type ConfigError struct {
	Field   string
	Message string
}

func (e *ConfigError) Error() string {
	return e.Field + ": " + e.Message
}

// ShutdownTimeout is the timeout for graceful shutdown.
const ShutdownTimeout = 10 * time.Second
