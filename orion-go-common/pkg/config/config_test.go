package config

import (
	"os"
	"testing"
	"time"
)

func TestDefaultBaseConfig(t *testing.T) {
	cfg := DefaultBaseConfig("test-svc")
	if cfg.ServiceName != "test-svc" {
		t.Errorf("expected service name 'test-svc', got %q", cfg.ServiceName)
	}
	if cfg.Environment != "development" {
		t.Errorf("expected environment 'development', got %q", cfg.Environment)
	}
	if cfg.HTTPAddr != ":8080" {
		t.Errorf("expected HTTPAddr ':8080', got %q", cfg.HTTPAddr)
	}
	if cfg.RedisAddr != "localhost:6379" {
		t.Errorf("expected RedisAddr 'localhost:6379', got %q", cfg.RedisAddr)
	}
	if cfg.LogLevel != "info" {
		t.Errorf("expected LogLevel 'info', got %q", cfg.LogLevel)
	}
}

func TestLoadBaseConfig_EnvOverrides(t *testing.T) {
	os.Setenv("SERVICE_NAME", "my-svc")
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("HTTP_ADDR", ":9090")
	os.Setenv("DATABASE_URL", "postgres://user:pass@host/db")
	os.Setenv("REDIS_ADDR", "redis:6379")
	os.Setenv("LOG_LEVEL", "debug")
	defer func() {
		os.Unsetenv("SERVICE_NAME")
		os.Unsetenv("ENVIRONMENT")
		os.Unsetenv("HTTP_ADDR")
		os.Unsetenv("DATABASE_URL")
		os.Unsetenv("REDIS_ADDR")
		os.Unsetenv("LOG_LEVEL")
	}()

	cfg := LoadBaseConfig("default-svc")
	if cfg.ServiceName != "my-svc" {
		t.Errorf("expected 'my-svc', got %q", cfg.ServiceName)
	}
	if cfg.Environment != "production" {
		t.Errorf("expected 'production', got %q", cfg.Environment)
	}
	if cfg.HTTPAddr != ":9090" {
		t.Errorf("expected ':9090', got %q", cfg.HTTPAddr)
	}
	if cfg.DatabaseURL != "postgres://user:pass@host/db" {
		t.Errorf("expected DB URL, got %q", cfg.DatabaseURL)
	}
	if cfg.RedisAddr != "redis:6379" {
		t.Errorf("expected 'redis:6379', got %q", cfg.RedisAddr)
	}
	if cfg.LogLevel != "debug" {
		t.Errorf("expected 'debug', got %q", cfg.LogLevel)
	}
}

func TestDatabaseConfig_DSN(t *testing.T) {
	cfg := DatabaseConfig{
		Host:     "localhost",
		Port:     5432,
		User:     "orion",
		Password: "secret",
		DBName:   "orion_db",
		SSLMode:  "disable",
	}
	expected := "host=localhost port=5432 user=orion password=secret dbname=orion_db sslmode=disable"
	if cfg.DSN() != expected {
		t.Errorf("DSN mismatch: got %q", cfg.DSN())
	}
}

func TestDatabaseConfig_Validate(t *testing.T) {
	// Missing user
	cfg := DatabaseConfig{Password: "pass", DBName: "db"}
	if err := cfg.Validate(); err == nil {
		t.Error("expected error for missing user")
	}

	// Missing password
	cfg = DatabaseConfig{User: "user", DBName: "db"}
	if err := cfg.Validate(); err == nil {
		t.Error("expected error for missing password")
	}

	// Missing dbname
	cfg = DatabaseConfig{User: "user", Password: "pass"}
	if err := cfg.Validate(); err == nil {
		t.Error("expected error for missing dbname")
	}

	// Valid
	cfg = DatabaseConfig{User: "user", Password: "pass", DBName: "db"}
	if err := cfg.Validate(); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadDatabaseConfig_EnvOverrides(t *testing.T) {
	os.Setenv("DB_HOST", "db-host")
	os.Setenv("DB_PORT", "5433")
	os.Setenv("DB_USER", "dbuser")
	os.Setenv("DB_PASSWORD", "dbpass")
	os.Setenv("DB_NAME", "mydb")
	os.Setenv("DB_SSLMODE", "require")
	defer func() {
		os.Unsetenv("DB_HOST")
		os.Unsetenv("DB_PORT")
		os.Unsetenv("DB_USER")
		os.Unsetenv("DB_PASSWORD")
		os.Unsetenv("DB_NAME")
		os.Unsetenv("DB_SSLMODE")
	}()

	cfg := LoadDatabaseConfig()
	if cfg.Host != "db-host" {
		t.Errorf("expected 'db-host', got %q", cfg.Host)
	}
	if cfg.Port != 5433 {
		t.Errorf("expected 5433, got %d", cfg.Port)
	}
	if cfg.User != "dbuser" {
		t.Errorf("expected 'dbuser', got %q", cfg.User)
	}
	if cfg.Password != "dbpass" {
		t.Errorf("expected 'dbpass', got %q", cfg.Password)
	}
	if cfg.DBName != "mydb" {
		t.Errorf("expected 'mydb', got %q", cfg.DBName)
	}
	if cfg.SSLMode != "require" {
		t.Errorf("expected 'require', got %q", cfg.SSLMode)
	}
}

func TestLoadRedisConfig(t *testing.T) {
	os.Setenv("REDIS_ADDR", "redis-host:6380")
	os.Setenv("REDIS_PASSWORD", "redispass")
	os.Setenv("REDIS_DB", "3")
	defer func() {
		os.Unsetenv("REDIS_ADDR")
		os.Unsetenv("REDIS_PASSWORD")
		os.Unsetenv("REDIS_DB")
	}()

	cfg := LoadRedisConfig()
	if cfg.Addr != "redis-host:6380" {
		t.Errorf("expected 'redis-host:6380', got %q", cfg.Addr)
	}
	if cfg.Password != "redispass" {
		t.Errorf("expected 'redispass', got %q", cfg.Password)
	}
	if cfg.DB != 3 {
		t.Errorf("expected 3, got %d", cfg.DB)
	}
}

func TestLoadJWTConfig(t *testing.T) {
	os.Setenv("JWT_SECRET", "my-secret")
	os.Setenv("JWT_EXPIRATION", "10m")
	os.Setenv("JWT_REFRESH_EXPIRATION", "24h")
	defer func() {
		os.Unsetenv("JWT_SECRET")
		os.Unsetenv("JWT_EXPIRATION")
		os.Unsetenv("JWT_REFRESH_EXPIRATION")
	}()

	cfg := LoadJWTConfig()
	if cfg.Secret != "my-secret" {
		t.Errorf("expected 'my-secret', got %q", cfg.Secret)
	}
	if cfg.Expiration != 10*time.Minute {
		t.Errorf("expected 10m, got %v", cfg.Expiration)
	}
	if cfg.RefreshExpiration != 24*time.Hour {
		t.Errorf("expected 24h, got %v", cfg.RefreshExpiration)
	}
}

func TestGetenv(t *testing.T) {
	os.Setenv("TEST_KEY", "test-value")
	defer os.Unsetenv("TEST_KEY")

	if v := Getenv("TEST_KEY", "fallback"); v != "test-value" {
		t.Errorf("expected 'test-value', got %q", v)
	}
	if v := Getenv("NONEXISTENT_KEY", "fallback"); v != "fallback" {
		t.Errorf("expected 'fallback', got %q", v)
	}
}

func TestGetenvInt(t *testing.T) {
	os.Setenv("TEST_INT", "42")
	defer os.Unsetenv("TEST_INT")

	if v := GetenvInt("TEST_INT", 0); v != 42 {
		t.Errorf("expected 42, got %d", v)
	}
	if v := GetenvInt("NONEXISTENT_INT", 99); v != 99 {
		t.Errorf("expected 99, got %d", v)
	}
	// Invalid int should return fallback
	os.Setenv("TEST_INT_BAD", "not-a-number")
	defer os.Unsetenv("TEST_INT_BAD")
	if v := GetenvInt("TEST_INT_BAD", 7); v != 7 {
		t.Errorf("expected 7, got %d", v)
	}
}

func TestGetenvBool(t *testing.T) {
	os.Setenv("TEST_BOOL", "true")
	defer os.Unsetenv("TEST_BOOL")

	if v := GetenvBool("TEST_BOOL", false); v != true {
		t.Errorf("expected true, got %v", v)
	}
	if v := GetenvBool("NONEXISTENT_BOOL", false); v != false {
		t.Errorf("expected false, got %v", v)
	}
}

func TestGetenvDuration(t *testing.T) {
	os.Setenv("TEST_DUR", "5m")
	defer os.Unsetenv("TEST_DUR")

	if v := GetenvDuration("TEST_DUR", time.Second); v != 5*time.Minute {
		t.Errorf("expected 5m, got %v", v)
	}
	if v := GetenvDuration("NONEXISTENT_DUR", time.Second); v != time.Second {
		t.Errorf("expected 1s, got %v", v)
	}
}

func TestGetenvSlice(t *testing.T) {
	os.Setenv("TEST_SLICE", "a,b,c")
	defer os.Unsetenv("TEST_SLICE")

	result := GetenvSlice("TEST_SLICE", nil)
	if len(result) != 3 || result[0] != "a" || result[1] != "b" || result[2] != "c" {
		t.Errorf("expected [a,b,c], got %v", result)
	}

	result = GetenvSlice("NONEXISTENT_SLICE", []string{"default"})
	if len(result) != 1 || result[0] != "default" {
		t.Errorf("expected [default], got %v", result)
	}
}
