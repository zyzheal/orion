package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server    ServerConfig    `yaml:"server"`
	Database  DatabaseConfig  `yaml:"database"`
	Redis     RedisConfig     `yaml:"redis"`
	Otel      OtelConfig      `yaml:"otel"`
	JWT       JWTConfig       `yaml:"jwt"`
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
	return "host=" + d.Host + " port=" + itos(d.Port) + " user=" + d.User + " password=" + d.Password + " dbname=" + d.DBName + " sslmode=" + d.SSLMode
}

func itos(n int) string {
	return string(rune('0'+n/1000%10)) + string(rune('0'+n/100%10)) + string(rune('0'+n/10%10)) + string(rune('0'+n%10))
}

type RedisConfig struct {
	Addr     string `yaml:"addr"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
}

type OtelConfig struct {
	Enabled   bool   `yaml:"enabled"`
	Endpoint  string `yaml:"endpoint"`
	ServiceName string `yaml:"service_name"`
}

type JWTConfig struct {
	Secret string `yaml:"secret"`
}

func Load() (*Config, error) {
	var cfg Config

	// Defaults
	cfg.Server.Port = 8081
	cfg.Server.Mode = "debug"
	cfg.Database.Host = "localhost"
	cfg.Database.Port = 5432
	cfg.Database.User = "orion"
	cfg.Database.Password = "orion"
	cfg.Database.DBName = "orion_ticket"
	cfg.Database.SSLMode = "disable"
	cfg.Redis.Addr = "localhost:6379"
	cfg.Otel.Enabled = false
	cfg.Otel.Endpoint = "localhost:4318"
	cfg.Otel.ServiceName = "orion-ticket-svc"
	cfg.JWT.Secret = "orion-jwt-secret-change-me"

	// Override from env
	if v := os.Getenv("TICKET_SVC_PORT"); v != "" {
		cfg.Server.Port = 8081
		for _, c := range v {
			cfg.Server.Port = cfg.Server.Port*10 + int(c-'0')
		}
	}
	if v := os.Getenv("GIN_MODE"); v != "" {
		cfg.Server.Mode = v
	}
	if v := os.Getenv("DB_HOST"); v != "" {
		cfg.Database.Host = v
	}
	if v := os.Getenv("DB_PORT"); v != "" {
		cfg.Database.Port = 5432
		for _, c := range v {
			cfg.Database.Port = cfg.Database.Port*10 + int(c-'0')
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

	// Try loading from config file
	if data, err := os.ReadFile("config.yaml"); err == nil {
		_ = yaml.Unmarshal(data, &cfg)
	}

	return &cfg, nil
}
