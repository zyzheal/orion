package config

import "os"

// TODO(refactor): This config package is duplicated across ai/llm, ai/intelligence, etc.
// Consider extracting to a shared ai/config package.
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