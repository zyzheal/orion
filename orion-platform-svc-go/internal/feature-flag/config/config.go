package config

import (
	"log"
	"os"
	"strconv"
)

type Config struct {
	Port                   int
	DBHost                 string
	DBPort                 int
	DBUser                 string
	DBPassword             string
	DBName                 string
	DBSSLMode              string
	JWTSecret              string
	RedisAddr              string
	NATSAddr               string
	NATSStream             string
	OTELExporterEndpoint   string
	OTELInsecure           bool
}

func Load() *Config {
	port, _ := strconv.Atoi(getEnv("PORT", "8080"))
	dbPort, _ := strconv.Atoi(getEnv("DB_PORT", "5432"))

	jwtSecret := requireEnv("JWT_SECRET")
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")

	return &Config{
		Port:                   port,
		DBHost:                 getEnv("DB_HOST", "localhost"),
		DBPort:                 dbPort,
		DBUser:                 requireEnv("DB_USER"),
		DBPassword:             requireEnv("DB_PASSWORD"),
		DBName:                 getEnv("DB_NAME", "orion_feature-flag"),
		DBSSLMode:              getEnv("DB_SSLMODE", "disable"),
		JWTSecret:              jwtSecret,
		RedisAddr:              redisAddr,
		NATSAddr:               getEnv("NATS_ADDR", "nats://localhost:4222"),
		NATSStream:             getEnv("NATS_STREAM", "EVENTS"),
		OTELExporterEndpoint:   getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
		OTELInsecure:           getEnvBool("OTEL_EXPORTER_OTLP_INSECURE", true),
	}
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}

func requireEnv(key string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	log.Fatal("required environment variable not set: " + key)
	return ""
}

func getEnvBool(key string, defaultValue bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return defaultValue
	}
	return v == "true" || v == "1"
}
