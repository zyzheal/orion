package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	Redis    RedisConfig    `yaml:"redis"`
	Otel     OtelConfig     `yaml:"otel"`
	JWT      JWTConfig      `yaml:"jwt"`
	CORS     CORSConfig     `yaml:"cors"`
}

type ServerConfig struct {
	Port int    `yaml:"port"`
	Mode string `yaml:"mode"`
}

type DatabaseConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	DBName   string `yaml:"dbname"`
	SSLMode  string `yaml:"ssl_mode"`
}

func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.DBName, d.SSLMode)
}

type RedisConfig struct {
	Addr     string `yaml:"addr"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
}

type OtelConfig struct {
	Enabled     bool   `yaml:"enabled"`
	Endpoint    string `yaml:"endpoint"`
	ServiceName string `yaml:"service_name"`
}

type JWTConfig struct {
	Secret string `yaml:"secret"`
}

type CORSConfig struct {
	Origins []string `yaml:"origins"`
}

func Load() (*Config, error) {
	var cfg Config

	// Defaults (no credentials — must be provided via env or config file)
	cfg.Server.Port = 8081
	cfg.Server.Mode = "debug"
	cfg.Database.Host = "localhost"
	cfg.Database.Port = 5432
	cfg.Database.SSLMode = "disable"
	cfg.Redis.Addr = "localhost:6379"
	cfg.Otel.Enabled = false
	cfg.Otel.Endpoint = "localhost:4318"
	cfg.Otel.ServiceName = "orion-ticket-svc"
	cfg.CORS.Origins = []string{"http://localhost:3000", "http://localhost:5173"}

	// Load config file first (lower priority)
	if data, err := os.ReadFile("config.yaml"); err == nil {
		_ = yaml.Unmarshal(data, &cfg)
	}

	// Override from env (higher priority than config file)
	if v := os.Getenv("TICKET_SVC_PORT"); v != "" {
		if port, err := strconv.Atoi(v); err == nil {
			cfg.Server.Port = port
		}
	}
	if v := os.Getenv("GIN_MODE"); v != "" {
		cfg.Server.Mode = v
	}
	if v := os.Getenv("DB_HOST"); v != "" {
		cfg.Database.Host = v
	}
	if v := os.Getenv("DB_PORT"); v != "" {
		if port, err := strconv.Atoi(v); err == nil {
			cfg.Database.Port = port
		}
	}
	if v := os.Getenv("DB_USER"); v != "" {
		cfg.Database.User = v
	}
	if v := os.Getenv("DB_PASSWORD"); v != "" {
		cfg.Database.Password = v
	}
	if v := os.Getenv("DB_NAME"); v != "" {
		cfg.Database.DBName = v
	}
	if v := os.Getenv("DB_SSLMODE"); v != "" {
		cfg.Database.SSLMode = v
	}
	if v := os.Getenv("REDIS_ADDR"); v != "" {
		cfg.Redis.Addr = v
	}
	if v := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"); v != "" {
		cfg.Otel.Endpoint = v
		cfg.Otel.Enabled = true
	}
	if v := os.Getenv("JWT_SECRET"); v != "" {
		cfg.JWT.Secret = v
	}
	if v := os.Getenv("CORS_ORIGINS"); v != "" {
		cfg.CORS.Origins = strings.Split(v, ",")
	}

	// Validate required config
	if cfg.Database.User == "" || cfg.Database.Password == "" {
		return nil, fmt.Errorf("database credentials required: set DB_USER and DB_PASSWORD (or config.yaml)")
	}
	if cfg.JWT.Secret == "" || cfg.JWT.Secret == "orion-jwt-secret-change-me" {
		return nil, fmt.Errorf("JWT_SECRET required: set JWT_SECRET env var (default is insecure)")
	}

	return &cfg, nil
}
