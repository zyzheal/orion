// Package e2e provides shared helpers for end-to-end tests.
//
// These helpers handle response parsing, assertion utilities, and
// test lifecycle management (setup/teardown) for E2E scenarios.
package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

// Testable is the minimal interface a test helper needs from *testing.T.
type Testable interface {
	Helper()
	Skipf(format string, args ...any)
	Fatalf(format string, args ...any)
	Errorf(format string, args ...any)
}

// ParseJSONResponse unmarshals a response body into the target struct.
// Returns the response status code so callers can chain assertions.
func ParseJSONResponse[T any](resp *http.Response, target *T) error {
	body, err := ResponseBody(resp)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}
	return json.Unmarshal(body, target)
}

// ErrorResponse represents a common error response shape from Orion API.
type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Error   string `json:"error"`
}

// ParseErrorResponse unmarshals an error response and returns it.
func ParseErrorResponse(resp *http.Response) *ErrorResponse {
	errResp := &ErrorResponse{}
	_ = ParseJSONResponse(resp, errResp)
	return errResp
}

// RequireNonEmpty skips the test if any of the given values are empty.
func RequireNonEmpty(t Testable, label, value string) {
	t.Helper()
	if strings.TrimSpace(value) == "" {
		t.Skipf("skipping E2E test: %s is empty", label)
	}
}

// RequireEnv skips the test if the given environment variable is empty.
func RequireEnv(t Testable, name string) string {
	t.Helper()
	v := os.Getenv(name)
	if v == "" {
		t.Skipf("skipping E2E test: %s not set", name)
	}
	return v
}

// WaitUntilServerReady waits for the server to respond on /healthz.
// Returns the response status code or an error if timeout is exceeded.
func WaitUntilServerReady(ctx context.Context, baseURL string, timeout time.Duration) error {
	client := &http.Client{Timeout: 2 * time.Second}
	interval := 500 * time.Millisecond
	deadline, _ := ctx.WithDeadline(time.Now().Add(timeout))

	for time.Now().Before(deadline) {
		resp, err := client.Get(baseURL + "/healthz")
		if err == nil && resp.StatusCode == 200 {
			resp.Body.Close()
			return nil
		}
		if resp != nil {
			resp.Body.Close()
		}
		select {
		case <-deadline.Done():
			return fmt.Errorf("server not ready at %s after %v", baseURL, timeout)
		case <-time.After(interval):
		}
	}
	return fmt.Errorf("server not ready at %s after %v", baseURL, timeout)
}

// GenerateTestName creates a unique test name with a timestamp suffix.
func GenerateTestName(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

// AssertResponseCode fails the test if the status code does not match expected.
func AssertResponseCode(t Testable, resp *http.Response, expected int) {
	t.Helper()
	if resp.StatusCode != expected {
		body, _ := ResponseBody(resp)
		t.Fatalf("expected status %d, got %d. Body: %s", expected, resp.StatusCode, string(body))
	}
}

// AssertResponseContains checks that the response body contains the expected substring.
func AssertResponseContains(t Testable, resp *http.Response, expected string) {
	t.Helper()
	body, err := ResponseBody(resp)
	if err != nil {
		t.Fatalf("failed to read response body: %v", err)
	}
	if !strings.Contains(string(body), expected) {
		t.Fatalf("expected response body to contain %q, got: %s", expected, string(body))
	}
}

// LogResponse logs response details to stderr for debugging.
func LogResponse(prefix string, resp *http.Response) {
	if resp == nil {
		fmt.Printf("[%s] response is nil\n", prefix)
		return
	}
	body, _ := ResponseBody(resp)
	fmt.Printf("[%s] status=%d body=%s\n", prefix, resp.StatusCode, string(body))
}

// RegisterTestUser registers a new user via E2E HTTP flow and returns
// the login response (containing tokens) if successful.
func RegisterTestUser(client *E2EClient, tenantID string) (*LoginResponseEnvelope, error) {
	username := GenerateTestName("e2e-user")
	email := fmt.Sprintf("%s@example.com", username)

	regReq := map[string]string{
		"username": username,
		"password": "E2E_test_Pass123!",
		"email":    email,
	}

	headers := DefaultHeaders()
	if tenantID != "" {
		headers["X-Tenant-ID"] = tenantID
	}

	resp, err := client.PostJSON("/auth/register", regReq, headers)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Registration may return 200 or 201; also handle "already exists" gracefully
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("register failed: status=%d", resp.StatusCode)
	}

	// Now login with the created user
	loginReq := map[string]string{
		"username": username,
		"password": "E2E_test_Pass123!",
	}

	loginResp, err := client.PostJSON("/auth/login", loginReq, DefaultHeaders())
	if err != nil {
		return nil, err
	}
	defer loginResp.Body.Close()

	var envelope LoginResponseEnvelope
	if err := ParseJSONResponse(loginResp, &envelope); err != nil {
		return nil, err
	}
	return &envelope, nil
}

// LoginResponseEnvelope is the JSON response from POST /auth/login.
type LoginResponseEnvelope struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    int64  `json:"expiresAt"`
}

// PipelineRequest is the JSON body for creating a pipeline via E2E HTTP.
type PipelineRequest struct {
	Name           string `json:"name" binding:"required"`
	Description    string `json:"description"`
	TriggerType    string `json:"triggerType"`
	YamlDefinition string `json:"yamlDefinition"`
	ProjectID      string `json:"projectId"`
	Version        int    `json:"version"`
}

// PipelineResponse is the JSON response containing a created pipeline.
type PipelineResponse struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	Status         string `json:"status"`
	Version        int    `json:"version"`
	TriggerType    string `json:"triggerType"`
	ProjectID      string `json:"projectId"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
}

// ResponseEnvelope is a generic API response envelope.
type ResponseEnvelope struct {
	Data     json.RawMessage `json:"data"`
	Success  bool            `json:"success"`
	Message  string          `json:"message"`
	Metadata map[string]any  `json:"metadata,omitempty"`
}
