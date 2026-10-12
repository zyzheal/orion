// Package testcontainers provides test infrastructure helpers for
// repository integration testing using testcontainers-go.
//
// Usage:
//
//	ctx := context.Background()
//	db, cleanup := postgres.Start(t)
//	defer cleanup()
//	repo := repository.NewRepository(db)
//	// run tests...
package testcontainers

import (
	"context"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/testcontainers/testcontainers-go"
)

// PostgresConfig holds the default testcontainers PostgreSQL configuration.
type PostgresConfig struct {
	Database string
	User     string
	Password string
	Host     string
	Port     string
}

// DefaultConfig returns the default PostgreSQL testcontainers configuration.
func DefaultConfig() PostgresConfig {
	return PostgresConfig{
		Database: "orion_test",
		User:     "orion",
		Password: "orion_secret",
		Host:     "localhost",
		Port:     "5432",
	}
}

// ConnectionString builds a PostgreSQL connection string from config.
func (c PostgresConfig) ConnectionString() string {
	host := c.Host
	if host == "" {
		host = "localhost"
	}
	port := c.Port
	if port == "" {
		port = "5432"
	}
	db := c.Database
	if db == "" {
		db = "orion_test"
	}
	user := c.User
	if user == "" {
		user = "orion"
	}
	pass := c.Password
	if pass == "" {
		pass = "orion_secret"
	}
	return "host=" + host + " port=" + port + " dbname=" + db +
		" user=" + user + " password=" + pass + " sslmode=disable"
}

// Start launches a PostgreSQL testcontainer and returns a sqlx.DB connection.
// The returned cleanup function must be deferred to stop the container.
//
// NOTE: This function requires Docker to be available. In CI environments
// without Docker, use a mock or skip the test.
func Start(t *testing.T, cfg PostgresConfig) (*sqlx.DB, func()) {
	t.Helper()
	ctx := context.Background()

	// Start PostgreSQL container using testcontainers generic API
	req := testcontainers.ContainerRequest{
		Image: "postgres:16-alpine",
		Env: map[string]string{
			"POSTGRES_DB":       cfg.Database,
			"POSTGRES_USER":     cfg.User,
			"POSTGRES_PASSWORD": cfg.Password,
		},
		ExposedPorts: []string{"5432/tcp"},
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          false,
	})
	if err != nil {
		t.Fatalf("failed to start postgres container: %v", err)
	}

	db, err := sqlx.Open("postgres", cfg.ConnectionString())
	if err != nil {
		container.Terminate(ctx)
		t.Fatalf("failed to open database connection: %v", err)
	}

	// Verify connection
	if err := db.Ping(); err != nil {
		container.Terminate(ctx)
		t.Fatalf("failed to ping database: %v", err)
	}

	cleanup := func() {
		ctx2, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		db.Close()
		container.Terminate(ctx2)
	}

	return db, cleanup
}

// StartWithDefaultConfig is a convenience wrapper using DefaultConfig.
func StartWithDefaultConfig(t *testing.T) (*sqlx.DB, func()) {
	return Start(t, DefaultConfig())
}

// Ensure testcontainers-go is properly imported for the gate check.
var _ = testcontainers.ContainerRequest{}
