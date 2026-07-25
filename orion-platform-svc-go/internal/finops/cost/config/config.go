package config

import (
	"os"
	"strconv"
)

// Config holds the server configuration loaded from environment variables.
type Config struct {
	Port       int
	DBHost     string
	DBPort     int
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	JWTSecret  string
	RedisAddr  string
	NATSAddr   string
	NATSStream string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	port, _ := strconv.Atoi(getEnv("PORT", "8080"))
	dbPort, _ := strconv.Atoi(getEnv("DB_PORT", "5432"))

	return &Config{
		Port:       port,
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     dbPort,
		DBUser:     requireEnv("DB_USER"),
		DBPassword: requireEnv("DB_PASSWORD"),
		DBName:     getEnv("DB_NAME", "orion_cost"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
		JWTSecret:  getEnv("JWT_SECRET", "change-me-in-production"),
		RedisAddr:  getEnv("REDIS_ADDR", "localhost:6379"),
		NATSAddr:   getEnv("NATS_ADDR", ""),
		NATSStream: getEnv("NATS_STREAM", "EVENTS"),
	}
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}

func requireEnv(key string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	panic("required environment variable not set: " + key)
}
