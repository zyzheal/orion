package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// PandaWikiLoginConfig holds the credentials for PandaWiki login.
type PandaWikiLoginConfig struct {
	TargetURL string
	Account   string
	Password  string
}

// pandawikiResponse is the login response from PandaWiki.
type pandawikiResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Data    struct {
		Token string `json:"token,omitempty"`
	} `json:"data,omitempty"`
}

// PandaWikiTokenService manages PandaWiki auth tokens with caching.
type PandaWikiTokenService struct {
	mu          sync.Mutex
	config      *PandaWikiLoginConfig
	cachedToken string
	tokenExpiry time.Time
	loginInProg bool
	httpClient  *http.Client
}

// NewPandaWikiTokenService creates a PandaWiki token service.
func NewPandaWikiTokenService() *PandaWikiTokenService {
	return &PandaWikiTokenService{
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// InitAuth sets the login configuration.
func (p *PandaWikiTokenService) InitAuth(cfg PandaWikiLoginConfig) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.config != nil && p.config.TargetURL == cfg.TargetURL && p.config.Account == cfg.Account {
		return
	}
	p.config = &cfg
	p.cachedToken = ""
	p.tokenExpiry = time.Time{}
}

// GetToken returns a valid PandaWiki token, logging in if necessary.
func (p *PandaWikiTokenService) GetToken(ctx context.Context) (string, error) {
	p.mu.Lock()
	if p.config == nil {
		p.mu.Unlock()
		return "", fmt.Errorf("PandaWiki auth not initialized")
	}

	// Check cached token
	if p.cachedToken != "" && time.Now().Before(p.tokenExpiry) {
		token := p.cachedToken
		p.mu.Unlock()
		return token, nil
	}

	// Wait if another login is in progress
	if p.loginInProg {
		p.mu.Unlock()
		// Brief wait and retry
		select {
		case <-time.After(100 * time.Millisecond):
		case <-ctx.Done():
			return "", ctx.Err()
		}
		return p.GetToken(ctx)
	}

	p.loginInProg = true
	p.mu.Unlock()

	token, err := p.doLogin(ctx)
	p.mu.Lock()
	p.loginInProg = false
	if err != nil {
		p.mu.Unlock()
		return "", err
	}
	p.cachedToken = token
	p.tokenExpiry = time.Now().Add(23 * time.Hour)
	p.mu.Unlock()
	return token, nil
}

func (p *PandaWikiTokenService) doLogin(ctx context.Context) (string, error) {
	p.mu.Lock()
	cfg := p.config
	p.mu.Unlock()
	if cfg == nil {
		return "", fmt.Errorf("PandaWiki auth not initialized")
	}

	loginURL := strings.TrimSuffix(cfg.TargetURL, "/") + "/api/v1/user/login"
	body := fmt.Sprintf(`{"account":%q,"password":%q}`, cfg.Account, cfg.Password)

	req, err := http.NewRequestWithContext(ctx, "POST", loginURL, strings.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create login request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("login request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var result pandawikiResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("parse login response: %w", err)
	}

	if !result.Success {
		return "", fmt.Errorf("PandaWiki login failed: %s", result.Message)
	}
	if result.Data.Token == "" {
		return "", fmt.Errorf("PandaWiki login response missing token")
	}

	return result.Data.Token, nil
}

// InvalidateToken clears the cached token.
func (p *PandaWikiTokenService) InvalidateToken() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.cachedToken = ""
	p.tokenExpiry = time.Time{}
}

// --- Token Exchange Middleware ---

// ServiceTokenConfig defines how to obtain a token for a target service.
type ServiceTokenConfig struct {
	TargetURL        string
	ServiceType      string // "pandawiki" or "static"
	StaticToken      string
	PandaWikiAccount  string
	PandaWikiPassword string
}

// TokenExchangeService manages token exchange for multiple services.
type TokenExchangeService struct {
	mu       sync.RWMutex
	rules    map[string]*ServiceTokenConfig
	pandawiki *PandaWikiTokenService
}

// NewTokenExchangeService creates a token exchange service.
func NewTokenExchangeService() *TokenExchangeService {
	return &TokenExchangeService{
		rules:     make(map[string]*ServiceTokenConfig),
		pandawiki: NewPandaWikiTokenService(),
	}
}

// Register adds a token exchange rule.
func (t *TokenExchangeService) Register(prefix string, cfg ServiceTokenConfig) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.rules[prefix] = &cfg
	if cfg.ServiceType == "pandawiki" && cfg.PandaWikiAccount != "" {
		t.pandawiki.InitAuth(PandaWikiLoginConfig{
			TargetURL: cfg.TargetURL,
			Account:   cfg.PandaWikiAccount,
			Password:  cfg.PandaWikiPassword,
		})
	}
}

// GetServiceToken returns a token for the matching prefix.
func (t *TokenExchangeService) GetServiceToken(ctx context.Context, path string) (string, error) {
	t.mu.RLock()
	for prefix, cfg := range t.rules {
		if strings.HasPrefix(path, prefix) {
			t.mu.RUnlock()
			return t.fetchToken(ctx, cfg)
		}
	}
	t.mu.RUnlock()
	return "", nil
}

func (t *TokenExchangeService) fetchToken(ctx context.Context, cfg *ServiceTokenConfig) (string, error) {
	switch cfg.ServiceType {
	case "pandawiki":
		token, err := t.pandawiki.GetToken(ctx)
		if err != nil {
			t.pandawiki.InvalidateToken()
			return t.pandawiki.GetToken(ctx)
		}
		return token, nil
	case "static":
		return cfg.StaticToken, nil
	default:
		return "", fmt.Errorf("no valid token configuration")
	}
}

// GetPrefixes returns registered path prefixes.
func (t *TokenExchangeService) GetPrefixes() []string {
	t.mu.RLock()
	defer t.mu.RUnlock()
	result := make([]string, 0, len(t.rules))
	for prefix := range t.rules {
		result = append(result, prefix)
	}
	return result
}

// Clear removes all token exchange rules.
func (t *TokenExchangeService) Clear() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.rules = make(map[string]*ServiceTokenConfig)
}
