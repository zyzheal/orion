package config

import (
	"log"
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

	jwtSecret := requireEnv("JWT_SECRET")
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")

	return &Config{
		Port:       port,
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     dbPort,
		DBUser:     requireEnv("DB_USER"),
		DBPassword: requireEnv("DB_PASSWORD"),
		DBName:     getEnv("DB_NAME", "orion_federation"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
		JWTSecret:  jwtSecret,
		RedisAddr:  redisAddr,
		NATSAddr:   getEnv("NATS_ADDR", "nats://localhost:4222"),
		NATSStream: getEnv("NATS_STREAM", "EVENTS"),
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
}
