package config

import "os"

// Config holds configuration for the code service.
type Config struct {
	DatabaseURL string
	Port        string
}

// Load reads configuration from environment variables.
func Load() *Config {
	return &Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgresql://localhost:5432/code"),
		Port:        getEnv("PORT", "8080"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
