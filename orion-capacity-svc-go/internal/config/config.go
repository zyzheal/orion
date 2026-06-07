package config

import "os"

type Config struct {
	Port string
	DSN  string
	JWTSecret  string
	RedisAddr  string
}

func Load() *Config {
		jwtSecret := getEnv("JWT_SECRET", "change-me-in-production")
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")

return &Config{
		Port: getEnv("PORT", "8080"),
		DSN:  getEnv("DATABASE_URL", "postgres://orion:orion@localhost:5432/orion_capacity?sslmode=disable"),
			JWTSecret:  jwtSecret,
		RedisAddr:  redisAddr,
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
