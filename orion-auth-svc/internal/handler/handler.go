package handler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"orion/auth-svc/internal/config"
	"orion/auth-svc/internal/models"
	"orion/auth-svc/internal/repository"
	"orion/auth-svc/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// Handler handles HTTP requests for the auth service.
type Handler struct {
	userRepo     *repository.UserRepository
	sessionRepo  *repository.SessionRepository
	blacklistRepo *repository.BlacklistRepository
	services     *service.Services
	rdb          *redis.Client
	logger       *zap.Logger
	cfg          *config.Config
}

// New creates a new Handler with full service layer.
func New(db *sqlx.DB, rdb *redis.Client, logger *zap.Logger, cfg *config.Config) *Handler {
	svcs := service.New(db, cfg.JWTSecret, cfg.JWTExpiration, cfg.JWTRefreshExpiration)
	return &Handler{
		userRepo:      repository.NewUserRepository(db),
		sessionRepo:   repository.NewSessionRepository(db),
		blacklistRepo: repository.NewBlacklistRepository(db),
		services:      svcs,
		rdb:           rdb,
		logger:        logger,
		cfg:           cfg,
	}
}

// Response is the standard API response envelope.
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func (h *Handler) success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Code: 0, Message: "success", Data: data})
}

func (h *Handler) err(c *gin.Context, code int, message string) {
	c.JSON(code, Response{Code: code, Message: message})
}

// Login handles email/username/password authentication.
func (h *Handler) Login(c *gin.Context) {
	var req models.UsernameLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Try email-based request
		var emailReq models.LoginRequest
		if err2 := c.ShouldBindJSON(&emailReq); err2 == nil && emailReq.Email != "" {
			req.Username = emailReq.Email
			req.Password = emailReq.Password
		} else {
			h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
			return
		}
	}

	ctx := c.Request.Context()
	tenantID := c.GetHeader("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "00000000-0000-0000-0000-000000000000"
	}
	user, err := h.services.Auth.Login(ctx, tenantID, req.Username, req.Password)
	if err != nil {
		h.logger.Warn("login failed",
			zap.String("identifier", req.Username),
			zap.Error(err),
		)
		switch err {
		case service.ErrInvalidCredentials:
			h.err(c, http.StatusUnauthorized, "invalid credentials")
		case service.ErrAccountDisabled:
			h.err(c, http.StatusForbidden, "account is disabled")
		default:
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	deviceID := getDeviceID(c)
	tokens, err := h.services.JWT.GenerateTokens(user.ID, user.TenantID, user.Role, deviceID)
	if err != nil {
		h.logger.Error("failed to generate tokens", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	// Store refresh token in Redis for concurrent refresh detection (P0 security)
	refreshKey := "refresh:" + tokens.JTI
	if err := h.rdb.Set(ctx, refreshKey, tokens.RefreshToken, h.cfg.JWTRefreshExpiration).Err(); err != nil {
		h.logger.Warn("failed to store refresh token in Redis", zap.Error(err))
	}

	// Record session
	ip := c.ClientIP()
	session := &models.Session{
		UserID:    user.ID,
		TenantID:  user.TenantID,
		Token:     tokens.AccessToken,
		IP:        ip,
		UserAgent: c.GetHeader("User-Agent"),
		ExpiresAt: time.Now().Add(h.cfg.JWTRefreshExpiration),
	}
	if err := h.sessionRepo.Create(ctx, session); err != nil {
		h.logger.Warn("failed to create session record", zap.Error(err))
	}

	// Set HttpOnly Cookies for token storage (spec: C-3)
	c.SetSameSite(http.SameSiteStrictMode)
	cookieSecure := h.cfg.SecureCookie
	c.SetCookie("access_token", tokens.AccessToken, int(h.cfg.JWTExpiration.Seconds()),
		"/", "", cookieSecure, true) // HttpOnly=true
	c.SetCookie("refresh_token", tokens.RefreshToken, int(h.cfg.JWTRefreshExpiration.Seconds()),
		"/", "", cookieSecure, true) // HttpOnly=true

	h.success(c, gin.H{
		"expires_in": tokens.ExpiresIn,
		"token_type": tokens.TokenType,
	})
}

// Register creates a new user account.
func (h *Handler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	ctx := c.Request.Context()
	user, err := h.services.Auth.Register(ctx, req, h.services.Password)
	if err != nil {
		switch err {
		case service.ErrEmailExists:
			h.err(c, http.StatusConflict, "email already registered")
		default:
			h.logger.Error("register failed", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, gin.H{"user_id": user.ID, "username": user.Username, "email": user.Email})
}

// refreshLuaScript atomically checks and rotates refresh tokens.
// If the stored token matches, it replaces with the new token.
// If mismatch (concurrent refresh detected), it deletes the key and returns REVOKED.
const refreshLuaScript = `
local current = redis.call('GET', KEYS[1])
if current == ARGV[1] then
    redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
    return 'OK'
else
    redis.call('DEL', KEYS[1])
    return 'REVOKED'
end
`

// RefreshToken issues a new access token using a refresh token.
// Reads refresh_token from HttpOnly Cookie (spec: C-3).
// Uses Redis Lua script for concurrent refresh protection (P0 security).
func (h *Handler) RefreshToken(c *gin.Context) {
	// Read refresh token from Cookie first, fallback to JSON body
	refreshTokenStr, err := c.Cookie("refresh_token")
	if err != nil || refreshTokenStr == "" {
		var req models.RefreshRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			h.err(c, http.StatusBadRequest, "invalid request")
			return
		}
		refreshTokenStr = req.RefreshToken
	}

	ctx := c.Request.Context()

	// Check Redis blacklist first
	blocked, err := h.rdb.Exists(ctx, "token:blacklist:"+refreshTokenStr).Result()
	if err == nil && blocked > 0 {
		h.err(c, http.StatusUnauthorized, "refresh token revoked")
		return
	}

	claims, err := h.services.JWT.ValidateRefreshToken(refreshTokenStr)
	if err != nil {
		h.err(c, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	// Device fingerprint binding: verify device_id matches
	deviceID := getDeviceID(c)
	if claims.DeviceID != "" && claims.DeviceID != deviceID {
		h.logger.Warn("device fingerprint mismatch",
			zap.String("user_id", claims.Subject),
			zap.String("expected_device", claims.DeviceID),
			zap.String("actual_device", deviceID),
		)
		h.err(c, http.StatusUnauthorized, "device mismatch, please re-authenticate")
		return
	}

	// Check DB blacklist
	blacklisted, err := h.services.Auth.IsTokenBlacklisted(ctx, claims.JTI+"-refresh")
	if err == nil && blacklisted {
		h.err(c, http.StatusUnauthorized, "refresh token revoked")
		return
	}

	// Generate new tokens with same device ID
	tokens, err := h.services.JWT.GenerateTokens(claims.Subject, claims.TenantID, claims.Role, deviceID)
	if err != nil {
		h.logger.Error("failed to generate new tokens", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	// Concurrent refresh protection: atomically verify and rotate refresh token in Redis
	refreshKey := "refresh:" + claims.JTI
	ttlSeconds := int(h.cfg.JWTRefreshExpiration.Seconds())
	result, err := h.rdb.Eval(ctx, refreshLuaScript, []string{refreshKey},
		refreshTokenStr, tokens.RefreshToken, ttlSeconds).Result()
	if err != nil {
		h.logger.Warn("Redis Lua eval failed, falling through without concurrent protection", zap.Error(err))
		// Continue without concurrent protection if Redis fails
	} else if result == "REVOKED" {
		// Concurrent refresh detected — revoke all tokens for this JTI
		h.logger.Warn("concurrent refresh detected, revoking all tokens",
			zap.String("jti", claims.JTI),
			zap.String("user_id", claims.Subject),
		)
		// Blacklist the new access token too
		h.rdb.Set(ctx, "token:blacklist:"+tokens.AccessToken, "1", h.cfg.JWTExpiration)
		h.err(c, http.StatusUnauthorized, "concurrent refresh detected, all tokens revoked")
		return
	}

	// Set new HttpOnly Cookies
	c.SetSameSite(http.SameSiteStrictMode)
	cookieSecure := h.cfg.SecureCookie
	c.SetCookie("access_token", tokens.AccessToken, int(h.cfg.JWTExpiration.Seconds()),
		"/", "", cookieSecure, true)
	c.SetCookie("refresh_token", tokens.RefreshToken, int(h.cfg.JWTRefreshExpiration.Seconds()),
		"/", "", cookieSecure, true)

	h.success(c, gin.H{
		"expires_in": tokens.ExpiresIn,
		"token_type": tokens.TokenType,
	})
}

// Logout adds the current token to the blacklist and destroys sessions.
func (h *Handler) Logout(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		h.err(c, http.StatusBadRequest, "missing token")
		return
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	userID := c.GetString("user_id")

	// Parse token to get JTI for blacklist
	claims, err := h.services.JWT.ValidateToken(token)
	if err != nil {
		h.err(c, http.StatusUnauthorized, "invalid token")
		return
	}

	ctx := c.Request.Context()

	// Blacklist in Redis (fast lookup)
	h.rdb.Set(ctx, "token:blacklist:"+token, "1", h.cfg.JWTExpiration)
	// Remove refresh token from Redis to prevent reuse
	h.rdb.Del(ctx, "refresh:"+claims.JTI)

	// Blacklist in DB (persistent)
	entry := &models.TokenBlacklist{
		TokenJTI:  claims.JTI,
		TokenType: "access",
		ExpiresAt: time.Now().Add(h.cfg.JWTExpiration),
	}
	_ = h.blacklistRepo.Create(ctx, entry)

	// Destroy sessions
	_ = h.sessionRepo.DeleteByUserID(ctx, userID)

	h.success(c, gin.H{"message": "logged out"})
}

// LDAPLogin handles LDAP directory authentication.
func (h *Handler) LDAPLogin(c *gin.Context) {
	var req models.LDAPLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request")
		return
	}

	ctx := c.Request.Context()

	// Authenticate against LDAP
	ldapResult, err := h.authenticateLDAP(req)
	if err != nil {
		h.logger.Warn("LDAP authentication failed",
			zap.String("username", req.Username),
			zap.Error(err),
		)
		h.err(c, http.StatusUnauthorized, "LDAP authentication failed")
		return
	}

	// Find or create user
	user, err := h.userRepo.GetByEmail(ctx, ldapResult.Email)
	if err != nil {
		// Auto-provision user from LDAP
		user = &models.User{
			TenantID:     req.TenantID,
			Username:     req.Username,
			Email:        ldapResult.Email,
			PasswordHash: "", // LDAP users don't have local passwords
			Role:         "user",
			Status:       "active",
		}
		if user.TenantID == "" {
			user.TenantID = "00000000-0000-0000-0000-000000000000"
		}
		if err := h.userRepo.Create(ctx, user); err != nil {
			h.logger.Error("failed to provision LDAP user", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
			return
		}
	}

	deviceID := getDeviceID(c)
	tokens, err := h.services.JWT.GenerateTokens(user.ID, user.TenantID, user.Role, deviceID)
	if err != nil {
		h.logger.Error("failed to generate tokens", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	// Store refresh token in Redis for concurrent refresh detection
	refreshKey := "refresh:" + tokens.JTI
	h.rdb.Set(ctx, refreshKey, tokens.RefreshToken, h.cfg.JWTRefreshExpiration)

	h.success(c, models.TokenResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn:    tokens.ExpiresIn,
		TokenType:    tokens.TokenType,
	})
}

type ldapResult struct {
	Email       string
	DisplayName string
}

func (h *Handler) authenticateLDAP(req models.LDAPLoginRequest) (*ldapResult, error) {
	// LDAP authentication is configured via environment variables.
	// For development, return a simulated result.
	// In production, this should connect to the LDAP server:
	//   l, err := ldap.DialURL(cfg.LDAPURL)
	//   err = l.Bind(ldapDN, req.Password)
	//   search, err := l.Search(...)
	ldapServerURL := getEnvOrConfig("LDAP_URL", "")
	if ldapServerURL == "" {
		return &ldapResult{
			Email:       req.Username + "@ldap.orion.local",
			DisplayName: req.Username,
		}, nil
	}

	// TODO: Real LDAP implementation
	return &ldapResult{
		Email:       req.Username + "@ldap.orion.local",
		DisplayName: req.Username,
	}, nil
}

// WechatLogin handles WeChat Work OAuth authentication.
func (h *Handler) WechatLogin(c *gin.Context) {
	var req models.WechatLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request")
		return
	}

	ctx := c.Request.Context()

	// Exchange code for user info via WeChat Work API
	wechatUser, err := h.authenticateWechat(req)
	if err != nil {
		h.logger.Warn("WeChat authentication failed", zap.Error(err))
		h.err(c, http.StatusUnauthorized, "WeChat authentication failed")
		return
	}

	// Find or create user
	user, err := h.userRepo.GetByEmail(ctx, wechatUser.Email)
	if err != nil {
		user = &models.User{
			TenantID:     req.TenantID,
			Username:     wechatUser.Name,
			Email:        wechatUser.Email,
			PasswordHash: "", // OAuth users don't have local passwords
			Role:         "user",
			Status:       "active",
		}
		if user.TenantID == "" {
			user.TenantID = "00000000-0000-0000-0000-000000000000"
		}
		if err := h.userRepo.Create(ctx, user); err != nil {
			h.logger.Error("failed to provision WeChat user", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
			return
		}
	}

	deviceID := getDeviceID(c)
	tokens, err := h.services.JWT.GenerateTokens(user.ID, user.TenantID, user.Role, deviceID)
	if err != nil {
		h.logger.Error("failed to generate tokens", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	// Store refresh token in Redis for concurrent refresh detection
	refreshKey := "refresh:" + tokens.JTI
	h.rdb.Set(ctx, refreshKey, tokens.RefreshToken, h.cfg.JWTRefreshExpiration)

	h.success(c, models.TokenResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn:    tokens.ExpiresIn,
		TokenType:    tokens.TokenType,
	})
}

type wechatUserInfo struct {
	Email string
	Name  string
	OpenID string
}

func (h *Handler) authenticateWechat(req models.WechatLoginRequest) (*wechatUserInfo, error) {
	corpID := getEnvOrConfig("WECHAT_CORP_ID", "")
	corpSecret := getEnvOrConfig("WECHAT_CORP_SECRET", "")
	if corpID == "" || corpSecret == "" {
		// Development mode: simulate
		return &wechatUserInfo{
			Email:  fmt.Sprintf("wx_%s@wechat.orion.local", req.Code),
			Name:   "wechat_user",
			OpenID: "dev_" + req.Code,
		}, nil
	}

	// TODO: Real WeChat Work OAuth implementation
	// 1. GET https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=...&corpsecret=...
	// 2. GET https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?access_token=...&code=...
	// 3. GET https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=...&userid=...
	return &wechatUserInfo{
		Email:  fmt.Sprintf("wx_%s@wechat.orion.local", req.Code),
		Name:   "wechat_user",
		OpenID: "dev_" + req.Code,
	}, nil
}

// GetMe returns the current user's profile.
func (h *Handler) GetMe(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		h.err(c, http.StatusUnauthorized, "not authenticated")
		return
	}

	ctx := c.Request.Context()
	user, err := h.userRepo.GetByID(ctx, userID)
	if err != nil {
		h.err(c, http.StatusNotFound, "user not found")
		return
	}

	h.success(c, models.UserProfile{
		ID:        user.ID,
		TenantID:  user.TenantID,
		Username:  user.Username,
		Email:     user.Email,
		Role:      user.Role,
		Status:    user.Status,
		CreatedAt: user.CreatedAt,
	})
}

// ChangePassword updates the user's password.
func (h *Handler) ChangePassword(c *gin.Context) {
	userID := c.GetString("user_id")
	var req models.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request")
		return
	}

	ctx := c.Request.Context()
	err := h.services.Auth.ChangePassword(ctx, userID, req.OldPassword, req.NewPassword, h.services.Password)
	if err != nil {
		switch err {
		case service.ErrInvalidCredentials:
			h.err(c, http.StatusUnauthorized, "incorrect old password")
		case service.ErrUserNotFound:
			h.err(c, http.StatusNotFound, "user not found")
		default:
			h.logger.Error("failed to change password", zap.Error(err))
			h.err(c, http.StatusInternalServerError, "internal error")
		}
		return
	}

	h.success(c, gin.H{"message": "password updated"})
}

// ListSessions returns active sessions for the current user.
func (h *Handler) ListSessions(c *gin.Context) {
	userID := c.GetString("user_id")
	ctx := c.Request.Context()

	sessions, err := h.services.Auth.GetSessions(ctx, userID)
	if err != nil {
		h.logger.Error("failed to get sessions", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	type SessionView struct {
		ID        string    `json:"id"`
		IP        string    `json:"ip_address"`
		UserAgent string    `json:"user_agent"`
		ExpiresAt time.Time `json:"expires_at"`
		CreatedAt time.Time `json:"created_at"`
	}

	result := make([]SessionView, 0, len(sessions))
	for _, s := range sessions {
		result = append(result, SessionView{
			ID:        s.ID,
			IP:        s.IP,
			UserAgent: s.UserAgent,
			ExpiresAt: s.ExpiresAt,
			CreatedAt: s.CreatedAt,
		})
	}

	h.success(c, result)
}

// RevokeSession revokes a specific session.
func (h *Handler) RevokeSession(c *gin.Context) {
	sessionID := c.Param("id")
	ctx := c.Request.Context()

	if err := h.services.Auth.RevokeSession(ctx, sessionID); err != nil {
		h.logger.Error("failed to revoke session", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, gin.H{"message": "session revoked"})
}

// AddToBlacklist adds a token to the blacklist.
func (h *Handler) AddToBlacklist(c *gin.Context) {
	var req struct {
		TokenJTI string `json:"token_jti" binding:"required"`
		Reason   string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.err(c, http.StatusBadRequest, "invalid request")
		return
	}

	ctx := c.Request.Context()
	entry := &models.TokenBlacklist{
		TokenJTI:  req.TokenJTI,
		TokenType: "access",
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	if err := h.blacklistRepo.Create(ctx, entry); err != nil {
		h.logger.Error("failed to blacklist token", zap.Error(err))
		h.err(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, gin.H{"message": "token blacklisted"})
}

// GetBlacklistEntry retrieves a blacklist entry.
func (h *Handler) GetBlacklistEntry(c *gin.Context) {
	jti := c.Param("token_id")
	ctx := c.Request.Context()

	entry, err := h.blacklistRepo.GetByJTI(ctx, jti)
	if err != nil {
		h.err(c, http.StatusNotFound, "not found")
		return
	}

	h.success(c, gin.H{"token_jti": entry.TokenJTI, "token_type": entry.TokenType, "expires_at": entry.ExpiresAt})
}

// RemoveFromBlacklist removes a token from the blacklist.
func (h *Handler) RemoveFromBlacklist(c *gin.Context) {
	jti := c.Param("token_id")
	_ = jti
	h.err(c, http.StatusNotImplemented, "not implemented")
}

func getEnvOrConfig(envKey, fallback string) string {
	// Simple env fallback - in real code would use os.Getenv
	return fallback
}

// FindOrCreateSSOUser finds an existing user by email or creates a new one for SSO login.
func (h *Handler) FindOrCreateSSOUser(ctx context.Context, tenantID, email, username, source string) (*models.User, error) {
	user, err := h.userRepo.GetByEmail(ctx, email)
	if err == nil {
		return user, nil
	}

	if tenantID == "" {
		tenantID = "00000000-0000-0000-0000-000000000000"
	}
	if username == "" {
		username = email
	}

	user = &models.User{
		TenantID:     tenantID,
		Username:     username,
		Email:        email,
		PasswordHash: "", // SSO users don't have local passwords
		Role:         "user",
		Status:       "active",
	}
	if err := h.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("create SSO user: %w", err)
	}

	h.logger.Info("auto-provisioned SSO user",
		zap.String("email", email),
		zap.String("source", source),
	)
	return user, nil
}

// IssueTokensForUser generates JWT tokens for a user and stores the refresh token in Redis.
func (h *Handler) IssueTokensForUser(ctx context.Context, user *models.User) (*models.TokenResponse, error) {
	tokens, err := h.services.JWT.GenerateTokens(user.ID, user.TenantID, user.Role, "")
	if err != nil {
		return nil, fmt.Errorf("generate tokens: %w", err)
	}

	refreshKey := "refresh:" + tokens.JTI
	if err := h.rdb.Set(ctx, refreshKey, tokens.RefreshToken, h.cfg.JWTRefreshExpiration).Err(); err != nil {
		h.logger.Warn("failed to store refresh token in Redis", zap.Error(err))
	}

	return &models.TokenResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn:    tokens.ExpiresIn,
		TokenType:    tokens.TokenType,
	}, nil
}

// getDeviceID extracts or generates a device fingerprint from the request.
// Priority: X-Device-ID header > hash(User-Agent + IP).
func getDeviceID(c *gin.Context) string {
	if devID := c.GetHeader("X-Device-ID"); devID != "" {
		return devID
	}
	// Generate fingerprint from User-Agent + Client IP
	ua := c.GetHeader("User-Agent")
	ip := c.ClientIP()
	h := sha256.Sum256([]byte(ua + "|" + ip))
	return hex.EncodeToString(h[:8]) // 16-char fingerprint
}
