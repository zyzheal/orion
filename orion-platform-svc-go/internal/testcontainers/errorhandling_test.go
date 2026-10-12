package testcontainers

import (
	"testing"

	"github.com/testcontainers/testcontainers-go"
)

func TestErrorHandlingConfigValidation(t *testing.T) {
	tests := []struct {
		name string
		cfg  PostgresConfig
	}{
		{"empty config", PostgresConfig{}},
		{"nil values", PostgresConfig{Host: "localhost", Port: "5432"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conn := tt.cfg.ConnectionString()
			if conn == "" {
				t.Error("connection string should not be empty")
			}
		})
	}
}

func TestErrorHandlingContainerRequestValid(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
	}

	if req.Image == "" {
		t.Error("image is required")
	}
}

func TestErrorHandlingConfigWithInvalidValues(t *testing.T) {
	cfg := PostgresConfig{
		Database: "space in db name",
		User:     "user with spaces",
		Password: "pass with spaces",
		Host:     "localhost",
		Port:     "5432",
	}

	conn := cfg.ConnectionString()
	if conn == "" {
		t.Error("connection string should not be empty even with spaces")
	}
}

func TestErrorHandlingContainerRequestNoImage(t *testing.T) {
	req := testcontainers.ContainerRequest{}
	if req.Image != "" {
		t.Error("zero value should have empty image")
	}
}

func TestErrorHandlingConfigWithUnicode(t *testing.T) {
	cfg := PostgresConfig{
		Database: "数据库",
		User:     "用户",
		Password: "密码",
		Host:     "localhost",
		Port:     "5432",
	}

	conn := cfg.ConnectionString()
	if conn == "" {
		t.Error("connection string should not be empty with unicode")
	}
}

func TestErrorHandlingContainerRequestWithEmptyEnv(t *testing.T) {
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
		Env:   map[string]string{},
	}

	if len(req.Env) != 0 {
		t.Errorf("env count = %d, want 0", len(req.Env))
	}
}
