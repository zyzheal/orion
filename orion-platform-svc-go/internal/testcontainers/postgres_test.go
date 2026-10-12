package testcontainers

import (
	"testing"

	"github.com/testcontainers/testcontainers-go"
)

// TestDefaultConfig verifies the default configuration is valid.
func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()
	if cfg.Database != "orion_test" {
		t.Errorf("default database = %q, want orion_test", cfg.Database)
	}
	if cfg.User != "orion" {
		t.Errorf("default user = %q, want orion", cfg.User)
	}
	if cfg.Password != "orion_secret" {
		t.Errorf("default password = %q, want orion_secret", cfg.Password)
	}
	if cfg.Host != "localhost" {
		t.Errorf("default host = %q, want localhost", cfg.Host)
	}
	if cfg.Port != "5432" {
		t.Errorf("default port = %q, want 5432", cfg.Port)
	}
}

// TestConnectionString verifies connection string generation.
func TestConnectionString(t *testing.T) {
	cfg := DefaultConfig()
	conn := cfg.ConnectionString()

	if conn == "" {
		t.Fatal("connection string should not be empty")
	}
	if !contains(conn, "host=localhost") {
		t.Errorf("connection string missing host: %s", conn)
	}
	if !contains(conn, "port=5432") {
		t.Errorf("connection string missing port: %s", conn)
	}
	if !contains(conn, "dbname=orion_test") {
		t.Errorf("connection string missing dbname: %s", conn)
	}
}

// TestCustomConnectionString verifies custom config overrides defaults.
func TestCustomConnectionString(t *testing.T) {
	cfg := PostgresConfig{
		Database: "custom_db",
		User:     "custom_user",
		Password: "custom_pass",
		Host:     "127.0.0.1",
		Port:     "5433",
	}
	conn := cfg.ConnectionString()

	if !contains(conn, "host=127.0.0.1") {
		t.Errorf("connection string missing custom host: %s", conn)
	}
	if !contains(conn, "port=5433") {
		t.Errorf("connection string missing custom port: %s", conn)
	}
	if !contains(conn, "dbname=custom_db") {
		t.Errorf("connection string missing custom dbname: %s", conn)
	}
}

// TestEmptyConfigDefaults verifies empty config uses defaults.
func TestEmptyConfigDefaults(t *testing.T) {
	cfg := PostgresConfig{}
	conn := cfg.ConnectionString()

	if !contains(conn, "host=localhost") {
		t.Errorf("empty config should default to localhost: %s", conn)
	}
	if !contains(conn, "port=5432") {
		t.Errorf("empty config should default to 5432: %s", conn)
	}
	if !contains(conn, "dbname=orion_test") {
		t.Errorf("empty config should default to orion_test: %s", conn)
	}
}

// TestContainerRequestType ensures the testcontainers-go dependency is linked.
func TestContainerRequestType(t *testing.T) {
	var req testcontainers.ContainerRequest
	if req.Image == "" {
		t.Log("ContainerRequest zero value is valid")
	}
}

// TestMultipleConfigurations ensures we can create multiple configs.
func TestMultipleConfigurations(t *testing.T) {
	cfgs := []PostgresConfig{
		DefaultConfig(),
		{Database: "db2", User: "user2", Password: "pass2", Host: "localhost", Port: "5432"},
		{Database: "db3", User: "user3", Password: "pass3", Host: "localhost", Port: "5432"},
	}

	if len(cfgs) != 3 {
		t.Fatalf("expected 3 configs, got %d", len(cfgs))
	}
	for i, cfg := range cfgs {
		if cfg.Database == "" {
			t.Errorf("config[%d] has empty database", i)
		}
		if cfg.ConnectionString() == "" {
			t.Errorf("config[%d] has empty connection string", i)
		}
	}
}

// TestConfigEquality verifies config fields are compared correctly.
func TestConfigEquality(t *testing.T) {
	cfg1 := DefaultConfig()
	cfg2 := DefaultConfig()

	if cfg1.Database != cfg2.Database {
		t.Error("two default configs should have same database")
	}
	if cfg1.User != cfg2.User {
		t.Error("two default configs should have same user")
	}
	if cfg1.Password != cfg2.Password {
		t.Error("two default configs should have same password")
	}
}

// TestConnectionStringWithSSL verifies SSL mode is included.
func TestConnectionStringWithSSL(t *testing.T) {
	cfg := DefaultConfig()
	conn := cfg.ConnectionString()

	if !contains(conn, "sslmode=disable") {
		t.Errorf("connection string should include sslmode=disable: %s", conn)
	}
}

// TestCustomHostAndPort verifies custom host and port are used.
func TestCustomHostAndPort(t *testing.T) {
	cfg := PostgresConfig{
		Host: "192.168.1.100",
		Port: "6543",
	}
	conn := cfg.ConnectionString()

	if !contains(conn, "host=192.168.1.100") {
		t.Errorf("connection string missing custom host: %s", conn)
	}
	if !contains(conn, "port=6543") {
		t.Errorf("connection string missing custom port: %s", conn)
	}
}

// contains is a helper for string containment checks.
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsString(s, substr))
}

func containsString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
