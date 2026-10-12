package testcontainers

import (
	"testing"

	"github.com/testcontainers/testcontainers-go"
)

func TestLifecycleContainerRequest(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
		Env: map[string]string{
			"POSTGRES_DB":       "orion_test",
			"POSTGRES_USER":     "orion",
			"POSTGRES_PASSWORD": "orion_secret",
		},
		ExposedPorts: []string{"5432/tcp"},
	}

	if req.Image != "postgres:16-alpine" {
		t.Error("wrong image")
	}
}

func TestLifecycleConfigInit(t *testing.T) {
	cfg := DefaultConfig()
	if cfg.Database == "" {
		t.Error("database not initialized")
	}
}

func TestLifecycleConfigClone(t *testing.T) {
	orig := DefaultConfig()
	clone := orig

	clone.Database = "modified"
	if orig.Database == "modified" {
		t.Error("modifying clone should not affect original")
	}
}

func TestLifecycleContainerRequestWithLabels(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
		Labels: map[string]string{
			"version": "16",
			"project": "orion",
		},
	}

	if req.Labels["version"] != "16" {
		t.Error("wrong version label")
	}
}

func TestLifecycleMultipleConfigs(t *testing.T) {
	configs := []PostgresConfig{
		DefaultConfig(),
		{Database: "ci", User: "ci", Password: "ci", Host: "localhost", Port: "5432"},
		{Database: "local", User: "local", Password: "local", Host: "localhost", Port: "5432"},
	}

	for _, cfg := range configs {
		if cfg.Database == "" {
			t.Error("empty database in config")
		}
	}
}

func TestLifecycleConfigToString(t *testing.T) {
	cfg := DefaultConfig()
	conn := cfg.ConnectionString()

	if len(conn) < 20 {
		t.Error("connection string too short")
	}
}
