package config

import (
	"fmt"
	"log"
	"strings"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

// ServerConfig Server configuration
type ServerConfig struct {
	Addr string `mapstructure:"addr"`
}

// DatabaseConfig Database configuration
type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	Name     string `mapstructure:"name"`
	SSLMode  string `mapstructure:"sslmode"`
}

// RedisConfig Redis configuration
type RedisConfig struct {
	Addr     string `mapstructure:"addr"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

// GRPCConfig gRPC configuration
type GRPCConfig struct {
	Addr string `mapstructure:"addr"`
}

// Config Application configuration
type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	Redis    RedisConfig    `mapstructure:"redis"`
	GRPC     GRPCConfig     `mapstructure:"grpc"`
}

// Load loads configuration from config.yaml and .env files
func Load(configPath string) (*Config, error) {
	// Load .env file if exists
	_ = godotenv.Load()

	// Set default config file
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")

	// Add config path
	if configPath != "" {
		viper.AddConfigPath(configPath)
	}
	viper.AddConfigPath(".")

	// Environment variable replacement
	viper.SetEnvPrefix("ORION")
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// Set default values
	viper.SetDefault("server.addr", ":8082")
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.user", "orion")
	viper.SetDefault("database.password", "orion")
	viper.SetDefault("database.name", "orion_ops")
	viper.SetDefault("database.sslmode", "disable")
	viper.SetDefault("redis.addr", "localhost:6379")
	viper.SetDefault("redis.db", 1)
	viper.SetDefault("grpc.addr", ":9092")

	// Read config
	if err := viper.ReadInConfig(); err != nil {
		log.Printf("Warning: config file not found, using environment variables: %v", err)
	}

	// Unmarshal config
	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &cfg, nil
}

// GetDSN returns PostgreSQL connection string
func (c *DatabaseConfig) GetDSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.Name, c.SSLMode,
	)
}