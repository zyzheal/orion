package config

import (
	"fmt"
	"os"

	"github.com/spf13/viper"
)

type Config struct {
	ServiceName      string
	Environment      string
	HTTPAddr         string
	JWTSecret        string
	RedisURL         string
	OTelEndpoint     string
	RateLimitRPS     int
	AllowedOrigins   []string
	Upstreams        map[string]string
	CSPEnabled       bool
	CSPDirectives    string
}

func Load() (*Config, error) {
	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")

	v.SetDefault("service_name", "orion-api-gateway")
	v.SetDefault("environment", "development")
	v.SetDefault("http_addr", ":3000")
	v.SetDefault("jwt_secret", "")
	v.SetDefault("redis_url", "redis://localhost:6379/0")
	v.SetDefault("otel_endpoint", "")
	v.SetDefault("rate_limit_rps", 100)
	v.SetDefault("allowed_origins", []string{"*"})
	v.SetDefault("csp_enabled", true)
	v.SetDefault("csp_directives", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'")

	_ = v.ReadInConfig()
	v.AutomaticEnv()

	cfg := &Config{
		ServiceName:   getEnvOrConfig("SERVICE_NAME", v.GetString("service_name")),
		Environment:   getEnvOrConfig("ENVIRONMENT", v.GetString("environment")),
		HTTPAddr:      getEnvOrConfig("HTTP_ADDR", v.GetString("http_addr")),
		JWTSecret:     getEnvOrConfig("JWT_SECRET", v.GetString("jwt_secret")),
		RedisURL:      getEnvOrConfig("REDIS_URL", v.GetString("redis_url")),
		OTelEndpoint:  getEnvOrConfig("OTEL_ENDPOINT", v.GetString("otel_endpoint")),
		RateLimitRPS:  v.GetInt("rate_limit_rps"),
		AllowedOrigins: v.GetStringSlice("allowed_origins"),
		CSPEnabled:    v.GetBool("csp_enabled"),
		CSPDirectives: v.GetString("csp_directives"),
	}

	upstreams := map[string]string{}
	_ = v.UnmarshalKey("upstreams", &upstreams)
	cfg.Upstreams = upstreams

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

func getEnvOrConfig(envKey string, fallback string) string {
	if val := os.Getenv(envKey); val != "" {
		return val
	}
	return fallback
}
