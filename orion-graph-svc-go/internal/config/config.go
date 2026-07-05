package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port       int
	DBHost     string
	DBPort     int
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	JWTSecret  string
	RedisAddr  string
	NATSAddr   string
	NATSStream string
}

func Load() *Config {
	port, _ := strconv.Atoi(getEnv("PORT", "8080"))
	dbPort, _ := strconv.Atoi(getEnv("DB_PORT", "5432"))

	jwtSecret := getEnv("JWT_SECRET", "change-me-in-production")
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	natsAddr := getEnv("NATS_ADDR", "")
	natsStream := getEnv("NATS_STREAM", "ORION")

	return &Config{
		Port:       port,
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     dbPort,
		DBUser:     requireEnv("DB_USER"),
		DBPassword: requireEnv("DB_PASSWORD"),
		DBName:     getEnv("DB_NAME", "orion_graph"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
		JWTSecret:  jwtSecret,
		RedisAddr:  redisAddr,
		NATSAddr:   natsAddr,
		NATSStream: natsStream,
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
