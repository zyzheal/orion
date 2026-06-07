// Package sso implements Single Sign-On protocols (OIDC, LDAP, WeChat OAuth)
// and enterprise integration features (HR sync, device management, geo-login).
package sso

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// OIDCProvider implements the OpenID Connect authorization code flow.
type OIDCProvider struct {
	config   OIDCConfig
	client   *http.Client
	verifier *IDTokenVerifier
}

// OIDCConfig holds OIDC provider configuration.
type OIDCConfig struct {
	// Issuer is the OIDC issuer URL (e.g., "https://accounts.google.com").
	Issuer string `json:"issuer"`
	// ClientID is the OAuth2 client ID.
	ClientID string `json:"client_id"`
	// ClientSecret is the OAuth2 client secret.
	ClientSecret string `json:"client_secret"`
	// RedirectURI is the callback URL registered with the provider.
	RedirectURI string `json:"redirect_uri"`
	// Scopes are the OAuth2 scopes to request. Default: ["openid", "profile", "email"].
	Scopes []string `json:"scopes"`
	// DiscoveryURL is the .well-known/openid-configuration URL. Auto-derived from Issuer if empty.
	DiscoveryURL string `json:"discovery_url"`
}

// OIDCDiscovery represents the OpenID Connect discovery document.
type OIDCDiscovery struct {
	Issuer                string `json:"issuer"`
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	UserinfoEndpoint      string `json:"userinfo_endpoint"`
	JWKSURI               string `json:"jwks_uri"`
	EndSessionEndpoint    string `json:"end_session_endpoint,omitempty"`
	RegistrationEndpoint  string `json:"registration_endpoint,omitempty"`
	ScopesSupported       []string `json:"scopes_supported,omitempty"`
	ResponseTypesSupported []string `json:"response_types_supported,omitempty"`
	SubjectTypesSupported []string `json:"subject_types_supported,omitempty"`
	IDTokenSigningAlgValuesSupported []string `json:"id_token_signing_alg_values_supported,omitempty"`
}

// OIDCTokenResponse represents the token endpoint response.
type OIDCTokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token,omitempty"`
	IDToken      string `json:"id_token"`
	Scope        string `json:"scope,omitempty"`
}

// OIDCUserInfo represents the userinfo endpoint response.
type OIDCUserInfo struct {
	Sub               string `json:"sub"`
	Name              string `json:"name,omitempty"`
	GivenName         string `json:"given_name,omitempty"`
	FamilyName        string `json:"family_name,omitempty"`
	PreferredUsername string `json:"preferred_username,omitempty"`
	Email             string `json:"email,omitempty"`
	EmailVerified     bool   `json:"email_verified,omitempty"`
	Picture           string `json:"picture,omitempty"`
	Locale            string `json:"locale,omitempty"`
}

// NewOIDCProvider creates a new OIDC provider.
func NewOIDCProvider(config OIDCConfig) *OIDCProvider {
	if len(config.Scopes) == 0 {
		config.Scopes = []string{"openid", "profile", "email"}
	}
	return &OIDCProvider{
		config: config,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

// Issuer returns the configured OIDC issuer URL.
func (p *OIDCProvider) Issuer() string {
	return p.config.Issuer
}

// Discover fetches the OIDC discovery document.
func (p *OIDCProvider) Discover(ctx context.Context) (*OIDCDiscovery, error) {
	discoveryURL := p.config.DiscoveryURL
	if discoveryURL == "" {
		discoveryURL = strings.TrimSuffix(p.config.Issuer, "/") + "/.well-known/openid-configuration"
	}

	req, err := http.NewRequestWithContext(ctx, "GET", discoveryURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create discovery request: %w", err)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch discovery: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("discovery returned status %d", resp.StatusCode)
	}

	var discovery OIDCDiscovery
	if err := json.NewDecoder(resp.Body).Decode(&discovery); err != nil {
		return nil, fmt.Errorf("decode discovery: %w", err)
	}

	return &discovery, nil
}

// AuthCodeURL generates the OIDC authorization URL.
func (p *OIDCProvider) AuthCodeURL(state string, opts ...AuthCodeOption) string {
	discovery, err := p.Discover(context.Background())
	if err != nil {
		// Fallback to issuer-based URL
		return p.buildAuthURL(p.config.Issuer+"/authorize", state, opts...)
	}
	return p.buildAuthURL(discovery.AuthorizationEndpoint, state, opts...)
}

// AuthCodeOption is a functional option for AuthCodeURL.
type AuthCodeOption func(url.Values)

// WithNonce adds a nonce parameter.
func WithNonce(nonce string) AuthCodeOption {
	return func(v url.Values) {
		v.Set("nonce", nonce)
	}
}

// WithPrompt adds a prompt parameter (e.g., "login", "consent", "select_account").
func WithPrompt(prompt string) AuthCodeOption {
	return func(v url.Values) {
		v.Set("prompt", prompt)
	}
}

// WithLoginHint adds a login_hint parameter.
func WithLoginHint(hint string) AuthCodeOption {
	return func(v url.Values) {
		v.Set("login_hint", hint)
	}
}

func (p *OIDCProvider) buildAuthURL(endpoint, state string, opts ...AuthCodeOption) string {
	v := url.Values{}
	v.Set("response_type", "code")
	v.Set("client_id", p.config.ClientID)
	v.Set("redirect_uri", p.config.RedirectURI)
	v.Set("scope", strings.Join(p.config.Scopes, " "))
	v.Set("state", state)
	for _, opt := range opts {
		opt(v)
	}
	return endpoint + "?" + v.Encode()
}

// GenerateState generates a cryptographically random state parameter.
func GenerateState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// GenerateNonce generates a cryptographically random nonce.
func GenerateNonce() (string, error) {
	return GenerateState() // same mechanism
}

// Exchange exchanges an authorization code for tokens.
func (p *OIDCProvider) Exchange(ctx context.Context, code string) (*OIDCTokenResponse, error) {
	discovery, err := p.Discover(ctx)
	if err != nil {
		return nil, fmt.Errorf("discover: %w", err)
	}

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", p.config.RedirectURI)
	data.Set("client_id", p.config.ClientID)
	data.Set("client_secret", p.config.ClientSecret)

	req, err := http.NewRequestWithContext(ctx, "POST", discovery.TokenEndpoint,
		strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("create token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token exchange: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token endpoint returned %d: %s", resp.StatusCode, string(body))
	}

	var tokenResp OIDCTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("decode token response: %w", err)
	}

	return &tokenResp, nil
}

// GetUserInfo fetches user info from the userinfo endpoint.
func (p *OIDCProvider) GetUserInfo(ctx context.Context, accessToken string) (*OIDCUserInfo, error) {
	discovery, err := p.Discover(ctx)
	if err != nil {
		return nil, fmt.Errorf("discover: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", discovery.UserinfoEndpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("create userinfo request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch userinfo: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("userinfo returned %d: %s", resp.StatusCode, string(body))
	}

	var userInfo OIDCUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("decode userinfo: %w", err)
	}

	return &userInfo, nil
}

// IDTokenVerifier verifies OIDC ID tokens.
// For production, this should use the provider's JWKS endpoint.
type IDTokenVerifier struct {
	issuer   string
	clientID string
}

// NewIDTokenVerifier creates a new ID token verifier.
func NewIDTokenVerifier(issuer, clientID string) *IDTokenVerifier {
	return &IDTokenVerifier{issuer: issuer, clientID: clientID}
}
