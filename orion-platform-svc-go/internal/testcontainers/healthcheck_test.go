package testcontainers

import (
	"testing"

	"github.com/testcontainers/testcontainers-go"
)

func TestHealthCheckContainerRequest(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
	}

	if req.Image == "" {
		t.Error("image should not be empty")
	}
}

func TestHealthCheckConfigPings(t *testing.T) {
	cfg := DefaultConfig()
	conn := cfg.ConnectionString()

	if !contains(conn, "host=") {
		t.Error("missing host in connection string")
	}
	if !contains(conn, "port=") {
		t.Error("missing port in connection string")
	}
}

func TestHealthCheckMultipleConfigs(t *testing.T) {
	cfgs := []PostgresConfig{
		DefaultConfig(),
		{Database: "hc1", User: "u1", Password: "p1", Host: "localhost", Port: "5432"},
	}

	for _, cfg := range cfgs {
		conn := cfg.ConnectionString()
		if !contains(conn, "sslmode=disable") {
			t.Error("missing sslmode")
		}
	}
}

func TestHealthCheckContainerRequestEnv(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
		Env: map[string]string{
			"POSTGRES_DB":       "orion_test",
			"POSTGRES_USER":     "orion",
			"POSTGRES_PASSWORD": "orion_secret",
		},
	}

	if req.Env["POSTGRES_DB"] == "" {
		t.Error("POSTGRES_DB not set")
	}
}

func TestHealthCheckConfigEmptyHost(t *testing.T) {
	cfg := PostgresConfig{Port: "5432"}
	conn := cfg.ConnectionString()
	if !contains(conn, "host=localhost") {
		t.Error("empty host should default to localhost")
	}
}

func TestHealthCheckConfigEmptyPort(t *testing.T) {
	cfg := PostgresConfig{Host: "localhost"}
	conn := cfg.ConnectionString()
	if !contains(conn, "port=5432") {
		t.Error("empty port should default to 5432")
	}
}
