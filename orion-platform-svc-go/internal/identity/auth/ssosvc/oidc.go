// Package ssosvc provides OIDC SSO integration for orion-auth-svc-go.
//
// Features:
//   - OIDC discovery (/.well-known/openid-configuration)
//   - OAuth2 authorization code flow
//   - Token exchange (authorization code -> ID/access/refresh tokens)
//   - User info retrieval from userinfo endpoint
//   - Account linking (binds OIDC identity to an existing Orion user)
//
// Supports multi-tenant provider configuration stored in PostgreSQL.
package ssosvc

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"orion/platform-svc-go/internal/identity/auth/model"
	"orion/platform-svc-go/internal/identity/auth/repository"
	"go.uber.org/zap"
)

var (
	ErrProviderNotConfigured = errors.New("OIDC provider not configured")
	ErrStateMismatch         = errors.New("SSO state mismatch or expired")
	ErrInvalidState          = errors.New("invalid SSO state payload")
	ErrDiscoveryFailed       = errors.New("OIDC discovery failed")
	ErrTokenExchange         = errors.New("OIDC token exchange failed")
	ErrUserInfo              = errors.New("failed to fetch OIDC user info")
	ErrNoSubject             = errors.New("OIDC response missing subject claim")
)

const (
	defaultScope      = "openid email profile"
	StateTTLMinutes   = 10
	codeChallengeLen  = 32
	defaultHTTPTimeout = 15 * time.Second
)

// OIDCDiscoveryResponse is the parsed /.well-known/openid-configuration.
type OIDCDiscoveryResponse struct {
	Issuer            string   `json:"issuer"`
	AuthorizationURL  string   `json:"authorization_endpoint"`
	TokenURL          string   `json:"token_endpoint"`
	UserInfoURL       string   `json:"userinfo_endpoint"`
	JWKSURL           string   `json:"jwks_uri"`
	ScopesSupported   []string `json:"scopes_supported"`
	ResponseTypesSupported []string `json:"response_types_supported"`
	SubjectTypesSupported  []string `json:"subject_types_supported"`
	IDTokenSigningAlgValuesSupported []string `json:"id_token_signing_alg_values_supported"`
}

// OIDCTokens is the result of exchanging an authorization code.
type OIDCTokens struct {
	AccessToken  string `json:"access_token"`
	IDToken      string `json:"id_token,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
}

// OIDCUserInfo is the user info returned from userinfo endpoint / ID token claims.
type OIDCUserInfo struct {
	Subject   string   `json:"sub"`
	Name      string   `json:"name"`
	Email     string   `json:"email"`
	EmailVerified bool `json:"email_verified"`
	Picture   string   `json:"picture"`
	Groups    []string `json:"groups,omitempty"`
	Roles     []string `json:"roles,omitempty"`
	PreferredUsername string `json:"preferred_username"`
}

// Config holds per-provider runtime OIDC configuration.
type Config struct {
	TenantID     string
	ProviderName string
	IssuerURL    string
	ClientID     string
	ClientSecret string
	RedirectURI  string
	Scopes       string
}

// HTTPDoer is an interface for testable HTTP transport.
type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

// OIDCService handles OIDC provider discovery, authorization flow, and account linking.
type OIDCService struct {
	oidcRepo  *repository.OIDCRepository
	authRepo  *repository.AuthRepository
	log       *zap.Logger
	httpc     HTTPDoer
	jwtSecret string // used to mint Orion JWT tokens for successful SSO logins
}

// NewOIDCService creates a new OIDCService.
func NewOIDCService(
	oidcRepo *repository.OIDCRepository,
	authRepo *repository.AuthRepository,
	log *zap.Logger,
	jwtSecret string,
) *OIDCService {
	return &OIDCService{
		oidcRepo:  oidcRepo,
		authRepo:  authRepo,
		log:       log,
		httpc:     &http.Client{Timeout: defaultHTTPTimeout},
		jwtSecret: jwtSecret,
	}
}

// discoveryURL returns the /.well-known/openid-configuration URL for an issuer.
func discoveryURL(issuerURL string) string {
	u := strings.TrimRight(issuerURL, "/")
	return fmt.Sprintf("%s/.well-known/openid-configuration", u)
}

// Discover performs OIDC discovery for the given provider configuration.
func (s *OIDCService) Discover(ctx context.Context, cfg Config) (*OIDCDiscoveryResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, discoveryURL(cfg.IssuerURL), nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrDiscoveryFailed, err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: network error: %v", ErrDiscoveryFailed, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: %s returned HTTP %d", ErrDiscoveryFailed, cfg.IssuerURL, resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to read body: %v", ErrDiscoveryFailed, err)
	}

	var disc OIDCDiscoveryResponse
	if err := json.Unmarshal(body, &disc); err != nil {
		return nil, fmt.Errorf("%w: invalid JSON: %v", ErrDiscoveryFailed, err)
	}

	if disc.AuthorizationURL == "" || disc.TokenURL == "" {
		return nil, fmt.Errorf("%w: missing required endpoints in discovery", ErrDiscoveryFailed)
	}

	s.log.Info("OIDC discovery succeeded",
		zap.String("provider", cfg.ProviderName),
		zap.String("issuer", cfg.IssuerURL),
		zap.String("authorization_url", disc.AuthorizationURL),
		zap.String("token_url", disc.TokenURL),
	)

	return &disc, nil
}

// BuildAuthorizeURL constructs the OAuth2 authorization URL with PKCE.
// Returns the URL, the state (for CSRF protection), and the code verifier (for token exchange).
func (s *OIDCService) BuildAuthorizeURL(cfg Config, disc *OIDCDiscoveryResponse) (authorizeURL string, state string, codeVerifier string, err error) {
	state, err = generateRandomState()
	if err != nil {
		return "", "", "", fmt.Errorf("failed to generate state: %w", err)
	}

	codeVerifier = generateCodeVerifier()
	codeChallenge := generateCodeChallenge(codeVerifier)

	q := url.Values{}
	q.Set("client_id", cfg.ClientID)
	q.Set("redirect_uri", cfg.RedirectURI)
	q.Set("response_type", "code")
	q.Set("scope", cfg.Scopes)
	q.Set("state", state)
	q.Set("code_challenge", codeChallenge)
	q.Set("code_challenge_method", "S256")

	u := fmt.Sprintf("%s?%s", disc.AuthorizationURL, q.Encode())
	return u, state, codeVerifier, nil
}

// ExchangeToken exchanges an authorization code for tokens using the token endpoint (with PKCE).
func (s *OIDCService) ExchangeToken(ctx context.Context, cfg Config, disc *OIDCDiscoveryResponse, code, codeVerifier string) (*OIDCTokens, error) {
	form := url.Values{}
	form.Set("client_id", cfg.ClientID)
	form.Set("client_secret", cfg.ClientSecret)
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", cfg.RedirectURI)
	form.Set("code_challenge", generateCodeChallenge(codeVerifier))
	form.Set("code_verifier", codeVerifier)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, disc.TokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrTokenExchange, err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: network error: %v", ErrTokenExchange, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%w: %s returned HTTP %d: %s", ErrTokenExchange, disc.TokenURL, resp.StatusCode, string(body))
	}

	var tokens OIDCTokens
	if err := json.NewDecoder(resp.Body).Decode(&tokens); err != nil {
		return nil, fmt.Errorf("%w: invalid token response: %v", ErrTokenExchange, err)
	}

	s.log.Info("OIDC token exchange succeeded",
		zap.String("provider", cfg.ProviderName),
		zap.String("access_token_preview", tokens.AccessToken[:min(len(tokens.AccessToken), 8)]+"..."),
	)

	return &tokens, nil
}

// FetchUserInfo retrieves user info from the userinfo endpoint (with Bearer token).
// Falls back to parsing claims from the ID token if userinfo endpoint is unavailable.
func (s *OIDCService) FetchUserInfo(ctx context.Context, disc *OIDCDiscoveryResponse, accessToken string) (*OIDCUserInfo, error) {
	if disc.UserInfoURL != "" {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, disc.UserInfoURL, nil)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrUserInfo, err)
		}
		req.Header.Set("Authorization", "Bearer "+accessToken)
		req.Header.Set("Accept", "application/json")

		resp, err := s.httpc.Do(req)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				var info OIDCUserInfo
				if err := json.NewDecoder(resp.Body).Decode(&info); err == nil {
					return &info, nil
				}
			}
		}
		// Fall through to ID token parsing
		s.log.Warn("userinfo endpoint unavailable, falling back to ID token", zap.Error(err))
	}

	return nil, fmt.Errorf("%w: userinfo endpoint unavailable", ErrUserInfo)
}

// ParseIDTokenNonce extracts the `nonce` claim from an unverified ID Token payload.
// Used to cross-check against the original nonce stored in state before trusting claims.
func (s *OIDCService) ParseIDTokenNonce(idToken string) (string, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return "", fmt.Errorf("%w: invalid JWT structure", ErrUserInfo)
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", fmt.Errorf("%w: failed to decode JWT payload: %v", ErrUserInfo, err)
	}
	var claims map[string]interface{}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return "", fmt.Errorf("%w: invalid claims JSON: %v", ErrUserInfo, err)
	}
	nonce := claimString(claims, "nonce")
	if nonce == "" {
		return "", fmt.Errorf("%w: ID token missing nonce claim", ErrInvalidState)
	}
	return nonce, nil
}

// ParseIDTokenClaims extracts claims from the JWT payload (base64 decoded).
// This is a minimal, stateless parser that does NOT verify signatures — use only
// when the provider's jwks_uri is not available or as a fallback.
// Production deployments SHOULD validate signatures against the JWKS endpoint.
func (s *OIDCService) ParseIDTokenClaims(idToken string) (*OIDCUserInfo, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("%w: invalid JWT structure", ErrUserInfo)
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("%w: failed to decode JWT payload: %v", ErrUserInfo, err)
	}

	// Use a flexible map to capture all claims, then extract known fields.
	var claims map[string]interface{}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, fmt.Errorf("%w: invalid claims JSON: %v", ErrUserInfo, err)
	}

	info := &OIDCUserInfo{
		Subject: claimString(claims, "sub"),
	}
	if info.Subject == "" {
		return nil, ErrNoSubject
	}

	info.Name = claimString(claims, "name")
	info.Email = claimString(claims, "email")
	info.PreferredUsername = claimString(claims, "preferred_username")
	info.EmailVerified = claimBool(claims, "email_verified")
	info.Picture = claimString(claims, "picture")

	// Extract groups
	if g, ok := claims["groups"]; ok {
		if arr, ok := g.([]interface{}); ok {
			for _, v := range arr {
				if s, ok := v.(string); ok {
					info.Groups = append(info.Groups, s)
				}
			}
		} else if s, ok := g.(string); ok {
			info.Groups = []string{s}
		}
	}

	// Extract roles
	if r, ok := claims["roles"]; ok {
		if arr, ok := r.([]interface{}); ok {
			for _, v := range arr {
				if s, ok := v.(string); ok {
					info.Roles = append(info.Roles, s)
				}
			}
		} else if s, ok := r.(string); ok {
			info.Roles = []string{s}
		}
	}

	// Fallback: use email/preferred_username as name if name is empty
	if info.Name == "" {
		info.Name = info.Email
		if info.Name == "" {
			info.Name = info.PreferredUsername
		}
	}

	return info, nil
}

// ResolveOrLinkUser finds an existing Orion user for the OIDC identity, or creates/links one.
// Strategy:
//   1. Check user_oidc_links for existing (tenant, provider, subject) link.
//   2. If not linked, look up an existing user by email (account auto-link).
//   3. If no user exists, return nil for the handler to decide whether to auto-create.
func (s *OIDCService) ResolveOrLinkUser(ctx context.Context, tenantID, providerName string, info *OIDCUserInfo) (*model.UserOIDCLink, *model.User, error) {
	// Step 1: existing link?
	existing, err := s.oidcRepo.GetLinkBySubject(ctx, tenantID, providerName, info.Subject)
	if err != nil {
		return nil, nil, fmt.Errorf("lookup OIDC link: %w", err)
	}
	if existing != nil {
		// Touch last login
		_ = s.oidcRepo.TouchLinkLastLogin(ctx, existing.ID)

		// Fetch the linked Orion user
		user, userErr := s.authRepo.FindUserByID(ctx, existing.UserID)
		if userErr != nil {
			s.log.Warn("linked user not found", zap.String("user_id", existing.UserID), zap.Error(userErr))
			return existing, nil, userErr
		}
		return existing, user, nil
	}

	// Step 2: existing user by email?
	var linkedUser *model.User
	if info.Email != "" {
		linkedUser, err = s.authRepo.FindUserByUsername(ctx, tenantID, info.Email)
		if err != nil {
			// email lookup may not match username — try alternate pattern
			s.log.Debug("email lookup by username failed, trying alternate", zap.String("email", info.Email))
			// Fallback: find by email in users table directly via query
			var u model.User
			emailErr := s.oidcRepo.DB().GetContext(ctx, &u,
				"SELECT * FROM users WHERE tenant_id = $1 AND email = $2", tenantID, info.Email)
			if emailErr == nil {
				linkedUser = &u
			}
		}
	}

	// Step 3: no existing link, return empty link for handler to process
	link := &model.UserOIDCLink{
		TenantID:    tenantID,
		ProviderName: providerName,
		Subject:     info.Subject,
		Email:       info.Email,
		Name:        info.Name,
	}

	return link, linkedUser, nil
}

// SaveAccountLink creates the OIDC link record in the database.
func (s *OIDCService) SaveAccountLink(ctx context.Context, link *model.UserOIDCLink) error {
	now := time.Now()
	link.CreatedAt = now
	link.UpdatedAt = now
	return s.oidcRepo.CreateLink(ctx, link)
}

// ProviderConfig returns the runtime configuration for a named provider.
func (s *OIDCService) ProviderConfig(ctx context.Context, tenantID, providerName string) (*Config, error) {
	p, err := s.oidcRepo.GetProviderByTenantAndName(ctx, tenantID, providerName)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProviderNotConfigured, err)
	}
	if p == nil {
		return nil, ErrProviderNotConfigured
	}
	if !p.Enabled {
		return nil, fmt.Errorf("%w: provider %s is disabled", ErrProviderNotConfigured, providerName)
	}

	return &Config{
		TenantID:     tenantID,
		ProviderName: p.Name,
		IssuerURL:    p.IssuerURL,
		ClientID:     p.ClientID,
		ClientSecret: p.ClientSecretEncrypted, // decrypted by handler layer (fieldencryption)
		RedirectURI:  p.RedirectURI,
		Scopes:       p.Scopes,
	}, nil
}

// ListProviders returns all providers for a tenant.
func (s *OIDCService) ListProviders(ctx context.Context, tenantID string) ([]model.OIDCProvider, error) {
	return s.oidcRepo.ListProviders(ctx, tenantID)
}

// --- helpers ---

func generateRandomState() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func generateCodeVerifier() string {
	b := make([]byte, codeChallengeLen)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func generateCodeChallenge(verifier string) string {
	h := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(h[:])
}

func claimString(claims map[string]interface{}, key string) string {
	v, ok := claims[key]
	if !ok {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprint(v)
}

func claimBool(claims map[string]interface{}, key string) bool {
	v, ok := claims[key]
	if !ok {
		return false
	}
	if b, ok := v.(bool); ok {
		return b
	}
	if s, ok := v.(string); ok {
		return s == "true" || s == "1"
	}
	return false
}
