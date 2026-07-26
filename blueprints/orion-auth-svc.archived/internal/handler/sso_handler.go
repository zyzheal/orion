package handler

import (
	"context"
	"net/http"

	"orion/auth-svc/internal/sso"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// SSOHandler handles SSO/OIDC authentication endpoints.
type SSOHandler struct {
	oidcProvider *sso.OIDCProvider
	ldapClient   *sso.LDAPClient
	wechatClient *sso.WeChatOAuthClient
	logger       *zap.Logger

	// Callback to create/find user and issue tokens after SSO authentication.
	// Returns (accessToken, refreshToken, expiresIn, error).
	tokenIssuer func(ctx context.Context, tenantID, email, username, source string) (accessToken, refreshToken string, expiresIn int, err error)
}

// SSOConfig holds SSO handler configuration.
type SSOConfig struct {
	OIDC    sso.OIDCConfig
	LDAP    sso.LDAPConfig
	WeChat  sso.WeChatConfig
	Logger  *zap.Logger
}

// NewSSOHandler creates a new SSO handler.
func NewSSOHandler(cfg SSOConfig, tokenIssuer func(ctx context.Context, tenantID, email, username, source string) (string, string, int, error)) *SSOHandler {
	h := &SSOHandler{
		logger:      cfg.Logger,
		tokenIssuer: tokenIssuer,
	}

	if cfg.OIDC.Issuer != "" {
		h.oidcProvider = sso.NewOIDCProvider(cfg.OIDC)
	}
	if cfg.LDAP.URL != "" {
		h.ldapClient = sso.NewLDAPClient(cfg.LDAP)
	}
	if cfg.WeChat.AppID != "" {
		h.wechatClient = sso.NewWeChatOAuthClient(cfg.WeChat)
	}

	return h
}

// --- OIDC Endpoints ---

// OIDCLoginRedirect redirects the user to the OIDC provider's authorization endpoint.
// GET /auth/sso/oidc/login?tenant_id=xxx
func (h *SSOHandler) OIDCLoginRedirect(c *gin.Context) {
	if h.oidcProvider == nil {
		h.err(c, http.StatusServiceUnavailable, "OIDC not configured")
		return
	}

	tenantID := c.Query("tenant_id")
	state, err := sso.GenerateState()
	if err != nil {
		h.logger.Error("failed to generate state", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	// Store state in a short-lived cookie for CSRF protection
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("oidc_state", state, 300, "/", "", false, true)

	if tenantID != "" {
		c.SetCookie("oidc_tenant", tenantID, 300, "/", "", false, true)
	}

	authURL := h.oidcProvider.AuthCodeURL(state)
	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// OIDCCallback handles the OIDC provider's callback with the authorization code.
// GET /auth/sso/oidc/callback?code=xxx&state=xxx
func (h *SSOHandler) OIDCCallback(c *gin.Context) {
	if h.oidcProvider == nil {
		h.err(c, http.StatusServiceUnavailable, "OIDC not configured")
		return
	}

	// Verify state parameter (CSRF protection)
	state := c.Query("state")
	expectedState, _ := c.Cookie("oidc_state")
	c.SetCookie("oidc_state", "", -1, "/", "", false, true) // clear cookie
	if state == "" || state != expectedState {
		h.err(c, http.StatusBadRequest, "invalid state parameter")
		return
	}

	code := c.Query("code")
	if code == "" {
		h.err(c, http.StatusBadRequest, "missing authorization code")
		return
	}

	// Exchange code for tokens
	tokenResp, err := h.oidcProvider.Exchange(c.Request.Context(), code)
	if err != nil {
		h.logger.Warn("OIDC token exchange failed", zap.Error(err))
		h.err(c, http.StatusUnauthorized, "token exchange failed")
		return
	}

	// Fetch user info
	userInfo, err := h.oidcProvider.GetUserInfo(c.Request.Context(), tokenResp.AccessToken)
	if err != nil {
		h.logger.Warn("OIDC userinfo fetch failed", zap.Error(err))
		h.err(c, http.StatusUnauthorized, "failed to get user info")
		return
	}

	if userInfo.Email == "" {
		h.err(c, http.StatusBadRequest, "OIDC provider did not return an email")
		return
	}

	tenantID, _ := c.Cookie("oidc_tenant")
	c.SetCookie("oidc_tenant", "", -1, "/", "", false, true)

	username := userInfo.PreferredUsername
	if username == "" {
		username = userInfo.Name
	}

	// Issue tokens via callback
	accessToken, refreshToken, expiresIn, err := h.tokenIssuer(c.Request.Context(), tenantID, userInfo.Email, username, "oidc")
	if err != nil {
		h.logger.Error("failed to issue tokens after OIDC login", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "authentication failed")
		return
	}

	// Set HttpOnly cookies
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie("access_token", accessToken, expiresIn, "/", "", false, true)
	c.SetCookie("refresh_token", refreshToken, 7*24*3600, "/", "", false, true)

	h.success(c, gin.H{
		"expires_in": expiresIn,
		"token_type": "Bearer",
		"source":     "oidc",
	})
}

// OIDCProviders returns the list of configured OIDC providers.
// GET /auth/sso/oidc/providers
func (h *SSOHandler) OIDCProviders(c *gin.Context) {
	providers := []gin.H{}
	if h.oidcProvider != nil {
		providers = append(providers, gin.H{
			"name":   "oidc",
			"issuer": h.oidcProvider.Issuer(),
		})
	}
	if h.ldapClient != nil {
		providers = append(providers, gin.H{"name": "ldap"})
	}
	if h.wechatClient != nil {
		providers = append(providers, gin.H{"name": "wechat"})
	}
	h.success(c, providers)
}

// --- LDAP Endpoint ---

// LDAPLogin authenticates a user via LDAP.
// POST /auth/sso/ldap/login
func (h *SSOHandler) LDAPLogin(c *gin.Context) {
	if h.ldapClient == nil {
		h.err(c, http.StatusServiceUnavailable, "LDAP not configured")
		return
	}

	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
		TenantID string `json:"tenant_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	user, err := h.ldapClient.Authenticate(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		h.logger.Warn("LDAP authentication failed",
			zap.String("username", req.Username),
			zap.Error(err),
		)
		h.err(c, http.StatusUnauthorized, "LDAP authentication failed")
		return
	}

	accessToken, refreshToken, expiresIn, err := h.tokenIssuer(c.Request.Context(), req.TenantID, user.Email, user.Username, "ldap")
	if err != nil {
		h.logger.Error("failed to issue tokens after LDAP login", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "authentication failed")
		return
	}

	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie("access_token", accessToken, expiresIn, "/", "", false, true)
	c.SetCookie("refresh_token", refreshToken, 7*24*3600, "/", "", false, true)

	h.success(c, gin.H{
		"expires_in": expiresIn,
		"token_type": "Bearer",
		"source":     "ldap",
	})
}

// --- WeChat Endpoint ---

// WechatLoginRedirect redirects to WeChat OAuth authorization page.
// GET /auth/sso/wechat/login?tenant_id=xxx
func (h *SSOHandler) WechatLoginRedirect(c *gin.Context) {
	if h.wechatClient == nil {
		h.err(c, http.StatusServiceUnavailable, "WeChat OAuth not configured")
		return
	}

	state, err := sso.GenerateState()
	if err != nil {
		h.logger.Error("failed to generate state", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("wechat_state", state, 300, "/", "", false, true)

	tenantID := c.Query("tenant_id")
	if tenantID != "" {
		c.SetCookie("wechat_tenant", tenantID, 300, "/", "", false, true)
	}

	authURL := h.wechatClient.AuthCodeURL(state)
	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// WechatCallback handles WeChat OAuth callback.
// GET /auth/sso/wechat/callback?code=xxx&state=xxx
func (h *SSOHandler) WechatCallback(c *gin.Context) {
	if h.wechatClient == nil {
		h.err(c, http.StatusServiceUnavailable, "WeChat OAuth not configured")
		return
	}

	state := c.Query("state")
	expectedState, _ := c.Cookie("wechat_state")
	c.SetCookie("wechat_state", "", -1, "/", "", false, true)
	if state == "" || state != expectedState {
		h.err(c, http.StatusBadRequest, "invalid state parameter")
		return
	}

	code := c.Query("code")
	if code == "" {
		h.err(c, http.StatusBadRequest, "missing authorization code")
		return
	}

	// Exchange code for access token
	tokenResp, err := h.wechatClient.Exchange(c.Request.Context(), code)
	if err != nil {
		h.logger.Warn("WeChat token exchange failed", zap.Error(err))
		h.err(c, http.StatusUnauthorized, "token exchange failed")
		return
	}

	// Get user info
	userInfo, err := h.wechatClient.GetUserInfo(c.Request.Context(), tokenResp.AccessToken, tokenResp.OpenID)
	if err != nil {
		h.logger.Warn("WeChat userinfo fetch failed", zap.Error(err))
		h.err(c, http.StatusUnauthorized, "failed to get user info")
		return
	}

	tenantID, _ := c.Cookie("wechat_tenant")
	c.SetCookie("wechat_tenant", "", -1, "/", "", false, true)

	email := userInfo.OpenID + "@wechat.orion.local"
	username := userInfo.Nickname

	accessToken, refreshToken, expiresIn, err := h.tokenIssuer(c.Request.Context(), tenantID, email, username, "wechat")
	if err != nil {
		h.logger.Error("failed to issue tokens after WeChat login", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "authentication failed")
		return
	}

	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie("access_token", accessToken, expiresIn, "/", "", false, true)
	c.SetCookie("refresh_token", refreshToken, 7*24*3600, "/", "", false, true)

	h.success(c, gin.H{
		"expires_in": expiresIn,
		"token_type": "Bearer",
		"source":     "wechat",
	})
}

// --- WeChat Work Endpoints ---

// WechatWorkLoginRedirect redirects to WeChat Work OAuth authorization page.
// GET /auth/sso/wechat-work/login?tenant_id=xxx
func (h *SSOHandler) WechatWorkLoginRedirect(c *gin.Context) {
	if h.wechatClient == nil {
		h.err(c, http.StatusServiceUnavailable, "WeChat Work OAuth not configured")
		return
	}

	state, err := sso.GenerateState()
	if err != nil {
		h.logger.Error("failed to generate state", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("wechat_work_state", state, 300, "/", "", false, true)

	tenantID := c.Query("tenant_id")
	if tenantID != "" {
		c.SetCookie("wechat_work_tenant", tenantID, 300, "/", "", false, true)
	}

	authURL := h.wechatClient.WorkAuthCodeURL(state)
	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// WechatWorkCallback handles WeChat Work OAuth callback.
// GET /auth/sso/wechat-work/callback?code=xxx&state=xxx
func (h *SSOHandler) WechatWorkCallback(c *gin.Context) {
	if h.wechatClient == nil {
		h.err(c, http.StatusServiceUnavailable, "WeChat Work OAuth not configured")
		return
	}

	state := c.Query("state")
	expectedState, _ := c.Cookie("wechat_work_state")
	c.SetCookie("wechat_work_state", "", -1, "/", "", false, true)
	if state == "" || state != expectedState {
		h.err(c, http.StatusBadRequest, "invalid state parameter")
		return
	}

	code := c.Query("code")
	if code == "" {
		h.err(c, http.StatusBadRequest, "missing authorization code")
		return
	}

	// Get user info via WeChat Work API (internally fetches + caches access token)
	userInfo, err := h.wechatClient.GetWorkUserInfo(c.Request.Context(), code)
	if err != nil {
		h.logger.Warn("WeChat Work userinfo fetch failed", zap.Error(err))
		h.err(c, http.StatusUnauthorized, "failed to get user info")
		return
	}

	tenantID, _ := c.Cookie("wechat_work_tenant")
	c.SetCookie("wechat_work_tenant", "", -1, "/", "", false, true)

	email := userInfo.Email
	if email == "" {
		email = userInfo.UserID + "@wechat-work.orion.local"
	}
	username := userInfo.Name

	accessToken, refreshToken, expiresIn, err := h.tokenIssuer(c.Request.Context(), tenantID, email, username, "wechat_work")
	if err != nil {
		h.logger.Error("failed to issue tokens after WeChat Work login", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "authentication failed")
		return
	}

	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie("access_token", accessToken, expiresIn, "/", "", false, true)
	c.SetCookie("refresh_token", refreshToken, 7*24*3600, "/", "", false, true)

	h.success(c, gin.H{
		"expires_in": expiresIn,
		"token_type": "Bearer",
		"source":     "wechat_work",
	})
}

// --- Helpers ---

func (h *SSOHandler) success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Code: 0, Message: "success", Data: data})
}

func (h *SSOHandler) err(c *gin.Context, code int, message string) {
	c.JSON(code, Response{Code: code, Message: message})
}
