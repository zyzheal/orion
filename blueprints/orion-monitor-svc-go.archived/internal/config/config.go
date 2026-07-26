package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	ServerPort     int
	DBHost         string
	DBPort         int
	DBName         string
	DBUser         string
	DBPassword     string
	DBSSLMode      string
	RedisAddr      string
	RedisDB        int
	OTLPEndpoint   string
	Environment    string
	JWTSecret      string
	NATSAddr       string
	NATSStream     string
	PrometheusURL  string
}

func Load() (*Config, error) {
	port, err := strconv.Atoi(getEnv("SERVER_PORT", "8080"))
	if err != nil {
		return nil, fmt.Errorf("invalid SERVER_PORT: %w", err)
	}

	dbPort, err := strconv.Atoi(getEnv("DB_PORT", "5432"))
	if err != nil {
		return nil, fmt.Errorf("invalid DB_PORT: %w", err)
	}

	redisDB, err := strconv.Atoi(getEnv("REDIS_DB", "0"))
	if err != nil {
		return nil, fmt.Errorf("invalid REDIS_DB: %w", err)
	}

		jwtSecret := getEnv("JWT_SECRET", "change-me-in-production")
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")

return &Config{
		ServerPort:   port,
		DBHost:       getEnv("DB_HOST", "localhost"),
		DBPort:       dbPort,
		DBName:       getEnv("DB_NAME", "orion_monitor"),
		DBUser:       getEnv("DB_USER", "postgres"),
		DBPassword:   getEnv("DB_PASSWORD", "postgres"),
		DBSSLMode:    getEnv("DB_SSL_MODE", "disable"),
		RedisAddr:    redisAddr,
		RedisDB:      redisDB,
		OTLPEndpoint: getEnv("OTLP_ENDPOINT", "localhost:4317"),
		Environment:  getEnv("ENVIRONMENT", "development"),
		JWTSecret:    jwtSecret,
		NATSAddr:       getEnv("NATS_ADDR", "nats://localhost:4222"),
		NATSStream:     getEnv("NATS_STREAM", "EVENTS"),
		PrometheusURL:  getEnv("PROMETHEUS_URL", "http://localhost:9090"),
	}, nil
}

func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode,
	)
}

func (c *Config) Addr() string {
	return fmt.Sprintf(":%d", c.ServerPort)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
