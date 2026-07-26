package config

// Config holds serverless module configuration.
type Config struct {
	DefaultMemory int
	DefaultTimeout int
	DefaultReplicas int
}

func Load() *Config {
	return &Config{
		DefaultMemory:   256,
		DefaultTimeout:  30,
		DefaultReplicas: 1,
	}
}