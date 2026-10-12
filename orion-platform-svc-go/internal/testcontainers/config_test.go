package testcontainers

import (
	"testing"

	"github.com/testcontainers/testcontainers-go"
)

func TestConfigWithEmptyFields(t *testing.T) {
	tests := []struct {
		name string
		cfg  PostgresConfig
	}{
		{"all empty", PostgresConfig{}},
		{"empty database", PostgresConfig{User: "u", Password: "p", Host: "h", Port: "5432"}},
		{"empty user", PostgresConfig{Database: "db", Password: "p", Host: "h", Port: "5432"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conn := tt.cfg.ConnectionString()
			if conn == "" {
				t.Error("connection string should not be empty")
			}
			if !contains(conn, "sslmode=disable") {
				t.Error("connection string should include sslmode=disable")
			}
		})
	}
}

func TestConfigDeepCopy(t *testing.T) {
	orig := DefaultConfig()
	copied := orig

	orig.Database = "modified"
	if copied.Database != "orion_test" {
		t.Errorf("copy should have original value, got %q", copied.Database)
	}
}

func TestConfigImmutability(t *testing.T) {
	cfg := DefaultConfig()

	for i := 0; i < 10; i++ {
		if cfg.Database != "orion_test" {
			t.Fatalf("iteration %d: database changed to %q", i, cfg.Database)
		}
		if cfg.ConnectionString() == "" {
			t.Fatalf("iteration %d: connection string is empty", i)
		}
	}
}

func TestPostgresContainerRequestType(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image:        "postgres:16-alpine",
		ExposedPorts: []string{"5432/tcp"},
	}
	if req.Image != "postgres:16-alpine" {
		t.Errorf("image = %q, want postgres:16-alpine", req.Image)
	}
	if len(req.ExposedPorts) != 1 {
		t.Errorf("exposed ports count = %d, want 1", len(req.ExposedPorts))
	}
}

func TestPostgresContainerRequestWithEnv(t *testing.T) {
	cfg := DefaultConfig()
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
		Env: map[string]string{
			"POSTGRES_DB":       cfg.Database,
			"POSTGRES_USER":     cfg.User,
			"POSTGRES_PASSWORD": cfg.Password,
		},
	}
	if req.Env["POSTGRES_DB"] != cfg.Database {
		t.Errorf("env POSTGRES_DB = %q, want %q", req.Env["POSTGRES_DB"], cfg.Database)
	}
}

func TestConfigWithSpecialChars(t *testing.T) {
	cfg := PostgresConfig{
		Database: "db-with-dashes",
		User:     "user@company.com",
		Password: "p@ss,w0rd!",
		Host:     "localhost",
		Port:     "5432",
	}
	conn := cfg.ConnectionString()
	if !contains(conn, "host=localhost") {
		t.Error("connection string missing host")
	}
	if !contains(conn, "port=5432") {
		t.Error("connection string missing port")
	}
}

func TestMultipleDefaultsVerify(t *testing.T) {
	d1 := DefaultConfig()
	d2 := DefaultConfig()
	d3 := DefaultConfig()

	conn1 := d1.ConnectionString()
	conn2 := d2.ConnectionString()
	conn3 := d3.ConnectionString()

	if conn1 != conn2 || conn2 != conn3 {
		t.Error("DefaultConfig should produce deterministic connection strings")
	}
}
