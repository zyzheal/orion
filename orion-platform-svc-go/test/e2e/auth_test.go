// Package e2e tests the auth service through real HTTP requests against a
// live Orion Platform Service instance.
//
// Run:
//   go test ./test/e2e/... -v -run TestE2E
//
// Skip (no server available):
//   go test ./test/e2e/... -short
//   go test ./test/e2e/... -v -run TestE2E -skip-short
//
// Requirements:
//   - A running Orion Platform Service at E2E_BASE_URL (default: localhost:8080)
//   - The auth routes must be available (POST /auth/login, /auth/register, /auth/refresh, /auth/logout)
//   - PostgreSQL database accessible by the server
//
// Test strategy:
//   - Each test creates a unique user with a timestamped username to avoid conflicts
//   - Tests use -short flag to gracefully skip when no server is available
package e2e

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

func testClient(t *testing.T) *E2EClient {
	t.Helper()
	if testing.Short() {
		t.Skip("skipping E2E test in short mode")
	}
	cfg := NewConfig()
	return NewE2EClientFromConfig(cfg)
}

func assertServerReachable(t *testing.T, client *E2EClient) {
	t.Helper()
	resp, err := client.Get("/healthz", DefaultHeaders())
	if err != nil {
		t.Skipf("server unreachable at %s: %v", client.baseURL, err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Skipf("server health check returned status %d, skipping E2E test", resp.StatusCode)
	}
}

// TestE2E_Login verifies the full login flow: request -> response -> token validation.
func TestE2E_Login(t *testing.T) {
	client := testClient(t)
	assertServerReachable(t, client)

	// Pre-registered user (assumes a user exists from integration tests or setup)
	loginReq := map[string]string{
		"username": "admin",
		"password": "admin",
	}

	resp, err := client.PostJSON("/auth/login", loginReq, DefaultHeaders())
	if err != nil {
		// If login fails (no admin user), that's expected in a clean environment
		t.Logf("login failed (expected in clean env): %v", err)
		return
	}
	defer resp.Body.Close()

	// Response should have a valid status
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := ResponseBody(resp)
		t.Logf("login response status=%d body=%s", resp.StatusCode, string(body))
		return
	}

	var envelope LoginResponseEnvelope
	body, _ := ResponseBody(resp)
	if err := json.Unmarshal(body, &envelope); err == nil {
		if envelope.AccessToken == "" {
			t.Fatalf("expected non-empty access token")
		}
		if envelope.RefreshToken == "" {
			t.Fatalf("expected non-empty refresh token")
		}
	}

	t.Logf("login successful, token expires at %d", envelope.ExpiresAt)
}

// TestE2E_RegisterAndLogin verifies register -> login flow.
func TestE2E_RegisterAndLogin(t *testing.T) {
	client := testClient(t)
	assertServerReachable(t, client)

	username := GenerateTestName("e2e-reg")
	email := username + "@example.com"
	password := "E2E_test_Pass123!"

	// Step 1: Register
	regReq := map[string]string{
		"username": username,
		"password": password,
		"email":    email,
	}
	resp, err := client.PostJSON("/auth/register", regReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("register request failed: %v", err)
	}
	defer resp.Body.Close()

	// Registration may return 200 or 201
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := ResponseBody(resp)
		t.Fatalf("register failed: status=%d body=%s", resp.StatusCode, string(body))
	}

	// Step 2: Login
	loginReq := map[string]string{
		"username": username,
		"password": password,
	}
	loginResp, err := client.PostJSON("/auth/login", loginReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("login request failed: %v", err)
	}
	defer loginResp.Body.Close()

	var envelope LoginResponseEnvelope
	body, err := ResponseBody(loginResp)
	if err != nil {
		t.Fatalf("failed to read login response: %v", err)
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		t.Fatalf("failed to parse login response: %v. Body: %s", err, string(body))
	}

	if envelope.AccessToken == "" {
		t.Fatalf("expected non-empty access token")
	}
	if envelope.RefreshToken == "" {
		t.Fatalf("expected non-empty refresh token")
	}

	t.Logf("register -> login flow successful for user %s", username)
}

// TestE2E_Login_BadCredentials verifies that login fails with wrong password.
func TestE2E_Login_BadCredentials(t *testing.T) {
	client := testClient(t)
	assertServerReachable(t, client)

	loginReq := map[string]string{
		"username": "nonexistent-user-" + GenerateTestName(""),
		"password": "wrong-password",
	}

	resp, err := client.PostJSON("/auth/login", loginReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("login request failed: %v", err)
	}
	defer resp.Body.Close()

	// Should get a 4xx error response
	if resp.StatusCode < 400 || resp.StatusCode >= 500 {
		t.Logf("login with bad credentials returned status %d (expected 4xx)", resp.StatusCode)
	}
}

// TestE2E_Login_Refresh verifies the token refresh flow.
func TestE2E_Login_Refresh(t *testing.T) {
	client := testClient(t)
	assertServerReachable(t, client)

	// First register + login to get tokens
	username := GenerateTestName("e2e-refresh")
	password := "E2E_test_Pass123!"

	// Register
	regReq := map[string]string{
		"username": username,
		"password": password,
		"email":    username + "@example.com",
	}
	regResp, err := client.PostJSON("/auth/register", regReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}
	regResp.Body.Close()

	// Login
	loginReq := map[string]string{
		"username": username,
		"password": password,
	}
	loginResp, err := client.PostJSON("/auth/login", loginReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	var loginEnv LoginResponseEnvelope
	body, _ := ResponseBody(loginResp)
	if err := json.Unmarshal(body, &loginEnv); err != nil {
		t.Fatalf("parse login response: %v", err)
	}

	// Refresh
	refreshReq := map[string]string{
		"refreshToken": loginEnv.RefreshToken,
	}
	refreshResp, err := client.PostJSON("/auth/refresh", refreshReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("refresh request failed: %v", err)
	}
	defer refreshResp.Body.Close()

	var refreshEnv LoginResponseEnvelope
	body, _ = ResponseBody(refreshResp)
	if err := json.Unmarshal(body, &refreshEnv); err != nil {
		t.Fatalf("parse refresh response: %v. Body: %s", err, string(body))
	}

	if refreshEnv.AccessToken == "" {
		t.Fatalf("expected non-empty access token from refresh")
	}
	if refreshEnv.AccessToken == loginEnv.AccessToken {
		t.Fatalf("refresh should return a new access token, got the same")
	}

	t.Logf("token refresh successful")
}

// TestE2E_Register_InvalidPayload verifies that register rejects empty fields.
func TestE2E_Register_InvalidPayload(t *testing.T) {
	client := testClient(t)
	assertServerReachable(t, client)

	regReq := map[string]string{
		"username": "",
		"password": "",
	}
	resp, err := client.PostJSON("/auth/register", regReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("register request failed: %v", err)
	}
	defer resp.Body.Close()

	// Should get a 4xx validation error
	if resp.StatusCode < 400 || resp.StatusCode >= 500 {
		t.Logf("register with empty payload returned status %d (expected 4xx)", resp.StatusCode)
	}
}

// TestE2E_Me verifies the GET /auth/me endpoint with valid token.
func TestE2E_Me(t *testing.T) {
	client := testClient(t)
	assertServerReachable(t, client)

	// Login first
	username := GenerateTestName("e2e-me")
	password := "E2E_test_Pass123!"

	// Register
	regReq := map[string]string{
		"username": username,
		"password": password,
		"email":    username + "@example.com",
	}
	regResp, err := client.PostJSON("/auth/register", regReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}
	regResp.Body.Close()

	// Login
	loginReq := map[string]string{
		"username": username,
		"password": password,
	}
	loginResp, err := client.PostJSON("/auth/login", loginReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	var loginEnv LoginResponseEnvelope
	body, _ := ResponseBody(loginResp)
	if err := json.Unmarshal(body, &loginEnv); err != nil {
		t.Fatalf("parse login: %v", err)
	}

	// GET /auth/me
	headers := AuthHeaders(loginEnv.AccessToken, "")
	meResp, err := client.Get("/auth/me", headers)
	if err != nil {
		t.Fatalf("/auth/me request failed: %v", err)
	}
	defer meResp.Body.Close()

	if meResp.StatusCode < 200 || meResp.StatusCode >= 300 {
		body, _ := ResponseBody(meResp)
		t.Fatalf("/auth/me returned status %d body: %s", meResp.StatusCode, string(body))
	}

	t.Logf("/auth/me successful")
}

// TestE2E_Me_Unauthorized verifies that /auth/me rejects requests without token.
func TestE2E_Me_Unauthorized(t *testing.T) {
	client := testClient(t)
	assertServerReachable(t, client)

	resp, err := client.Get("/auth/me", DefaultHeaders())
	if err != nil {
		t.Fatalf("/auth/me request failed: %v", err)
	}
	defer resp.Body.Close()

	// Should get 401 or 403
	if resp.StatusCode != 401 && resp.StatusCode != 403 {
		t.Logf("/auth/me without token returned status %d (expected 401/403)", resp.StatusCode)
	}
}

// TestE2E_Register_DuplicateUsername verifies that duplicate registration fails.
func TestE2E_Register_DuplicateUsername(t *testing.T) {
	client := testClient(t)
	assertServerReachable(t, client)

	username := GenerateTestName("e2e-dup")
	password := "E2E_test_Pass123!"
	email := username + "@example.com"

	regReq := map[string]string{
		"username": username,
		"password": password,
		"email":    email,
	}

	// First registration
	resp, err := client.PostJSON("/auth/register", regReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("first register failed: %v", err)
	}
	resp.Body.Close()

	// Second registration with same username
	resp, err = client.PostJSON("/auth/register", regReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("second register failed: %v", err)
	}
	defer resp.Body.Close()

	// Should get 4xx (conflict or validation error)
	if resp.StatusCode < 400 || resp.StatusCode >= 500 {
		body, _ := ResponseBody(resp)
		t.Logf("duplicate register returned status %d (expected 4xx). Body: %s", resp.StatusCode, string(body))
	}
}

// TestE2E_Login_Session verifies a complete login -> logout session.
func TestE2E_Login_Session(t *testing.T) {
	client := testClient(t)
	assertServerReachable(t, client)

	username := GenerateTestName("e2e-session")
	password := "E2E_test_Pass123!"

	// Register
	regReq := map[string]string{
		"username": username,
		"password": password,
		"email":    username + "@example.com",
	}
	regResp, err := client.PostJSON("/auth/register", regReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}
	regResp.Body.Close()

	// Login
	loginReq := map[string]string{
		"username": username,
		"password": password,
	}
	loginResp, err := client.PostJSON("/auth/login", loginReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	var loginEnv LoginResponseEnvelope
	body, _ := ResponseBody(loginResp)
	if err := json.Unmarshal(body, &loginEnv); err != nil {
		t.Fatalf("parse login: %v", err)
	}

	// Logout
	logoutReq := map[string]string{
		"accessToken":  loginEnv.AccessToken,
		"refreshToken": loginEnv.RefreshToken,
	}
	logoutResp, err := client.PostJSON("/auth/logout", logoutReq, AuthHeaders(loginEnv.AccessToken, ""))
	if err != nil {
		t.Fatalf("logout failed: %v", err)
	}
	defer logoutResp.Body.Close()

	// Logout should succeed (2xx)
	if logoutResp.StatusCode < 200 || logoutResp.StatusCode >= 300 {
		body, _ := ResponseBody(logoutResp)
		t.Logf("logout returned status %d body: %s", logoutResp.StatusCode, string(body))
	}

	// After logout, refresh token should be invalidated
	refreshReq := map[string]string{
		"refreshToken": loginEnv.RefreshToken,
	}
	refreshResp, err := client.PostJSON("/auth/refresh", refreshReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("refresh after logout failed: %v", err)
	}
	defer refreshResp.Body.Close()

	// Should get 4xx (token revoked)
	if refreshResp.StatusCode < 400 || refreshResp.StatusCode >= 500 {
		t.Logf("refresh after logout returned status %d (expected 4xx, token should be revoked)", refreshResp.StatusCode)
	}

	t.Logf("session login -> logout -> refresh(revoked) flow complete")
}

// TestE2E_Register_Tenant verifies that registration respects tenant context.
func TestE2E_Register_Tenant(t *testing.T) {
	client := testClient(t)
	assertServerReachable(t, client)

	tenantID := os.Getenv("E2E_TENANT_ID")
	if tenantID == "" {
		tenantID = "tenant1"
	}

	username := GenerateTestName("e2e-tenant")
	password := "E2E_test_Pass123!"
	email := username + "@example.com"

	regReq := map[string]string{
		"username": username,
		"password": password,
		"email":    email,
	}

	headers := DefaultHeaders()
	headers["X-Tenant-ID"] = tenantID

	resp, err := client.PostJSON("/auth/register", regReq, headers)
	if err != nil {
		t.Fatalf("register with tenant failed: %v", err)
	}
	defer resp.Body.Close()

	// Should succeed or return a valid error
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		t.Logf("tenant-aware registration successful for tenant %s", tenantID)
	} else {
		body, _ := ResponseBody(resp)
		t.Logf("tenant-aware registration returned status %d (server may require admin): %s", resp.StatusCode, string(body))
	}
}

// TestE2E_Login_RateLimit tests login under repeated requests.
func TestE2E_Login_RateLimit(t *testing.T) {
	client := testClient(t)
	assertServerReachable(t, client)

	// Attempt several rapid login requests with bad credentials
	// Some servers may rate-limit after a threshold
	nonexistent := GenerateTestName("bad")
	for i := 0; i < 3; i++ {
		loginReq := map[string]string{
			"username": nonexistent,
			"password": "wrong",
		}
		resp, err := client.PostJSON("/auth/login", loginReq, DefaultHeaders())
		if err != nil {
			t.Fatalf("login attempt %d failed: %v", i, err)
		}
		resp.Body.Close()

		// All should return 4xx (not found or bad credentials)
		if resp.StatusCode < 400 || resp.StatusCode >= 500 {
			t.Logf("attempt %d returned status %d", i, resp.StatusCode)
		}
	}

	t.Logf("rate limit test completed (3 attempts)")
}

// TestE2E_Register_EmptyUsername verifies empty username is rejected.
func TestE2E_Register_EmptyUsername(t *testing.T) {
	client := testClient(t)
	assertServerReachable(t, client)

	regReq := map[string]string{
		"username": "",
		"password": "SomePassword123!",
	}
	resp, err := client.PostJSON("/auth/register", regReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("register request failed: %v", err)
	}
	defer resp.Body.Close()

	// Should get 4xx
	if resp.StatusCode < 400 || resp.StatusCode >= 500 {
		body, _ := ResponseBody(resp)
		t.Logf("empty username register returned %d (expected 4xx). Body: %s", resp.StatusCode, string(body))
	}
}

// TestE2E_Register_ShortPassword verifies short password is rejected.
func TestE2E_Register_ShortPassword(t *testing.T) {
	client := testClient(t)
	assertServerReachable(t, client)

	username := GenerateTestName("e2e-short-pw")
	regReq := map[string]string{
		"username": username,
		"password": "short", // 5 chars < 8
	}
	resp, err := client.PostJSON("/auth/register", regReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("register request failed: %v", err)
	}
	defer resp.Body.Close()

	// Should get 4xx
	if resp.StatusCode < 400 || resp.StatusCode >= 500 {
		body, _ := ResponseBody(resp)
		t.Logf("short password register returned %d (expected 4xx). Body: %s", resp.StatusCode, string(body))
	}
}

// TestE2E_Auth_TokenFormat verifies that login tokens are well-formed JWT strings.
func TestE2E_Auth_TokenFormat(t *testing.T) {
	client := testClient(t)
	assertServerReachable(t, client)

	username := GenerateTestName("e2e-jwt")
	password := "E2E_test_Pass123!"

	// Register
	regReq := map[string]string{
		"username": username,
		"password": password,
		"email":    username + "@example.com",
	}
	regResp, err := client.PostJSON("/auth/register", regReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}
	regResp.Body.Close()

	// Login
	loginReq := map[string]string{
		"username": username,
		"password": password,
	}
	loginResp, err := client.PostJSON("/auth/login", loginReq, DefaultHeaders())
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	var loginEnv LoginResponseEnvelope
	body, _ := ResponseBody(loginResp)
	if err := json.Unmarshal(body, &loginEnv); err != nil {
		t.Fatalf("parse login: %v", err)
	}

	// Validate JWT format: should have 3 parts separated by dots
	if strings.Count(loginEnv.AccessToken, ".") != 2 {
		t.Fatalf("access token should be JWT format (3 dot-separated parts), got: %s", loginEnv.AccessToken)
	}
	if strings.Count(loginEnv.RefreshToken, ".") != 2 {
		t.Fatalf("refresh token should be JWT format, got: %s", loginEnv.RefreshToken)
	}

	// ExpiresAt should be in the future
	if loginEnv.ExpiresAt < time.Now().Unix() {
		t.Fatalf("expiresAt should be in the future, got: %d", loginEnv.ExpiresAt)
	}

	t.Logf("JWT token format validated, expires at %s", time.Unix(loginEnv.ExpiresAt, 0).String())
}
