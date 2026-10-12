package testcontainers

import (
	"testing"

	"github.com/testcontainers/testcontainers-go"
)

func TestOptionsContainerRequestMinimal(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
	}

	if req.Image != "postgres:16-alpine" {
		t.Errorf("image = %q", req.Image)
	}
}

func TestOptionsContainerRequestWithEnv(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
		Env: map[string]string{
			"KEY1": "value1",
			"KEY2": "value2",
		},
	}

	if len(req.Env) != 2 {
		t.Errorf("env count = %d", len(req.Env))
	}
}

func TestOptionsConfigWithAllFields(t *testing.T) {
	cfg := PostgresConfig{
		Database: "testdb",
		User:     "testuser",
		Password: "testpass",
		Host:     "testhost",
		Port:     "5432",
	}

	if cfg.Database == "" {
		t.Error("database not set")
	}
}

func TestOptionsConfigPartialFields(t *testing.T) {
	cfg := PostgresConfig{
		Database: "testdb",
		Host:     "localhost",
	}

	conn := cfg.ConnectionString()
	if !contains(conn, "dbname=testdb") {
		t.Error("missing database in connection string")
	}
}

func TestOptionsContainerRequestWithLabels(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
		Labels: map[string]string{
			"team":    "platform",
			"service": "orion",
		},
	}

	if req.Labels["team"] != "platform" {
		t.Error("wrong team label")
	}
}

func TestOptionsMultipleConfigs(t *testing.T) {
	cfg1 := PostgresConfig{Database: "db1", User: "u1", Password: "p1", Host: "h1", Port: "5432"}
	cfg2 := PostgresConfig{Database: "db2", User: "u2", Password: "p2", Host: "h2", Port: "5432"}

	if cfg1.Database == cfg2.Database {
		t.Error("configs should have different databases")
	}
}

func TestOptionsContainerRequestWithName(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
		Name:  "orion-test-postgres",
	}

	if req.Name != "orion-test-postgres" {
		t.Errorf("name = %q", req.Name)
	}
}
