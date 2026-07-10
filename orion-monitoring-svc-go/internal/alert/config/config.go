package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all configuration for the alert service.
type Config struct {
	ServerPort    int
	DBHost        string
	DBPort        int
	DBName        string
	DBUser        string
	DBPassword    string
	DBSSLMode     string
	RedisAddr     string
	RedisDB       int
	JWTSecret     string
	Environment   string
	OTLPEndpoint  string
	DedupWindowMs int64 // deduplication window in milliseconds (default 4h)
}

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	port, err := strconv.Atoi(getEnv("SERVER_PORT", "8080"))
	if err != nil {
		return nil, fmt.Errorf("invalid SERVER_PORT: %w", err)
	}
	dbPort, err := strconv.Atoi(getEnv("DB_PORT", "5432"))
	if err != nil {
		return nil, fmt.Errorf("invalid DB_PORT: %w", err)
	}
	redisDB, err := strconv.Atoi(getEnv("REDIS_DB", "0"))
	if err != nil {
		return nil, fmt.Errorf("invalid REDIS_DB: %w", err)
	}
	dedupMs, err := strconv.ParseInt(getEnv("DEDUP_WINDOW_MS", "14400000"), 10, 64)
	if err != nil {
		dedupMs = 4 * 60 * 60 * 1000 // default 4 hours
	}

	return &Config{
		ServerPort:    port,
		DBHost:        getEnv("DB_HOST", "localhost"),
		DBPort:        dbPort,
		DBName:        getEnv("DB_NAME", "orion_alert"),
		DBUser:        getEnv("DB_USER", "postgres"),
		DBPassword:    getEnv("DB_PASSWORD", "postgres"),
		DBSSLMode:     getEnv("DB_SSL_MODE", "disable"),
		RedisAddr:     getEnv("REDIS_ADDR", "localhost:6379"),
		RedisDB:       redisDB,
		JWTSecret:     getEnv("JWT_SECRET", "change-me-in-production"),
		Environment:   getEnv("ENVIRONMENT", "development"),
		OTLPEndpoint:  getEnv("OTLP_ENDPOINT", "localhost:4317"),
		DedupWindowMs: dedupMs,
	}, nil
}

// DSN returns the PostgreSQL connection string.
func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode,
	)
}

// Addr returns the HTTP listener address.
func (c *Config) Addr() string {
	return fmt.Sprintf(":%d", c.ServerPort)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
