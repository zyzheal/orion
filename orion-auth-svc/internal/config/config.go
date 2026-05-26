package config

import (
	"fmt"
	"os"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	ServiceName            string
	Environment            string
	HTTPAddr               string
	DatabaseURL            string
	RedisAddr              string
	RedisDB                int
	JWTSecret              string
	JWTExpiration          time.Duration
	JWTRefreshExpiration   time.Duration
	OTelEndpoint           string
}

func Load() (*Config, error) {
	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")

	v.SetDefault("service_name", "orion-auth-svc")
	v.SetDefault("environment", "development")
	v.SetDefault("http_addr", ":8082")
	v.SetDefault("database_url", "postgres://orion:orion@localhost:5432/orion_auth?sslmode=disable")
	v.SetDefault("redis_addr", "localhost:6379")
	v.SetDefault("redis_db", 0)
	v.SetDefault("jwt_secret", "")
	v.SetDefault("jwt_expiration", 24*time.Hour)
	v.SetDefault("jwt_refresh_expiration", 7*24*time.Hour)
	v.SetDefault("otel_endpoint", "")

	_ = v.ReadInConfig()
	v.AutomaticEnv()

	cfg := &Config{
		ServiceName:          getEnvOrConfig("SERVICE_NAME", v.GetString("service_name")),
		Environment:          getEnvOrConfig("ENVIRONMENT", v.GetString("environment")),
		HTTPAddr:             getEnvOrConfig("HTTP_ADDR", v.GetString("http_addr")),
		DatabaseURL:          getEnvOrConfig("DATABASE_URL", v.GetString("database_url")),
		RedisAddr:            getEnvOrConfig("REDIS_ADDR", v.GetString("redis_addr")),
		RedisDB:              v.GetInt("redis_db"),
		JWTSecret:            getEnvOrConfig("JWT_SECRET", v.GetString("jwt_secret")),
		JWTExpiration:        v.GetDuration("jwt_expiration"),
		JWTRefreshExpiration: v.GetDuration("jwt_refresh_expiration"),
		OTelEndpoint:         getEnvOrConfig("OTEL_ENDPOINT", v.GetString("otel_endpoint")),
	}

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
