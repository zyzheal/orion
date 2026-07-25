package config

// Config holds module-level configuration for cache-mgmt.
type Config struct{}

// Load returns a default configuration.
func Load() *Config {
	return &Config{}
}
