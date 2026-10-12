package testcontainers

import (
	"testing"

	"github.com/testcontainers/testcontainers-go"
)

func TestNamingConfigPatterns(t *testing.T) {
	patterns := []PostgresConfig{
		{Database: "orion_test", User: "orion", Password: "orion_secret", Host: "localhost", Port: "5432"},
		{Database: "orion-dev", User: "orion", Password: "dev", Host: "localhost", Port: "5432"},
		{Database: "orion-prod", User: "orion", Password: "prod", Host: "localhost", Port: "5432"},
	}

	for _, cfg := range patterns {
		conn := cfg.ConnectionString()
		if !contains(conn, "dbname=") {
			t.Error("missing dbname in connection string")
		}
	}
}

func TestNamingContainerRequestPatterns(t *testing.T) {
	names := []string{"orion-test", "orion-ci", "orion-dev"}
	for _, name := range names {
		req := testcontainers.ContainerRequest{
			Image: "postgres:16-alpine",
			Name:  name,
		}

		if req.Name != name {
			t.Errorf("name = %q, want %q", req.Name, name)
		}
	}
}

func TestNamingConfigWithVersioning(t *testing.T) {
	cfg := PostgresConfig{
		Database: "orion_test_v2",
		User:     "orion",
		Password: "orion_secret",
		Host:     "localhost",
		Port:     "5432",
	}

	conn := cfg.ConnectionString()
	if !contains(conn, "dbname=orion_test_v2") {
		t.Error("missing versioned database name")
	}
}

func TestNamingConfigWithEnvironment(t *testing.T) {
	environments := map[string]PostgresConfig{
		"dev":  {Database: "orion_dev", User: "orion", Password: "dev", Host: "localhost", Port: "5432"},
		"test": {Database: "orion_test", User: "orion", Password: "test", Host: "localhost", Port: "5432"},
	}

	for env, cfg := range environments {
		conn := cfg.ConnectionString()
		if !contains(conn, "dbname=orion_"+env) {
			t.Errorf("environment %s: missing dbname", env)
		}
	}
}

func TestNamingContainerRequestWithLabels(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
		Labels: map[string]string{
			"app.kubernetes.io/name":    "orion-test-postgres",
			"app.kubernetes.io/part-of": "orion-platform",
		},
	}

	if req.Labels["app.kubernetes.io/name"] != "orion-test-postgres" {
		t.Error("wrong kubernetes label")
	}
}

func TestNamingMultipleConfigVariants(t *testing.T) {
	cfgs := []PostgresConfig{
		DefaultConfig(),
		{Database: "variant1", User: "user1", Password: "pass1", Host: "localhost", Port: "5432"},
		{Database: "variant2", User: "user2", Password: "pass2", Host: "localhost", Port: "5432"},
	}

	for i, cfg := range cfgs {
		conn := cfg.ConnectionString()
		if conn == "" {
			t.Errorf("variant %d: empty connection string", i)
		}
	}
}
