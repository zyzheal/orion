package config

import "os"

type Config struct{}

func Load() *Config {
	return &Config{}
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}