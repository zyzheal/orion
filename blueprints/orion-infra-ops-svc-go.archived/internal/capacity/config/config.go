package config

import "os"

type Config struct {
	Port       string
	DSN        string
	JWTSecret  string
	RedisAddr  string
	NATSAddr   string
	NATSStream string
}

func Load() *Config {
	jwtSecret := getEnv("JWT_SECRET", "change-me-in-production")
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	natsAddr := getEnv("NATS_ADDR", "")
	natsStream := getEnv("NATS_STREAM", "ORION")

	return &Config{
		Port:       getEnv("PORT", "8080"),
		DSN:        getEnv("DATABASE_URL", "postgres://orion:orion@localhost:5432/orion_capacity?sslmode=disable"),
		JWTSecret:  jwtSecret,
		RedisAddr:  redisAddr,
		NATSAddr:   natsAddr,
		NATSStream: natsStream,
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
