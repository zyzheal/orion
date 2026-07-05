package config

import (
	"github.com/spf13/viper"
)

type Config struct {
	ServerPort int    `mapstructure:"server_port"`
	ServerHost string `mapstructure:"server_host"`
	APIPrefix  string `mapstructure:"api_prefix"`
	DBHost     string `mapstructure:"db_host"`
	DBPort     int    `mapstructure:"db_port"`
	DBUser     string `mapstructure:"db_user"`
	DBPassword string `mapstructure:"db_password"`
	DBName     string `mapstructure:"db_name"`
	DBSSLMode  string `mapstructure:"db_ssl_mode"`
	JWTSecret  string
	RedisAddr  string
}

func Load() (*Config, error) {
	viper.SetDefault("server_port", 8086)
	viper.SetDefault("server_host", "0.0.0.0")
	viper.SetDefault("api_prefix", "/api/v1")
	viper.SetDefault("db_host", "localhost")
	viper.SetDefault("db_port", 5432)
	viper.SetDefault("db_user", "postgres")
	viper.SetDefault("db_password", "postgres")
	viper.SetDefault("db_name", "orion_canary")
	viper.SetDefault("db_ssl_mode", "disable")

	viper.AutomaticEnv()

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}
