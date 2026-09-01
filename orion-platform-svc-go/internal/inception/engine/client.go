// Package engine implements the HTTP client for the Inception SQL-audit
// service. Inception exposes /check and /execute over plain JSON; the
// client here handles request shaping, timeout, and response parsing.
//
// Design notes:
//   - All methods are ctx-aware; callers drive cancellation.
//   - The client is safe for concurrent use — it owns no mutable state
//     beyond the injected http.Client and base URL.
//   - Errors are returned as *APIError so callers can inspect status/
//     code without parsing the message string.
package engine

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// DefaultTimeout is applied when the caller does not override via Config.
// Long SQL audits can legitimately take tens of seconds; 60s is generous
// but bounded so a wedged Inception cannot hang the caller forever.
const DefaultTimeout = 60 * time.Second

// Config holds the connection parameters for the Inception server.
type Config struct {
	BaseURL    string // e.g. "http://inception.internal:6669"
	APIKey     string // optional; sent as X-API-Key header when non-empty
	Timeout    time.Duration
	HTTPClient *http.Client // optional; caller-supplied for testing
}

// APIError is returned for any non-2xx response. The body is captured for
// post-mortem so operators can debug without enabling verbose logging.
type APIError struct {
	Method     string
	Path       string
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("inception api %s %s: status=%d, body=%s", e.Method, e.Path, e.StatusCode, truncate(e.Body, 500))
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

// Client is a thin wrapper over net/http that speaks the Inception JSON
// API. All exported methods are ctx-aware and return *APIError for any
// non-2xx response.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	timeout    time.Duration
}

// New creates a Client. An empty BaseURL is treated as a configuration
// error at call time — we do not panic in the constructor so tests can
// build zero-value clients before wiring.
func New(cfg Config) *Client {
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: timeout}
	}
	return &Client{
		baseURL:    strings.TrimRight(cfg.BaseURL, "/"),
		apiKey:     cfg.APIKey,
		httpClient: httpClient,
		timeout:    timeout,
	}
}

// TaskRequest is the payload for the /check and /execute endpoints. Both
// share the same shape; CheckSQL and ExecuteSQL differ only in the URL.
type TaskRequest struct {
	// TaskName uniquely identifies the audit run on the Inception side.
	TaskName string `json:"task_name"`
	// JobName is a human-readable label; empty defaults to TaskName.
	JobName string `json:"job_name,omitempty"`
	// DBName is the schema to run against. Empty means "use the task's
	// configured default database".
	DBName string `json:"database,omitempty"`
	// SQLStatement is the SQL to be checked or executed.
	SQLStatement string `json:"sql"`
	// DryRun, when true, requests an audit-only pass (no writes).
	DryRun bool `json:"dry_run"`
}

// Result is the response envelope returned by Inception's /check and
// /execute endpoints.
type Result struct {
	Success      bool              `json:"success"`
	Message      string            `json:"message,omitempty"`
	AffectedRows int               `json:"affected_rows,omitempty"`
	Errors       []string          `json:"errors,omitempty"`
	Warnings     []string          `json:"warnings,omitempty"`
	DurationMS   int64             `json:"duration_ms,omitempty"`
	Raw          json.RawMessage   `json:"-"`
}

// ParseResultResponse decodes a raw JSON body into a Result.
func ParseResultResponse(body []byte) (*Result, error) {
	var r Result
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("inception result decode: %w", err)
	}
	r.Raw = append(json.RawMessage(nil), body...)
	return &r, nil
}

// CheckSQL submits a SQL statement for audit (dry run by default).
// It does not write to the target database; the caller decides whether to
// follow up with ExecuteSQL based on the returned Errors/Warnings.
func (c *Client) CheckSQL(ctx context.Context, req TaskRequest) (*Result, error) {
	return c.call(ctx, "/check", req)
}

// ExecuteSQL submits a SQL statement for real execution against the
// configured database. Callers should only invoke this after CheckSQL has
// returned success with no fatal errors.
func (c *Client) ExecuteSQL(ctx context.Context, req TaskRequest) (*Result, error) {
	return c.call(ctx, "/execute", req)
}

// Health returns "ok" if the Inception server responds, or an error
// otherwise. The /health endpoint is used by operators to detect a downed
// audit service before submitting work.
func (c *Client) Health(ctx context.Context) error {
	if c.baseURL == "" {
		return errors.New("inception client: baseURL is empty")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return err
	}
	c.applyHeaders(req)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("inception health: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return &APIError{Method: "GET", Path: "/health", StatusCode: resp.StatusCode, Body: readBody(resp)}
	}
	return nil
}

// call is the shared implementation for CheckSQL and ExecuteSQL. It
// enforces the base-URL invariant, injects auth headers, and translates
// transport errors into APIError when the server responded with a non-2xx.
func (c *Client) call(ctx context.Context, path string, req TaskRequest) (*Result, error) {
	if c.baseURL == "" {
		return nil, errors.New("inception client: baseURL is empty")
	}
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("inception marshal: %w", err)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	c.applyHeaders(httpReq)
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("inception %s: %w", path, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("inception %s: read body: %w", path, err)
	}
	if resp.StatusCode/100 != 2 {
		return nil, &APIError{Method: "POST", Path: path, StatusCode: resp.StatusCode, Body: string(respBody)}
	}
	res, err := ParseResultResponse(respBody)
	if err != nil {
		return nil, err
	}
	return res, nil
}

// applyHeaders sets any auth headers the caller configured.
func (c *Client) applyHeaders(req *http.Request) {
	if c.apiKey != "" {
		req.Header.Set("X-API-Key", c.apiKey)
	}
}

// readBody is a small helper that never returns an error. It is used in
// Health where we treat any body as diagnostic-only.
func readBody(resp *http.Response) string {
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	return string(b)
}

// Ensure URL package is retained in the symbol table — used when callers
// want to construct a BaseURL from components.
var _ = url.Parse
