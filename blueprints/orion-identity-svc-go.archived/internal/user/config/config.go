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
	JWTSecret    string
	OTelEndpoint string
	NATSAddr     string
	NATSStream   string
}

func Load() (*Config, error) {
	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")

	v.SetDefault("service_name", "orion-user-svc-go")
	v.SetDefault("environment", "development")
	v.SetDefault("http_addr", ":8084")
	v.SetDefault("database_url", "postgres://orion:orion@localhost:5432/orion_user?sslmode=disable")
	v.SetDefault("redis_addr", "localhost:6379")
	v.SetDefault("redis_db", 0)
	v.SetDefault("jwt_secret", "")
	v.SetDefault("otel_endpoint", "")
	v.SetDefault("nats_addr", "nats://localhost:4222")
	v.SetDefault("nats_stream", "EVENTS")

	_ = v.ReadInConfig()
	v.AutomaticEnv()

	cfg := &Config{
		ServiceName:  getEnvOrConfig("SERVICE_NAME", v.GetString("service_name")),
		Environment:  getEnvOrConfig("ENVIRONMENT", v.GetString("environment")),
		HTTPAddr:     getEnvOrConfig("HTTP_ADDR", v.GetString("http_addr")),
		DatabaseURL:  getEnvOrConfig("DATABASE_URL", v.GetString("database_url")),
		RedisAddr:    getEnvOrConfig("REDIS_ADDR", v.GetString("redis_addr")),
		RedisDB:      v.GetInt("redis_db"),
		JWTSecret:    getEnvOrConfig("JWT_SECRET", v.GetString("jwt_secret")),
		OTelEndpoint: getEnvOrConfig("OTEL_ENDPOINT", v.GetString("otel_endpoint")),
		NATSAddr:     getEnvOrConfig("NATS_ADDR", v.GetString("nats_addr")),
		NATSStream:   getEnvOrConfig("NATS_STREAM", v.GetString("nats_stream")),
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
