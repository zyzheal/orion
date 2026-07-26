package config

import (
	"os"
)

// Config holds alert-breaker service configuration.
type Config struct {
	HTTPAddr string
	DBDSN    string
	JWTSecret string
	LogLevel string
	Env      string
}

// Load reads configuration from environment variables.
func Load() Config {
	return Config{
		HTTPAddr:  getEnv("HTTP_ADDR", ":8083"),
		DBDSN:     getEnv("DB_DSN", ""),
		JWTSecret: getEnv("JWT_SECRET", ""),
		LogLevel:  getEnv("LOG_LEVEL", "info"),
		Env:       getEnv("ENVIRONMENT", "development"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
