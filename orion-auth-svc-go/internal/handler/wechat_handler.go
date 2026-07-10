package handler

import (
	"net/http"

	"orion/auth-svc-go/internal/model"
	"orion/auth-svc-go/internal/wechat"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// --- WeChat Work SSO Handlers ---

// WeChatAuthorize handles GET /sso/wechat/authorize.
// Generates an OAuth authorization redirect URL for WeChat Work SSO.
func (h *Handler) WeChatAuthorize(c *gin.Context) {
	if !h.wechatSVC.IsEnabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "wechat work SSO is not enabled"})
		return
	}

	redirectURI := c.Query("redirect_uri")
	if redirectURI == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "redirect_uri query parameter required"})
		return
	}

	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		tenantID = "default"
	}

	authorizeURL, err := h.wechatSVC.GetAuthorizationURL(redirectURI)
	if err != nil {
		h.log.Error("wechat authorize failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build authorization URL"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"authorize_url": authorizeURL,
		"redirect_uri":  redirectURI,
		"tenant_id":     tenantID,
	})
}

// WeChatCallback handles GET/POST /sso/wechat/callback?code=...&state=...
// Completes the WeChat Work OAuth flow by exchanging the code for a user profile
// and linking the identity to a local Orion user.
func (h *Handler) WeChatCallback(c *gin.Context) {
	if !h.wechatSVC.IsEnabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "wechat work SSO is not enabled"})
		return
	}

	code := c.Query("code")
	if code == "" {
		// Fallback: read code from POST body for callback redirectors that POST
		var req struct {
			Code string `json:"code" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "code query parameter required"})
			return
		}
		code = req.Code
	}

	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		tenantID = "default"
	}

	user, err := h.wechatSVC.HandleCallback(c.Request.Context(), code, tenantID)
	if err != nil {
		h.log.Error("wechat callback failed", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Issue Orion JWT tokens for the authenticated user
	roles := []string{"user"}
	now := c.Request.Context().Deadline().Time

	claims := jwt.MapClaims{
		"sub":       user.ID,
		"tenant_id": user.TenantID,
		"roles":     roles,
		"status":    user.Status,
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := accessToken.SignedString([]byte(h.jwtSecret))
	if err != nil {
		h.log.Error("failed to sign access token on wechat callback", zap.Error(err))
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
	})

	c.JSON(http.StatusOK, gin.H{
		"access_token": tokenString,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"roles":    roles,
			"status":   user.Status,
		},
	})
}

// WeChatProviders handles GET/POST /sso/wechat/providers.
// GET returns WeChat Work configuration status; POST tests connectivity.
func (h *Handler) WeChatProviders(c *gin.Context) {
	ctx := c.Request.Context()

	switch c.Request.Method {
	case "POST":
		// Test connectivity to WeChat Work API
		ok, msg := h.wechatSVC.TestConnection(ctx)
		c.JSON(http.StatusOK, gin.H{
			"connected": ok,
			"message":   msg,
		})

	case "GET":
		fallthrough
	default:
		enabled := h.wechatSVC.IsEnabled()
		c.JSON(http.StatusOK, gin.H{
			"provider": "wechat_work",
			"enabled":  enabled,
			"name":     "企业微信 SSO",
		})
	}
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
		h.log.Error("wechat user lookup failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if acct == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "wechat user not found"})
		return
	}

	// Build safe response (omit sensitive fields)
	resp := gin.H{
		"id":              acct.ID,
		"tenant_id":       acct.TenantID,
		"user_id":         acct.UserID,
		"wechat_userid":   acct.WechatUserID,
		"name":            acct.Name,
		"email":           acct.Email,
		"mobile":          acct.Mobile,
		"department_ids":  acct.DepartmentIDs,
		"position":        acct.Position,
		"avatar":          acct.Avatar,
		"linked":          acct.Linked,
		"last_synced_at":  acct.LastSyncedAt,
		"created_at":      acct.CreatedAt,
		"updated_at":      acct.UpdatedAt,
	}

	c.JSON(http.StatusOK, resp)
}

// WeChatListAccounts handles GET /sso/wechat/accounts?tenant_id=<id>.
// Lists all WeChat Work linked accounts for a tenant.
func (h *Handler) WeChatListAccounts(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		tenantID = "default"
	}

	accounts, err := h.wechatSVC.ListAccounts(c.Request.Context(), tenantID)
	if err != nil {
		h.log.Error("wechat list accounts failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"accounts": accounts})
}

// WeChatSyncDepartments handles POST /sso/wechat/sync-departments.
// Triggers a sync of WeChat Work departments to Orion groups.
func (h *Handler) WeChatSyncDepartments(c *gin.Context) {
	if !h.wechatSVC.IsEnabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "wechat work SSO is not enabled"})
		return
	}

	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		tenantID = "default"
	}

	count, err := h.wechatSVC.SyncDepartments(c.Request.Context(), tenantID)
	if err != nil {
		h.log.Error("wechat sync departments failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync departments"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"synced":  count,
		"message": "departments synced successfully",
	})
}
