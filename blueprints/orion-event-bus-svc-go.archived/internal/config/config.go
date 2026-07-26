package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port         int
	DBHost       string
	DBPort       int
	DBUser       string
	DBPassword   string
	DBName       string
	DBSSLMode    string
	JWTSecret    string
	RedisAddr    string
	NATSURLs     string
	NATSUser     string
	NATSPassword string
}

func Load() *Config {
	port, _ := strconv.Atoi(getEnv("PORT", "8080"))
	dbPort, _ := strconv.Atoi(getEnv("DB_PORT", "5432"))

	jwtSecret := getEnv("JWT_SECRET", "change-me-in-production")
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	natsURLs := getEnv("NATS_URLS", "nats://localhost:4222")

	return &Config{
		Port:         port,
		DBHost:       getEnv("DB_HOST", "localhost"),
		DBPort:       dbPort,
		DBUser:       requireEnv("DB_USER"),
		DBPassword:   requireEnv("DB_PASSWORD"),
		DBName:       getEnv("DB_NAME", "orion_event_bus"),
		DBSSLMode:    getEnv("DB_SSLMODE", "disable"),
		JWTSecret:    jwtSecret,
		RedisAddr:    redisAddr,
		NATSURLs:     natsURLs,
		NATSUser:     getEnv("NATS_USER", ""),
		NATSPassword: getEnv("NATS_PASSWORD", ""),
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
	panic("required environment variable not set: " + key)
}
