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
}

func Load() *Config {
	port, _ := strconv.Atoi(getEnv("PORT", "8080"))
	dbPort, _ := strconv.Atoi(getEnv("DB_PORT", "5432"))

	return &Config{
		Port:       port,
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     dbPort,
		DBUser:     requireEnv("DB_USER"),
		DBPassword: requireEnv("DB_PASSWORD"),
		DBName:     getEnv("DB_NAME", "orion_llm"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
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
