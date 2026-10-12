package testcontainers

import (
	"testing"

	"github.com/testcontainers/testcontainers-go"
)

func TestSecurityConfigPassword(t *testing.T) {
	cfg := DefaultConfig()
	conn := cfg.ConnectionString()

	if !contains(conn, "password=orion_secret") {
		t.Error("password not in connection string")
	}
}

func TestSecurityConfigSSLModes(t *testing.T) {
	cfg := DefaultConfig()
	conn := cfg.ConnectionString()

	if !contains(conn, "sslmode=disable") {
		t.Error("sslmode should be disable")
	}
}

func TestSecurityContainerRequestWithEnvSecrets(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
		Env: map[string]string{
			"POSTGRES_DB":       "orion_test",
			"POSTGRES_USER":     "orion",
			"POSTGRES_PASSWORD": "orion_secret",
		},
	}

	if req.Env["POSTGRES_PASSWORD"] == "" {
		t.Error("password not set in env")
	}
}

func TestSecurityConfigCustomPassword(t *testing.T) {
	cfg := PostgresConfig{
		Database: "secure_db",
		User:     "admin",
		Password: "s3cur3P@ssw0rd!",
		Host:     "localhost",
		Port:     "5432",
	}

	conn := cfg.ConnectionString()
	if !contains(conn, "password=s3cur3P@ssw0rd!") {
		t.Error("custom password not in connection string")
	}
}

func TestSecurityConfigEmptyPasswordDefaults(t *testing.T) {
	cfg := PostgresConfig{Host: "localhost"}
	conn := cfg.ConnectionString()

	if !contains(conn, "password=orion_secret") {
		t.Error("empty password should default to orion_secret")
	}
}

func TestSecurityConfigUserDefaults(t *testing.T) {
	cfg := PostgresConfig{Host: "localhost"}
	conn := cfg.ConnectionString()

	if !contains(conn, "user=orion") {
		t.Error("empty user should default to orion")
	}
}

func TestSecurityConfigDatabaseDefaults(t *testing.T) {
	cfg := PostgresConfig{Host: "localhost"}
	conn := cfg.ConnectionString()

	if !contains(conn, "dbname=orion_test") {
		t.Error("empty database should default to orion_test")
	}
}
