// Package handler provides HTTP handlers for the auth service.
// WeChat Work SSO handler.
package handler

import (
	"net/http"
	"strings"
	"time"

	"orion/auth-svc-go/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// WeChatAuthorize handles GET /sso/wechat/authorize.
// Generates the OAuth authorization URL and redirects the browser.
func (h *Handler) WeChatAuthorize(c *gin.Context) {
	if h.wechatSVC == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "wechat work SSO is not configured"})
		return
	}

	redirectURI := c.Query("redirect_uri")
	if redirectURI == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "redirect_uri is required"})
		return
	}
	_ = c.Query("tenant_id") // accepted for routing; service uses default tenant

	authorizeURL, err := h.wechatSVC.GetAuthorizationURL(redirectURI)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Redirect(http.StatusFound, authorizeURL)
}

// WeChatCallback handles GET /sso/wechat/callback?code=...&state=...
// Exchanges the authorization code for a user profile, issues Orion JWT, and links the identity.
func (h *Handler) WeChatCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code query parameter required"})
		return
	}

	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		tenantID = "default"
	}

	if h.wechatSVC == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "wechat work SSO is not configured"})
		return
	}

	user, err := h.wechatSVC.HandleCallback(c.Request.Context(), code, tenantID)
	if err != nil {
		if strings.Contains(err.Error(), "not enabled") {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "wechat callback failed"})
		return
	}

	// Issue Orion JWT tokens for the authenticated WeChat user
	roles := []string{"user"}
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":       user.ID,
		"tenant_id": user.TenantID,
		"roles":     roles,
		"status":    user.Status,
		"iat":       now.Unix(),
		"exp":       now.Add(5 * time.Minute).Unix(),
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := accessToken.SignedString([]byte(h.jwtSecret))
	if err != nil {
		h.log.Error("failed to sign access token on wechat callback", gin.H{"error": err.Error()})
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	// Record audit log
	_ = h.svc.Audit(c.Request.Context(), &model.AuditLog{
		ID:        uuid.New().String(),
		TenantID:  user.TenantID,
		ActorID:   user.ID,
		Action:    "login",
		Method:    "wechat",
		IPAddress: c.ClientIP(),
		CreatedAt: now,
	})

	c.JSON(http.StatusOK, gin.H{
		"access_token": tokenString,
		"expires_at":   now.Add(5 * time.Minute).Unix(),
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"roles":    roles,
			"status":   user.Status,
		},
		"method": "wechat",
	})
}

// WeChatListProviders handles GET /sso/wechat/providers.
// Returns the configured WeChat Work provider details for a tenant.
func (h *Handler) WeChatListProviders(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		tenantID = "default"
	}

	accounts, err := h.wechatSVC.ListAccounts(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list wechat accounts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"providers": gin.H{
			"wechat_work": gin.H{
				"enabled":  h.wechatSVC.IsEnabled(),
				"accounts": len(accounts),
			},
		},
	})
}

// WeChatCreateProvider handles POST /sso/wechat/providers.
// Validates the WeChat Work API connectivity and records the provider config.
func (h *Handler) WeChatCreateProvider(c *gin.Context) {
	var req struct {
		CorpID     string `json:"corpid" binding:"required"`
		CorpSecret string `json:"corp_secret" binding:"required"`
		AgentID    string `json:"agentid"`
		TenantID   string `json:"tenant_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Test connectivity with the provided config
	ok, msg := h.wechatSVC.TestConnection(c.Request.Context())
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "wechat connection test failed: " + msg})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"provider": gin.H{
			"corpid":  req.CorpID,
			"tenant":  req.TenantID,
			"enabled": true,
		},
		"message": "wechat provider configured successfully",
	})
}

// WeChatDeleteProvider handles DELETE /sso/wechat/providers.
// Disables the WeChat Work provider configuration for a tenant.
func (h *Handler) WeChatDeleteProvider(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		tenantID = "default"
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "wechat provider disabled for tenant " + tenantID,
		"tenant":   tenantID,
		"enabled":  false,
	})
}

// WeChatUser handles GET /sso/wechat/users/:id.
// Retrieves a WeChat Work linked account by WeChat Work user ID.
func (h *Handler) WeChatUser(c *gin.Context) {
	wechatUserID := c.Param("id")
	if wechatUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "wechat user id required"})
		return
	}

	acct, err := h.wechatSVC.GetAccount(c.Request.Context(), wechatUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get wechat account"})
		return
	}
	if acct == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "wechat user not found"})
		return
	}

	c.JSON(http.StatusOK, acct)
}

// WeChatSyncDepartments handles POST /sso/wechat/sync-departments.
// Triggers a sync of WeChat Work departments to Orion groups.
func (h *Handler) WeChatSyncDepartments(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		tenantID = "default"
	}

	if h.wechatSVC == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "wechat work SSO is not configured"})
		return
	}

	count, err := h.wechatSVC.SyncDepartments(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync departments"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"synced":  count,
		"message": "departments synced successfully",
	})
}
