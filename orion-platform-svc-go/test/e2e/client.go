// Package e2e provides end-to-end test infrastructure for Orion Platform Service.
//
// E2EClient wraps net/http.Client and provides convenience methods for
// common HTTP operations against a live Orion Platform Service instance.
package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// E2EClient is an HTTP client configured for E2E testing.
type E2EClient struct {
	http    *http.Client
	baseURL string
	config  *Config
}

// NewE2EClient creates a new E2E client with the given base URL.
// Passes the testing.T so the client can skip tests when the server is unavailable.
func NewE2EClient(t interface{ Helper(); Skipf(format string, args ...any) }, baseURL string) *E2EClient {
	t.Helper()
	cfg := NewConfig()
	if baseURL != "" {
		cfg.BaseURL = baseURL
	}
	client := &E2EClient{
		baseURL: cfg.BaseURL,
		config:  cfg,
		http: &http.Client{
			Timeout: cfg.Timeout,
		},
	}
	return client
}

// NewE2EClientFromConfig creates an E2E client with explicit configuration.
func NewE2EClientFromConfig(cfg *Config) *E2EClient {
	return &E2EClient{
		baseURL: cfg.BaseURL,
		config:  cfg,
		http: &http.Client{
			Timeout: cfg.Timeout,
		},
	}
}

// Do performs an HTTP request and returns the response.
func (c *E2EClient) Do(req *http.Request) (*http.Response, error) {
	for attempt := 1; attempt <= c.config.RetryCount; attempt++ {
		resp, err := c.http.Do(req)
		if err == nil {
			return resp, nil
		}
		if attempt < c.config.RetryCount {
			time.Sleep(c.config.RetryDelay)
		}
	}
	return nil, fmt.Errorf("HTTP request failed after %d attempts", c.config.RetryCount)
}

// Get performs an HTTP GET request.
func (c *E2EClient) Get(path string, headers map[string]string) (*http.Response, error) {
	url := c.baseURL + path
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create GET request: %w", err)
	}
	c.setHeaders(req, headers)
	return c.Do(req)
}

// PostJSON performs an HTTP POST with JSON body.
func (c *E2EClient) PostJSON(path string, body any, headers map[string]string) (*http.Response, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal body: %w", err)
	}
	url := c.baseURL + path
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(data))
	if err != nil {
		return nil, fmt.Errorf("failed to create POST request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	c.setHeaders(req, headers)
	return c.Do(req)
}

// PutJSON performs an HTTP PUT with JSON body.
func (c *E2EClient) PutJSON(path string, body any, headers map[string]string) (*http.Response, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal body: %w", err)
	}
	url := c.baseURL + path
	req, err := http.NewRequest("PUT", url, bytes.NewBuffer(data))
	if err != nil {
		return nil, fmt.Errorf("failed to create PUT request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	c.setHeaders(req, headers)
	return c.Do(req)
}

// Delete performs an HTTP DELETE request.
func (c *E2EClient) Delete(path string, headers map[string]string) (*http.Response, error) {
	url := c.baseURL + path
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create DELETE request: %w", err)
	}
	c.setHeaders(req, headers)
	return c.Do(req)
}

// setHeaders applies all headers from the map to the request.
func (c *E2EClient) setHeaders(req *http.Request, headers map[string]string) {
	for key, val := range headers {
		req.Header.Set(key, val)
	}
}

// ResponseBody reads and returns the response body as bytes.
// The caller is responsible for calling resp.Body.Close().
func ResponseBody(resp *http.Response) ([]byte, error) {
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

// AssertOK checks that the response has a 2xx status code.
func AssertOK(resp *http.Response) bool {
	return resp != nil && resp.StatusCode >= 200 && resp.StatusCode < 300
}

// DefaultHeaders returns a map of common headers for authenticated requests.
func DefaultHeaders() map[string]string {
	return map[string]string{
		"Accept": "application/json",
	}
}

// AuthHeaders returns headers with an Authorization Bearer token.
func AuthHeaders(token string, tenantID string) map[string]string {
	headers := DefaultHeaders()
	headers["Authorization"] = "Bearer " + token
	if tenantID != "" {
		headers["X-Tenant-ID"] = tenantID
	}
	return headers
}

// WithAuthAndTenant wraps the context with a context value holding auth headers.
// This is a convenience helper for composing header maps.
func WithAuthAndTenant(token, tenantID string) map[string]string {
	return AuthHeaders(token, tenantID)
}

// RequestContext is a context key for embedding request metadata.
type RequestContext struct {
	TenantID string
	UserID   string
}
