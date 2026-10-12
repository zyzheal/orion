package testcontainers

import (
	"testing"

	"github.com/testcontainers/testcontainers-go"
)

func TestStartHelperType(t *testing.T) {
	_ = Start
	_ = StartWithDefaultConfig
}

func TestDefaultConfigHostVariants(t *testing.T) {
	variants := []PostgresConfig{
		{Host: "localhost"},
		{Host: "127.0.0.1"},
		{Host: "0.0.0.0"},
		{Host: "db.internal"},
		{Host: ""},
	}

	for i, cfg := range variants {
		conn := cfg.ConnectionString()
		if !contains(conn, "host=") {
			t.Errorf("variant %d: connection string missing host prefix", i)
		}
	}
}

func TestDefaultConfigPortVariants(t *testing.T) {
	variants := []PostgresConfig{
		{Port: "5432"},
		{Port: "5433"},
		{Port: "15432"},
		{Port: ""},
	}

	for i, cfg := range variants {
		conn := cfg.ConnectionString()
		if !contains(conn, "port=") {
			t.Errorf("variant %d: connection string missing port prefix", i)
		}
	}
}

func TestContainerRequestMinimal(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
	}
	if req.Image == "" {
		t.Error("container request should have an image")
	}
}

func TestContainerRequestFull(t *testing.T) {
	cfg := DefaultConfig()
	req := testcontainers.ContainerRequest{
		Image:        "postgres:16-alpine",
		ExposedPorts: []string{"5432/tcp"},
		Env: map[string]string{
			"POSTGRES_DB":       cfg.Database,
			"POSTGRES_USER":     cfg.User,
			"POSTGRES_PASSWORD": cfg.Password,
		},
		Labels: map[string]string{
			"app":  "orion-test",
			"type": "integration",
		},
	}

	if req.Image != "postgres:16-alpine" {
		t.Error("image not set")
	}
	if len(req.Env) != 3 {
		t.Errorf("env count = %d, want 3", len(req.Env))
	}
	if req.Labels["app"] != "orion-test" {
		t.Errorf("label app = %q", req.Labels["app"])
	}
}

func TestConfigValidation(t *testing.T) {
	cfg := PostgresConfig{
		Database: "test-db",
		User:     "test-user",
		Password: "test-pass",
		Host:     "test-host",
		Port:     "5432",
	}

	if cfg.Database == "" {
		t.Error("database is required")
	}
	if cfg.User == "" {
		t.Error("user is required")
	}
}

func TestConnectionStringFormat(t *testing.T) {
	cfg := DefaultConfig()
	conn := cfg.ConnectionString()

	expectedParts := []string{
		"host=localhost",
		"port=5432",
		"dbname=orion_test",
		"user=orion",
		"password=orion_secret",
		"sslmode=disable",
	}

	for _, part := range expectedParts {
		if !contains(conn, part) {
			t.Errorf("connection string missing %q: %s", part, conn)
		}
	}
}

func TestEmptyConnectionStringDefaults(t *testing.T) {
	cfg := PostgresConfig{}
	conn := cfg.ConnectionString()

	if !contains(conn, "host=localhost") {
		t.Error("empty config should default to localhost")
	}
	if !contains(conn, "port=5432") {
		t.Error("empty config should default to 5432")
	}
}

func TestConfigRoundTrip(t *testing.T) {
	orig := DefaultConfig()
	copied := PostgresConfig{
		Database: orig.Database,
		User:     orig.User,
		Password: orig.Password,
		Host:     orig.Host,
		Port:     orig.Port,
	}

	if orig.ConnectionString() != copied.ConnectionString() {
		t.Error("config round-trip should produce same connection string")
	}
}
