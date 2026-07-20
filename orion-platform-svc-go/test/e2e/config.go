// Package e2e provides end-to-end test infrastructure for Orion Platform Service.
//
// E2E tests exercise the full HTTP stack (Gin router -> handler -> service ->
// repository -> PostgreSQL) against a live server instance. Unlike integration
// tests that call service/repository code directly, E2E tests use real HTTP
// requests through the router.
//
// Usage:
//   cd orion-platform-svc-go
//   export E2E_BASE_URL="http://localhost:8080"
//   go test ./test/e2e/... -v -run TestE2E
//
// Skip (no server available):
//   go test ./test/e2e/... -short
//
// Requirements:
//   - A running Orion Platform Service instance (E2E_BASE_URL)
//   - PostgreSQL database accessible by the server
package e2e

import (
	"fmt"
	"os"
	"time"
)

// Config holds E2E test settings, read from environment variables.
type Config struct {
	BaseURL       string        // Target server base URL (e.g., "http://localhost:8080")
	Timeout       time.Duration // HTTP request timeout
	RetryCount    int           // Number of retries for transient failures
	RetryDelay    time.Duration // Delay between retries
	DefaultTenant string        // Default tenant ID for test operations
	DefaultUser   string        // Default username for test login
	DefaultPass   string        // Default password for test login
}

// NewConfig loads E2E configuration from environment variables.
// Falls back to sensible defaults for local development.
func NewConfig() *Config {
	baseURL := os.Getenv("E2E_BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}

	// Parse timeout from env, default 30s
	var timeout time.Duration = 30 * time.Second
	if v := os.Getenv("E2E_TIMEOUT"); v != "" {
		if t, err := time.ParseDuration(v); err == nil {
			timeout = t
		}
	}

	// Parse retry settings
	retryCount := 3
	if v := os.Getenv("E2E_RETRY_COUNT"); v != "" {
		fmt.Sscanf(v, "%d", &retryCount)
	}
	retryDelay := 1 * time.Second
	if v := os.Getenv("E2E_RETRY_DELAY"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			retryDelay = d
		}
	}

	return &Config{
		BaseURL:       baseURL,
		Timeout:       timeout,
		RetryCount:    retryCount,
		RetryDelay:    retryDelay,
		DefaultTenant: os.Getenv("E2E_TENANT_ID"),
		DefaultUser:   os.Getenv("E2E_TEST_USER"),
		DefaultPass:   os.Getenv("E2E_TEST_PASS"),
	}
}
