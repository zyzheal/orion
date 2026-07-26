package sso

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewOIDCProvider_DefaultScopes(t *testing.T) {
	p := NewOIDCProvider(OIDCConfig{
		Issuer:   "https://accounts.google.com",
		ClientID: "test-client",
	})

	if len(p.config.Scopes) != 3 {
		t.Errorf("expected 3 default scopes, got %d", len(p.config.Scopes))
	}
	if p.config.Scopes[0] != "openid" {
		t.Errorf("expected first scope=openid, got %s", p.config.Scopes[0])
	}
}

func TestNewOIDCProvider_CustomScopes(t *testing.T) {
	p := NewOIDCProvider(OIDCConfig{
		Issuer:   "https://accounts.google.com",
		ClientID: "test-client",
		Scopes:   []string{"openid", "email"},
	})

	if len(p.config.Scopes) != 2 {
		t.Errorf("expected 2 scopes, got %d", len(p.config.Scopes))
	}
}

func TestOIDCProvider_Discover(t *testing.T) {
	var baseURL string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/.well-known/openid-configuration" {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		discovery := OIDCDiscovery{
			Issuer:                baseURL,
			AuthorizationEndpoint: baseURL + "/authorize",
			TokenEndpoint:         baseURL + "/token",
			UserinfoEndpoint:      baseURL + "/userinfo",
			JWKSURI:               baseURL + "/.well-known/jwks.json",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(discovery)
	}))
	defer server.Close()
	baseURL = server.URL

	p := NewOIDCProvider(OIDCConfig{
		Issuer:   baseURL,
		ClientID: "test-client",
	})

	discovery, err := p.Discover(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if discovery.TokenEndpoint != baseURL+"/token" {
		t.Errorf("expected token endpoint %s, got %s", baseURL+"/token", discovery.TokenEndpoint)
	}
	if discovery.AuthorizationEndpoint != baseURL+"/authorize" {
		t.Errorf("expected auth endpoint %s, got %s", baseURL+"/authorize", discovery.AuthorizationEndpoint)
	}
}

func TestOIDCProvider_Discover_Error(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "server error", http.StatusInternalServerError)
	}))
	defer server.Close()

	p := NewOIDCProvider(OIDCConfig{
		Issuer:   server.URL,
		ClientID: "test-client",
	})

	_, err := p.Discover(context.Background())
	if err == nil {
		t.Error("expected error for 500 response")
	}
}

func TestOIDCProvider_Exchange(t *testing.T) {
	var baseURL string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			discovery := OIDCDiscovery{
				Issuer:        baseURL,
				TokenEndpoint: baseURL + "/token",
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(discovery)
			return
		}

		if r.URL.Path == "/token" {
			if r.Method != "POST" {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			if err := r.ParseForm(); err != nil {
				http.Error(w, "bad request", http.StatusBadRequest)
				return
			}
			if r.Form.Get("grant_type") != "authorization_code" {
				http.Error(w, "wrong grant_type", http.StatusBadRequest)
				return
			}
			if r.Form.Get("code") != "test-code" {
				http.Error(w, "wrong code", http.StatusBadRequest)
				return
			}

			resp := OIDCTokenResponse{
				AccessToken: "access-123",
				TokenType:   "Bearer",
				ExpiresIn:   3600,
				IDToken:     "id-token-123",
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
			return
		}

		http.Error(w, "not found", http.StatusNotFound)
	}))
	defer server.Close()
	baseURL = server.URL

	p := NewOIDCProvider(OIDCConfig{
		Issuer:       baseURL,
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		RedirectURI:  baseURL + "/callback",
		DiscoveryURL: baseURL + "/.well-known/openid-configuration",
	})

	tokenResp, err := p.Exchange(context.Background(), "test-code")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if tokenResp.AccessToken != "access-123" {
		t.Errorf("expected access_token=access-123, got %s", tokenResp.AccessToken)
	}
	if tokenResp.IDToken != "id-token-123" {
		t.Errorf("expected id_token=id-token-123, got %s", tokenResp.IDToken)
	}
}

func TestOIDCProvider_Exchange_ErrorResponse(t *testing.T) {
	var baseURL string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			discovery := OIDCDiscovery{
				Issuer:        baseURL,
				TokenEndpoint: baseURL + "/token",
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(discovery)
			return
		}
		http.Error(w, "invalid grant", http.StatusBadRequest)
	}))
	defer server.Close()
	baseURL = server.URL

	p := NewOIDCProvider(OIDCConfig{
		Issuer:       baseURL,
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		RedirectURI:  baseURL + "/callback",
		DiscoveryURL: baseURL + "/.well-known/openid-configuration",
	})

	_, err := p.Exchange(context.Background(), "bad-code")
	if err == nil {
		t.Error("expected error for 400 response")
	}
}

func TestOIDCProvider_GetUserInfo(t *testing.T) {
	var baseURL string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/openid-configuration" {
			discovery := OIDCDiscovery{
				Issuer:           baseURL,
				UserinfoEndpoint: baseURL + "/userinfo",
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(discovery)
			return
		}

		if r.URL.Path == "/userinfo" {
			auth := r.Header.Get("Authorization")
			if auth != "Bearer test-token" {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			info := OIDCUserInfo{
				Sub:               "user-123",
				Name:              "Test User",
				Email:             "test@example.com",
				EmailVerified:     true,
				PreferredUsername: "testuser",
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(info)
			return
		}

		http.Error(w, "not found", http.StatusNotFound)
	}))
	defer server.Close()
	baseURL = server.URL

	p := NewOIDCProvider(OIDCConfig{
		Issuer:       baseURL,
		ClientID:     "test-client",
		DiscoveryURL: baseURL + "/.well-known/openid-configuration",
	})

	info, err := p.GetUserInfo(context.Background(), "test-token")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if info.Sub != "user-123" {
		t.Errorf("expected sub=user-123, got %s", info.Sub)
	}
	if info.Email != "test@example.com" {
		t.Errorf("expected email=test@example.com, got %s", info.Email)
	}
}

func TestOIDCProvider_AuthCodeURL(t *testing.T) {
	p := NewOIDCProvider(OIDCConfig{
		Issuer:      "https://example.com",
		ClientID:    "client-123",
		RedirectURI: "https://app.example.com/callback",
		Scopes:      []string{"openid", "email"},
	})

	// AuthCodeURL will fail to discover (no server) and fall back to issuer-based URL
	url := p.AuthCodeURL("state-123")

	if url == "" {
		t.Fatal("expected non-empty URL")
	}
	if !containsStr(url, "client_id=client-123") {
		t.Error("URL should contain client_id")
	}
	if !containsStr(url, "state=state-123") {
		t.Error("URL should contain state")
	}
	if !containsStr(url, "response_type=code") {
		t.Error("URL should contain response_type=code")
	}
}

func TestOIDCProvider_AuthCodeURL_WithOptions(t *testing.T) {
	p := NewOIDCProvider(OIDCConfig{
		Issuer:      "https://example.com",
		ClientID:    "client-123",
		RedirectURI: "https://app.example.com/callback",
	})

	url := p.AuthCodeURL("state-1", WithNonce("nonce-1"), WithPrompt("login"))

	if !containsStr(url, "nonce=nonce-1") {
		t.Error("URL should contain nonce")
	}
	if !containsStr(url, "prompt=login") {
		t.Error("URL should contain prompt")
	}
}

func TestGenerateState(t *testing.T) {
	state1, err := GenerateState()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(state1) == 0 {
		t.Error("expected non-empty state")
	}

	state2, err := GenerateState()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if state1 == state2 {
		t.Error("consecutive states should be different")
	}
}

func TestGenerateNonce(t *testing.T) {
	nonce, err := GenerateNonce()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(nonce) == 0 {
		t.Error("expected non-empty nonce")
	}
}

func TestIDTokenVerifier_New(t *testing.T) {
	v := NewIDTokenVerifier("https://example.com", "client-123")
	if v == nil {
		t.Fatal("expected non-nil verifier")
	}
}

func containsStr(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstring(s, substr))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
