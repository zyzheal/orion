package testcontainers

import (
	"testing"

	"github.com/testcontainers/testcontainers-go"
)

func TestConnectionConfigDefaults(t *testing.T) {
	cfg := DefaultConfig()
	conn := cfg.ConnectionString()

	expected := []string{
		"host=localhost",
		"port=5432",
		"dbname=orion_test",
		"user=orion",
		"password=orion_secret",
		"sslmode=disable",
	}

	for _, exp := range expected {
		if !contains(conn, exp) {
			t.Errorf("missing %q in connection string: %s", exp, conn)
		}
	}
}

func TestConnectionConfigOverrides(t *testing.T) {
	overrides := []struct {
		name   string
		cfg    PostgresConfig
		expect string
	}{
		{"custom host", PostgresConfig{Host: "192.168.1.1"}, "host=192.168.1.1"},
		{"custom port", PostgresConfig{Port: "6543"}, "port=6543"},
		{"custom db", PostgresConfig{Database: "mydb"}, "dbname=mydb"},
	}

	for _, tt := range overrides {
		t.Run(tt.name, func(t *testing.T) {
			conn := tt.cfg.ConnectionString()
			if !contains(conn, tt.expect) {
				t.Errorf("missing %q in connection string", tt.expect)
			}
		})
	}
}

func TestConnectionContainerRequestWithPostgres(t *testing.T) {
	cfg := DefaultConfig()
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
		Env: map[string]string{
			"POSTGRES_DB":       cfg.Database,
			"POSTGRES_USER":     cfg.User,
			"POSTGRES_PASSWORD": cfg.Password,
		},
		ExposedPorts: []string{"5432/tcp"},
	}

	if req.Env["POSTGRES_DB"] != "orion_test" {
		t.Error("wrong db name in env")
	}
	if req.ExposedPorts[0] != "5432/tcp" {
		t.Error("wrong exposed port")
	}
}

func TestConnectionConfigWithLongValues(t *testing.T) {
	cfg := PostgresConfig{
		Database: "very-long-database-name-that-should-still-work",
		User:     "long-username-that-must-be-valid",
		Password: "very-long-password-that-should-still-be-included-in-connection-string",
		Host:     "localhost",
		Port:     "5432",
	}

	conn := cfg.ConnectionString()
	if len(conn) < 100 {
		t.Error("connection string too short for long values")
	}
}

func TestConnectionMultipleConfigsVerify(t *testing.T) {
	cfg1 := PostgresConfig{Database: "db1", Host: "localhost", Port: "5432"}
	cfg2 := PostgresConfig{Database: "db2", Host: "localhost", Port: "5432"}

	if cfg1.ConnectionString() == cfg2.ConnectionString() {
		t.Error("different configs should produce different connection strings")
	}
}

func TestConnectionConfigEmptyOverrides(t *testing.T) {
	cfg := PostgresConfig{}
	conn := cfg.ConnectionString()

	if !contains(conn, "host=localhost") {
		t.Error("missing default host")
	}
	if !contains(conn, "port=5432") {
		t.Error("missing default port")
	}
	if !contains(conn, "dbname=orion_test") {
		t.Error("missing default database")
	}
}
