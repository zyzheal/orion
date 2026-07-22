// Package integration provides shared infrastructure for integration tests
// against a real PostgreSQL instance. All tests are designed to run against a
// Docker Compose or local PostgreSQL deployment.
//
// Usage:
//   cd orion-platform-svc-go
//   export ORION_TEST_DSN="postgres://user:pass@localhost:5432/orion_test?sslmode=disable"
//   go test ./test/integration/... -v -run TestAuth
//
// Requirements:
//   - A PostgreSQL instance reachable via ORION_TEST_DSN
//   - Schema must be migrated (see migrations/run.sh)
//   - Tables tested: users, refresh_tokens, pipelines, tenant_users
//
// Short mode:
//   Use `testing.Short()` to skip tests when no DB is available:
//     go test ./test/integration/... -short
//   Tests gracefully skip when ORION_TEST_DSN is empty or DB is unreachable.
package integration

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// DefaultConfigPath resolves the path to go-common's default test config.
func DefaultConfigPath() string {
	wd, _ := os.Getwd()
	for i := 0; i < 10; i++ {
		p := filepath.Join(wd, "go.mod")
		if _, err := os.Stat(p); err == nil {
			break
		}
		wd = filepath.Dir(wd)
	}
	return fmt.Sprintf("%s/go-common/pkg/database", wd)
}

// Config is the shared integration test configuration.
type Config struct {
	DSN             string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ConnMaxIdleTime time.Duration
}

// NewConfig loads the integration test database DSN from environment.
// If ORION_TEST_DSN is empty, it falls back to DATABASE_URL for compatibility
// with GitHub Actions / docker-compose workflows.
func NewConfig() *Config {
	dsn := os.Getenv("ORION_TEST_DSN")
	if dsn == "" {
		dsn = os.Getenv("DATABASE_URL")
	}
	return &Config{
		DSN:             dsn,
		MaxOpenConns:    5,
		MaxIdleConns:    2,
		ConnMaxLifetime: 3 * time.Minute,
		ConnMaxIdleTime: 1 * time.Minute,
	}
}
