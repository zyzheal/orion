package testcontainers

import (
	"testing"

	"github.com/testcontainers/testcontainers-go"
)

func TestIntegrationContainerRequest(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
		Env: map[string]string{
			"POSTGRES_DB":       "orion_test",
			"POSTGRES_USER":     "orion",
			"POSTGRES_PASSWORD": "orion_secret",
		},
		ExposedPorts: []string{"5432/tcp"},
		Labels: map[string]string{
			"com.github.testcontainers.labels.orion": "true",
		},
	}

	if req.Image != "postgres:16-alpine" {
		t.Error("wrong image")
	}
	if len(req.Env) != 3 {
		t.Errorf("env count = %d", len(req.Env))
	}
}

func TestIntegrationMultiContainerConfig(t *testing.T) {
	configs := []PostgresConfig{
		DefaultConfig(),
		{Database: "test1", User: "user1", Password: "pass1", Host: "localhost", Port: "5432"},
		{Database: "test2", User: "user2", Password: "pass2", Host: "localhost", Port: "5432"},
	}

	for i, cfg := range configs {
		conn := cfg.ConnectionString()
		if conn == "" {
			t.Errorf("config %d: empty connection string", i)
		}
		if !contains(conn, "sslmode=disable") {
			t.Errorf("config %d: missing sslmode", i)
		}
	}
}

func TestIntegrationContainerRequestWithNetwork(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image:    "postgres:16-alpine",
		Networks: []string{"orion-net"},
		Hostname: "postgres",
	}

	if len(req.Networks) != 1 {
		t.Errorf("networks count = %d", len(req.Networks))
	}
}

func TestIntegrationConfigCombination(t *testing.T) {
	cfg := PostgresConfig{
		Database: "combo-db",
		User:     "combo-user",
		Password: "combo-pass",
		Host:     "db.internal",
		Port:     "5433",
	}

	conn := cfg.ConnectionString()
	if !contains(conn, "host=db.internal") {
		t.Error("missing custom host")
	}
	if !contains(conn, "port=5433") {
		t.Error("missing custom port")
	}
}

func TestIntegrationMultipleConfigurations(t *testing.T) {
	configs := make([]PostgresConfig, 5)
	for i := range configs {
		configs[i] = PostgresConfig{
			Database: "db",
			User:     "user",
			Password: "pass",
			Host:     "localhost",
			Port:     "5432",
		}
	}

	for i, cfg := range configs {
		conn := cfg.ConnectionString()
		if !contains(conn, "host=localhost") {
			t.Errorf("config %d: missing localhost", i)
		}
	}
}

func TestIntegrationContainerRequestEnvValues(t *testing.T) {
	cfg := DefaultConfig()
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
		Env: map[string]string{
			"POSTGRES_DB":       cfg.Database,
			"POSTGRES_USER":     cfg.User,
			"POSTGRES_PASSWORD": cfg.Password,
		},
	}

	for k, v := range req.Env {
		if v == "" {
			t.Errorf("env %q has empty value", k)
		}
	}
}
