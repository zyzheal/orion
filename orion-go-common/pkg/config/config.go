// Package config provides shared configuration loading for Orion Go services.
//
// Supports loading from YAML config file + environment variable overrides.
// Replaces per-service duplicated config loaders.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// BaseConfig holds configuration fields common to all Orion Go services.
type BaseConfig struct {
	// ServiceName is the name of the service (used in OTel, logs, health checks).
	ServiceName string
	// Environment is the deployment environment: "development", "staging", "production".
	Environment string
	// HTTPAddr is the address to listen on (e.g., ":8080").
	HTTPAddr string
	// DatabaseURL is the PostgreSQL connection string.
	DatabaseURL string
	// RedisAddr is the Redis address (host:port).
	RedisAddr string
	// RedisPassword is the Redis password.
	RedisPassword string
	// RedisDB is the Redis database number.
	RedisDB int
	// OTelEndpoint is the OpenTelemetry collector endpoint (empty = disabled).
	OTelEndpoint string
	// LogLevel is the log level: "debug", "info", "warn", "error".
	LogLevel string
}

// DefaultBaseConfig returns sensible defaults for BaseConfig.
func DefaultBaseConfig(serviceName string) BaseConfig {
	return BaseConfig{
		ServiceName: serviceName,
		Environment: "development",
		HTTPAddr:    ":8080",
		RedisAddr:   "localhost:6379",
		LogLevel:    "info",
	}
}

// LoadBaseConfig loads BaseConfig from environment variables with fallback defaults.
func LoadBaseConfig(serviceName string) BaseConfig {
	cfg := DefaultBaseConfig(serviceName)

	if v := os.Getenv("SERVICE_NAME"); v != "" {
		cfg.ServiceName = v
	}
	if v := os.Getenv("ENVIRONMENT"); v != "" {
		cfg.Environment = v
	}
	if v := os.Getenv("HTTP_ADDR"); v != "" {
		cfg.HTTPAddr = v
	}
	if v := os.Getenv("DATABASE_URL"); v != "" {
		cfg.DatabaseURL = v
	}
	if v := os.Getenv("REDIS_ADDR"); v != "" {
		cfg.RedisAddr = v
	}
	if v := os.Getenv("REDIS_PASSWORD"); v != "" {
		cfg.RedisPassword = v
	}
	if v := os.Getenv("REDIS_DB"); v != "" {
		if db, err := strconv.Atoi(v); err == nil {
			cfg.RedisDB = db
		}
	}
	if v := os.Getenv("OTEL_ENDPOINT"); v != "" {
		cfg.OTelEndpoint = v
	}
	if v := os.Getenv("LOG_LEVEL"); v != "" {
		cfg.LogLevel = v
	}

	return cfg
}

// DatabaseConfig holds database connection parameters.
type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// DSN returns the PostgreSQL connection string.
func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.DBName, d.SSLMode)
}

// DefaultDatabaseConfig returns sensible defaults.
func DefaultDatabaseConfig() DatabaseConfig {
	return DatabaseConfig{
		Host:    "localhost",
		Port:    5432,
		SSLMode: "disable",
	}
}

// LoadDatabaseConfig loads DatabaseConfig from environment variables.
func LoadDatabaseConfig() DatabaseConfig {
	cfg := DefaultDatabaseConfig()

	if v := os.Getenv("DB_HOST"); v != "" {
		cfg.Host = v
	}
	if v := os.Getenv("DB_PORT"); v != "" {
		if port, err := strconv.Atoi(v); err == nil {
			cfg.Port = port
		}
	}
	if v := os.Getenv("DB_USER"); v != "" {
		cfg.User = v
	}
	if v := os.Getenv("DB_PASSWORD"); v != "" {
		cfg.Password = v
	}
	if v := os.Getenv("DB_NAME"); v != "" {
		cfg.DBName = v
	}
	if v := os.Getenv("DB_SSLMODE"); v != "" {
		cfg.SSLMode = v
	}

	return cfg
}

// Validate checks that required fields are set.
func (d DatabaseConfig) Validate() error {
	if d.User == "" {
		return fmt.Errorf("DB_USER is required")
	}
	if d.Password == "" {
		return fmt.Errorf("DB_PASSWORD is required")
	}
	if d.DBName == "" {
		return fmt.Errorf("DB_NAME is required")
	}
	return nil
}

// RedisConfig holds Redis connection parameters.
type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

// LoadRedisConfig loads RedisConfig from environment variables.
func LoadRedisConfig() RedisConfig {
	cfg := RedisConfig{
		Addr: "localhost:6379",
	}
	if v := os.Getenv("REDIS_ADDR"); v != "" {
		cfg.Addr = v
	}
	if v := os.Getenv("REDIS_PASSWORD"); v != "" {
		cfg.Password = v
	}
	if v := os.Getenv("REDIS_DB"); v != "" {
		if db, err := strconv.Atoi(v); err == nil {
			cfg.DB = db
		}
	}
	return cfg
}

// JWTConfig holds JWT configuration.
type JWTConfig struct {
	Secret           string
	Expiration       time.Duration
	RefreshExpiration time.Duration
}

// LoadJWTConfig loads JWTConfig from environment variables.
func LoadJWTConfig() JWTConfig {
	cfg := JWTConfig{
		Expiration:        5 * time.Minute,
		RefreshExpiration: 7 * 24 * time.Hour,
	}
	if v := os.Getenv("JWT_SECRET"); v != "" {
		cfg.Secret = v
	}
	if v := os.Getenv("JWT_EXPIRATION"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.Expiration = d
		}
	}
	if v := os.Getenv("JWT_REFRESH_EXPIRATION"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.RefreshExpiration = d
		}
	}
	return cfg
}

// Getenv returns the environment variable value or the fallback.
func Getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// GetenvInt returns the environment variable as an int or the fallback.
func GetenvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

// GetenvBool returns the environment variable as a bool or the fallback.
func GetenvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}

// GetenvDuration returns the environment variable as a time.Duration or the fallback.
func GetenvDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}

// GetenvSlice returns the environment variable as a string slice (comma-separated) or the fallback.
func GetenvSlice(key string, fallback []string) []string {
	if v := os.Getenv(key); v != "" {
		return strings.Split(v, ",")
	}
	return fallback
}
