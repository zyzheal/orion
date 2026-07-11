package config

import (
	"fmt"
	"os"


	"gopkg.in/yaml.v3"
)

type Config struct {
	Server    ServerConfig   `yaml:"server"`
	Database  DatabaseConfig `yaml:"database"`
	Redis     RedisConfig    `yaml:"redis"`
	Otel      OtelConfig     `yaml:"otel"`
	JWT       JWTConfig      `yaml:"jwt"`
	JWTSecret string
	RedisAddr string
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

func Load() (*Config, error) {
	cfg := Config{
		Server:   ServerConfig{Port: 8083, Mode: "debug"},
		Database: DatabaseConfig{Host: "localhost", Port: 5432, SSLMode: "disable"},
		Redis:    RedisConfig{Addr: "localhost:6379", DB: 0},
		Otel:     OtelConfig{Enabled: false, Endpoint: "localhost:4318", ServiceName: "orion-build-env-svc"},
	}

	// Load config file first (lower priority)
	if data, err := os.ReadFile("config.yaml"); err == nil {
		_ = yaml.Unmarshal(data, &cfg)
	}

	// Override from env vars (higher priority)
	if v := os.Getenv("GIN_MODE"); v != "" {
		cfg.Server.Mode = v
	}

	return &cfg, nil
}
