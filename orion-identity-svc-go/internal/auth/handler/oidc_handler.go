// Package handler provides HTTP handlers for the auth service.
// OIDC handler added below existing auth handlers.
package handler

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"orion/identity-svc-go/internal/auth/fieldencryption"
	"orion/identity-svc-go/internal/auth/model"
	"orion/identity-svc-go/internal/auth/ssosvc"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// OIDCStatePayload mirrors ssosvc.SSOStatePayload for unmarshaling in this package.
type oidcStatePayload struct {
	Nonce        string `json:"nonce"`
	CodeVerifier string `json:"code_verifier"`
}

// --- OIDC SSO Handlers ---

// OIDCAuthorize handles GET /sso/oidc/authorize?provider=<name>.
// Initiates the OIDC authorization flow by redirecting to the provider's auth endpoint.
func (h *Handler) OIDCAuthorize(c *gin.Context) {
	providerName := c.Query("provider")
	if providerName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider query parameter required"})
		return
	}

	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		tenantID = "default"
	}

	cfg, err := h.oidcSVC.ProviderConfig(c.Request.Context(), tenantID, providerName)
	if err != nil {
		h.log.Error("OIDC provider config failed", zap.Error(err), zap.String("provider", providerName))
		c.JSON(http.StatusNotFound, gin.H{"error": "provider not found or disabled"})
		return
	}

	disc, err := h.oidcSVC.Discover(c.Request.Context(), *cfg)
	if err != nil {
		h.log.Error("OIDC discovery failed", zap.Error(err), zap.String("provider", providerName))
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to discover OIDC provider"})
		return
	}

	authorizeURL, state, codeVerifier, err := h.oidcSVC.BuildAuthorizeURL(*cfg, disc)
	if err != nil {
		h.log.Error("OIDC authorize URL build failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build authorization URL"})
		return
	}

	// Persist state payload in DB for callback validation
	payload, _ := json.Marshal(oidcStatePayload{Nonce: state, CodeVerifier: codeVerifier})
	err = h.oidcRepo.CreateSSOState(c.Request.Context(), &model.SSOState{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		State:        state,
		ProviderName: providerName,
		Data:         string(payload),
		ExpiresAt:    time.Now().Add(time.Duration(ssosvc.StateTTLMinutes) * time.Minute),
		CreatedAt:    time.Now(),
	})
	if err != nil {
		h.log.Error("failed to store SSO state", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initialize SSO session"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"authorize_url": authorizeURL,
		"state":         state,
		"provider":      providerName,
	})
}

// OIDCCallback handles GET /sso/oidc/callback?code=...&state=...
// Completes the OAuth2 flow by exchanging the code for tokens and linking the identity.
func (h *Handler) OIDCCallback(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")
	providerName := c.Query("provider")
	tenantID := c.Query("tenant_id")

	if code == "" || state == "" || providerName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code, state, and provider parameters required"})
		return
	}
	if tenantID == "" {
		tenantID = "default"
	}

	// Retrieve stored state
	ssoState, err := h.oidcRepo.GetSSOState(c.Request.Context(), tenantID, state)
	if ssoState == nil || err != nil {
		h.log.Error("SSO state lookup failed", zap.Error(err), zap.String("state", state))
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired SSO state"})
		return
	}

	// Clean up the state entry
	_ = h.oidcRepo.DeleteSSOState(c.Request.Context(), tenantID, state)

	var payload oidcStatePayload
	if err := json.Unmarshal([]byte(ssoState.Data), &payload); err != nil {
		h.log.Error("invalid SSO state payload", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid SSO state payload"})
		return
	}

	// Get provider config
	cfg, err := h.oidcSVC.ProviderConfig(c.Request.Context(), tenantID, providerName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "provider not found"})
		return
	}

	// Discover endpoints
	disc, err := h.oidcSVC.Discover(c.Request.Context(), *cfg)
	if err != nil {
		h.log.Error("OIDC discovery failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to discover OIDC provider"})
		return
	}

	// Exchange authorization code for tokens
	tokens, err := h.oidcSVC.ExchangeToken(c.Request.Context(), *cfg, disc, code, payload.CodeVerifier)
	if err != nil {
		h.log.Error("OIDC token exchange failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": "token exchange failed"})
		return
	}

	// Retrieve user info — prefer userinfo endpoint, fall back to ID token claims
	var userInfo *ssosvc.OIDCUserInfo
	if disc.UserInfoURL != "" {
		userInfo, err = h.oidcSVC.FetchUserInfo(c.Request.Context(), disc, tokens.AccessToken)
	}
	if userInfo == nil && tokens.IDToken != "" {
		// Fallback: parse claims from ID token
		parsed, parseErr := h.oidcSVC.ParseIDTokenClaims(tokens.IDToken)
		if parseErr == nil {
			userInfo = parsed
		} else {
			h.log.Warn("ID token parse fallback failed", zap.Error(parseErr))
		}
	}
	if userInfo == nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to retrieve user identity"})
		return
	}

	if userInfo.Subject == "" {
		c.JSON(http.StatusBadGateway, gin.H{"error": "missing subject in OIDC response"})
		return
	}

	// Resolve or link the user
	_, existingUser, err := h.oidcSVC.ResolveOrLinkUser(c.Request.Context(), tenantID, providerName, userInfo)
	if err != nil {
		h.log.Error("OIDC user resolution failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user identity"})
		return
	}

	if existingUser == nil {
		// No existing account linked — return OIDC profile for the caller to decide
		// (e.g., auto-create or show account creation form)
		c.JSON(http.StatusOK, gin.H{
			"needs_registration": true,
			"oidc_profile": gin.H{
				"subject": userInfo.Subject,
				"email":   userInfo.Email,
				"name":    userInfo.Name,
				"groups":  userInfo.Groups,
				"roles":   userInfo.Roles,
			},
			"provider": providerName,
		})
		return
	}

	// Existing user found — issue Orion JWT tokens
	roles := auth.GetRoles(c)
	if len(roles) == 0 {
		roles = []string{"user"}
	}
	roles = append(roles, existingUser.Status) // carry status for downstream checks

	now := time.Now()
	claims := jwt.MapClaims{
		"sub":       existingUser.ID,
		"tenant_id": existingUser.TenantID,
		"roles":     roles,
		"status":    existingUser.Status,
		"iat":       now.Unix(),
		"exp":       now.Add(5 * time.Minute).Unix(),
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := accessToken.SignedString([]byte(h.jwtSecret))
	if err != nil {
		h.log.Error("failed to sign access token on OIDC callback", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	// Record audit log
	_ = h.svc.Audit(c.Request.Context(), &model.AuditLog{
		ID:        uuid.New().String(),
		TenantID:  existingUser.TenantID,
		ActorID:   existingUser.ID,
		Action:    "login",
		IPAddress: c.ClientIP(),
		CreatedAt: now,
	})

	c.JSON(http.StatusOK, gin.H{
		"access_token":  tokenString,
		"expires_at":    now.Add(5 * time.Minute).Unix(),
		"needs_registration": false,
		"user": gin.H{
			"id":       existingUser.ID,
			"username": existingUser.Username,
			"email":    existingUser.Email,
			"roles":    roles,
			"status":   existingUser.Status,
		},
	})
}

// OIDCListProviders handles GET /sso/oidc/providers.
func (h *Handler) OIDCListProviders(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		tenantID = auth.GetTenantID(c)
		if tenantID == "" {
			tenantID = "default"
		}
	}

	providers, err := h.oidcSVC.ListProviders(c.Request.Context(), tenantID)
	if err != nil {
		h.log.Error("failed to list providers", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	// Sanitize: remove client_secret from response
	safe := make([]gin.H, 0, len(providers))
	for _, p := range providers {
		safe = append(safe, gin.H{
			"id":            p.ID,
			"tenant_id":     p.TenantID,
			"name":          p.Name,
			"display_name":  p.DisplayName,
			"issuer_url":    p.IssuerURL,
			"redirect_uri":  p.RedirectURI,
			"scopes":        p.Scopes,
			"enabled":       p.Enabled,
			"created_at":    p.CreatedAt,
			"updated_at":    p.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"providers": safe})
}

// OIDCCreateProvider handles POST /sso/oidc/providers.
type createProviderRequest struct {
	Name           string `json:"name" binding:"required"`
	DisplayName    string `json:"display_name" binding:"required"`
	IssuerURL      string `json:"issuer_url" binding:"required"`
	ClientID       string `json:"client_id" binding:"required"`
	ClientSecret   string `json:"client_secret" binding:"required"`
	RedirectURI    string `json:"redirect_uri" binding:"required"`
	Scopes         string `json:"scopes"`
	Enabled        bool   `json:"enabled"`
}

func (h *Handler) OIDCCreateProvider(c *gin.Context) {
	var req createProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate issuer URL
	if _, err := url.Parse(req.IssuerURL); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid issuer_url"})
		return
	}

	tenantID := auth.GetTenantID(c)
	if tenantID == "" {
		tenantID = "default"
	}

	// Encrypt client secret before storage using global encryption key
	encSecret, err := fieldencryption.EncryptWithGlobalEncrypt(req.ClientSecret)
	if err != nil {
		h.log.Error("failed to encrypt client secret", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	now := time.Now()
	p := model.OIDCProvider{
		ID:                    uuid.New().String(),
		TenantID:              tenantID,
		Name:                  strings.ToLower(strings.ReplaceAll(req.Name, " ", "-")),
		DisplayName:           req.DisplayName,
		IssuerURL:             strings.TrimRight(req.IssuerURL, "/"),
		ClientID:              req.ClientID,
		ClientSecretEncrypted: encSecret,
		RedirectURI:           req.RedirectURI,
		Scopes:                req.Scopes,
		Enabled:               req.Enabled,
		CreatedAt:             now,
		UpdatedAt:             now,
	}
	if p.Scopes == "" {
		p.Scopes = "openid email profile"
	}

	err = h.oidcRepo.CreateProvider(c.Request.Context(), &p)
	if err != nil {
		h.log.Error("failed to create provider", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "provider already exists or internal error"})
		return
	}

	safe := gin.H{
		"id":            p.ID,
		"tenant_id":     p.TenantID,
		"name":          p.Name,
		"display_name":  p.DisplayName,
		"issuer_url":    p.IssuerURL,
		"redirect_uri":  p.RedirectURI,
		"scopes":        p.Scopes,
		"enabled":       p.Enabled,
		"created_at":    p.CreatedAt,
		"updated_at":    p.UpdatedAt,
	}

	c.JSON(http.StatusCreated, safe)
}

// OIDCUpdateProvider handles PUT /sso/oidc/providers/:id.
type updateProviderRequest struct {
	DisplayName    string `json:"display_name"`
	IssuerURL      string `json:"issuer_url"`
	ClientID       string `json:"client_id"`
	ClientSecret   string `json:"client_secret"`
	RedirectURI    string `json:"redirect_uri"`
	Scopes         string `json:"scopes"`
	Enabled        *bool  `json:"enabled"` // pointer to detect null
}

func (h *Handler) OIDCUpdateProvider(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider id required"})
		return
	}

	var req updateProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	p, err := h.oidcRepo.GetProviderByID(c.Request.Context(), id)
	if err != nil {
		h.log.Error("failed to get provider", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "provider not found"})
		return
	}

	// Apply updates
	if req.DisplayName != "" {
		p.DisplayName = req.DisplayName
	}
	if req.IssuerURL != "" {
		if _, err := url.Parse(req.IssuerURL); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid issuer_url"})
			return
		}
		p.IssuerURL = strings.TrimRight(req.IssuerURL, "/")
	}
	if req.ClientID != "" {
		p.ClientID = req.ClientID
	}
	if req.ClientSecret != "" {
		encSecret, err := fieldencryption.Encrypt(req.ClientSecret)
		if err != nil {
			h.log.Error("failed to encrypt client secret", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
			return
		}
		p.ClientSecretEncrypted = encSecret
	}
	if req.RedirectURI != "" {
		p.RedirectURI = req.RedirectURI
	}
	if req.Scopes != "" {
		p.Scopes = req.Scopes
	}
	if req.Enabled != nil {
		p.Enabled = *req.Enabled
	}

	p.UpdatedAt = time.Now()

	if err := h.oidcRepo.UpdateProvider(c.Request.Context(), p); err != nil {
		h.log.Error("failed to update provider", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	safe := gin.H{
		"id":            p.ID,
		"tenant_id":     p.TenantID,
		"name":          p.Name,
		"display_name":  p.DisplayName,
		"issuer_url":    p.IssuerURL,
		"redirect_uri":  p.RedirectURI,
		"scopes":        p.Scopes,
		"enabled":       p.Enabled,
		"created_at":    p.CreatedAt,
		"updated_at":    p.UpdatedAt,
	}

	c.JSON(http.StatusOK, safe)
}

// OIDCDeleteProvider handles DELETE /sso/oidc/providers/:id.
func (h *Handler) OIDCDeleteProvider(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider id required"})
		return
	}

	p, err := h.oidcRepo.GetProviderByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "provider not found"})
		return
	}

	// Also clean up associated user links
	links, _ := h.oidcRepo.GetLinkByUserID(c.Request.Context(), p.TenantID, p.ID)
	for _, l := range links {
		_ = h.oidcRepo.DeleteLink(c.Request.Context(), l.ID)
	}

	if err := h.oidcRepo.DeleteProvider(c.Request.Context(), id); err != nil {
		h.log.Error("failed to delete provider", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.Status(http.StatusOK)
}

// OIDCGetProvider handles GET /sso/oidc/providers/:id.
func (h *Handler) OIDCGetProvider(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider id required"})
		return
	}

	p, err := h.oidcRepo.GetProviderByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "provider not found"})
		return
	}

	safe := gin.H{
		"id":            p.ID,
		"tenant_id":     p.TenantID,
		"name":          p.Name,
		"display_name":  p.DisplayName,
		"issuer_url":    p.IssuerURL,
		"redirect_uri":  p.RedirectURI,
		"scopes":        p.Scopes,
		"enabled":       p.Enabled,
		"created_at":    p.CreatedAt,
		"updated_at":    p.UpdatedAt,
	}

	c.JSON(http.StatusOK, safe)
}

// OIDCListLinks handles GET /sso/oidc/links?user_id=<id>.
func (h *Handler) OIDCListLinks(c *gin.Context) {
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter required"})
		return
	}

	tenantID := auth.GetTenantID(c)
	if tenantID == "" {
		tenantID = "default"
	}

	links, err := h.oidcRepo.GetLinkByUserID(c.Request.Context(), tenantID, userID)
	if err != nil {
		h.log.Error("failed to list OIDC links", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"links": links})
}

// OIDCDeleteLink handles DELETE /sso/oidc/links/:id.
func (h *Handler) OIDCDeleteLink(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "link id required"})
		return
	}

	if err := h.oidcRepo.DeleteLink(c.Request.Context(), id); err != nil {
		h.log.Error("failed to delete OIDC link", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.Status(http.StatusOK)
}
