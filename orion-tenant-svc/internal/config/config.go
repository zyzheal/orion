package config

import (
	"fmt"
	"os"

	"github.com/spf13/viper"
)

type Config struct {
	ServiceName   string
	Environment   string
	HTTPAddr      string
	DatabaseURL   string
	JWTSecret     string
	OTelEndpoint  string
}

func Load() (*Config, error) {
	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")

	v.SetDefault("service_name", "orion-tenant-svc")
	v.SetDefault("environment", "development")
	v.SetDefault("http_addr", ":8083")
	v.SetDefault("database_url", "postgres://orion:orion@localhost:5432/orion_tenant?sslmode=disable")
	v.SetDefault("jwt_secret", "")
	v.SetDefault("otel_endpoint", "")

	_ = v.ReadInConfig()
	v.AutomaticEnv()

	cfg := &Config{
		ServiceName:  getEnvOrConfig("SERVICE_NAME", v.GetString("service_name")),
		Environment:  getEnvOrConfig("ENVIRONMENT", v.GetString("environment")),
		HTTPAddr:     getEnvOrConfig("HTTP_ADDR", v.GetString("http_addr")),
		DatabaseURL:  getEnvOrConfig("DATABASE_URL", v.GetString("database_url")),
		JWTSecret:    getEnvOrConfig("JWT_SECRET", v.GetString("jwt_secret")),
		OTelEndpoint: getEnvOrConfig("OTEL_ENDPOINT", v.GetString("otel_endpoint")),
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

func getEnvOrConfig(envKey, fallback string) string {
	if val := os.Getenv(envKey); val != "" {
		return val
	}
	return fallback
}
