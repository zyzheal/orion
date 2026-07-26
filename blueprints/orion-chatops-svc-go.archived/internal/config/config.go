package config

import "os"

type Config struct {
	DatabaseURL string
	NATSUrl     string
	Port        string
}

func Load() *Config {
	return &Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgresql://localhost:5432/chatops"),
		NATSUrl:     getEnv("NATS_URL", "nats://localhost:4222"),
		Port:        getEnv("PORT", "8080"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
