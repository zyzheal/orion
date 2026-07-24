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
	NATS     NATSConfig     `yaml:"nats"`
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

type NATSConfig struct {
	Addr   string `yaml:"addr"`
	Stream string `yaml:"stream"`
}

func Load() (*Config, error) {
	var cfg Config

	cfg.Server.Port = 3036
	cfg.Server.Mode = "debug"
	cfg.Database.Host = "localhost"
	cfg.Database.Port = 5432
	cfg.Database.SSLMode = "disable"
	cfg.Redis.Addr = "localhost:6379"
	cfg.Otel.Enabled = false
	cfg.Otel.Endpoint = "localhost:4318"
	cfg.Otel.ServiceName = "orion-tool-svc"
	cfg.CORS.Origins = []string{"http://localhost:3000", "http://localhost:5173"}
	cfg.NATS.Addr = "nats://localhost:4222"
	cfg.NATS.Stream = "EVENTS"

	if data, err := os.ReadFile("config.yaml"); err == nil {
		if err := yaml.Unmarshal(data, &cfg); err != nil {
			return nil, fmt.Errorf("parse config.yaml: %w", err)
		}
	}

	if v := os.Getenv("TOOL_SVC_PORT"); v != "" {
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
	if v := os.Getenv("NATS_ADDR"); v != "" {
		cfg.NATS.Addr = v
	}
	if v := os.Getenv("NATS_STREAM"); v != "" {
		cfg.NATS.Stream = v
	}

	if cfg.Database.User == "" || cfg.Database.Password == "" {
		return nil, fmt.Errorf("database credentials required: set DB_USER and DB_PASSWORD")
	}
	if cfg.JWT.Secret == "" {
		return nil, fmt.Errorf("JWT_SECRET required: set JWT_SECRET env var")
	}

	return &cfg, nil
}
