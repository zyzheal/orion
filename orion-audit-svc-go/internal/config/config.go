package config

import (
	"fmt"
	"os"

	"github.com/spf13/viper"
)

type Config struct {
	ServiceName  string
	Environment  string
	HTTPAddr     string
	DatabaseURL  string
	RedisAddr    string
	RedisDB      int
	OTelEndpoint string
}

func Load() (*Config, error) {
	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")

	v.SetDefault("service_name", "orion-audit-svc")
	v.SetDefault("environment", "development")
	v.SetDefault("http_addr", ":8081")
	v.SetDefault("database_url", "postgres://orion:orion@localhost:5432/orion_audit?sslmode=disable")
	v.SetDefault("redis_addr", "localhost:6379")
	v.SetDefault("redis_db", 0)
	v.SetDefault("otel_endpoint", "")

	_ = v.ReadInConfig()
	v.AutomaticEnv()

	cfg := &Config{
		ServiceName:  getEnvOrConfig("SERVICE_NAME", v.GetString("service_name")),
		Environment:  getEnvOrConfig("ENVIRONMENT", v.GetString("environment")),
		HTTPAddr:     getEnvOrConfig("HTTP_ADDR", v.GetString("http_addr")),
		DatabaseURL:  getEnvOrConfig("DATABASE_URL", v.GetString("database_url")),
		RedisAddr:    getEnvOrConfig("REDIS_ADDR", v.GetString("redis_addr")),
		RedisDB:      v.GetInt("redis_db"),
		OTelEndpoint: getEnvOrConfig("OTEL_ENDPOINT", v.GetString("otel_endpoint")),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	return cfg, nil
}

func getEnvOrConfig(envKey string, fallback string) string {
	if val := os.Getenv(envKey); val != "" {
		return val
	}
	return fallback
}
