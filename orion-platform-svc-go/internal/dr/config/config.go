package config

import (
	"fmt"
	"os"
)

// Config holds configuration for the disaster recovery service.
type Config struct {
	DBHost     string
	DBPort     int
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	RedisAddr  string
	NATSAddr   string
	NATSStream string
	ServerPort int
	Environment string
	OTLPEndpoint string
}

// Load reads configuration from environment variables.
func Load() *Config {
	port := getEnvInt("SERVER_PORT", 8080)
	dbPort := getEnvInt("DB_PORT", 5432)
	return &Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     dbPort,
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", ""),
		DBName:     getEnv("DB_NAME", "orion"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
		RedisAddr:  getEnv("REDIS_ADDR", "localhost:6379"),
		NATSAddr:   getEnv("NATS_ADDR", "nats://localhost:4222"),
		NATSStream: getEnv("NATS_STREAM", "orion"),
		ServerPort: port,
		Environment: getEnv("ENVIRONMENT", "development"),
		OTLPEndpoint: getEnv("OTLP_ENDPOINT", "localhost:4317"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	var n int
	_, _ = fmt.Sscanf(v, "%d", &n)
	return n
}
