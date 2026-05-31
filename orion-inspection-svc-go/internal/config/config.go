package config

import "os"

type Config struct {
	Port string
	DSN  string
}

func Load() *Config {
	return &Config{
		Port: getEnv("PORT", "8080"),
		DSN:  getEnv("DATABASE_URL", "postgres://orion:orion@localhost:5432/orion_inspection?sslmode=disable"),
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
