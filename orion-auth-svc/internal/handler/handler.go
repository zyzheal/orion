package handler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"orion/auth-svc/internal/config"
	"orion/auth-svc/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

type Handler struct {
	db     *sqlx.DB
	rdb    *redis.Client
	logger *zap.Logger
	cfg    *config.Config
}

func New(db *sqlx.DB, rdb *redis.Client, logger *zap.Logger, cfg *config.Config) *Handler {
	return &Handler{db: db, rdb: rdb, logger: logger, cfg: cfg}
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func (h *Handler) success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Code: 0, Message: "success", Data: data})
}

func (h *Handler) error(c *gin.Context, code int, message string) {
	c.JSON(code, Response{Code: code, Message: message})
}

// Login handles username/password authentication.
func (h *Handler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	var user models.User
	err := h.db.Get(&user, "SELECT id, tenant_id, email, password_hash, role, status FROM users WHERE email = $1", req.Email)
	if err != nil {
		h.error(c, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		h.error(c, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if user.Status != "active" {
		h.error(c, http.StatusForbidden, "account is "+user.Status)
		return
	}

	token, refreshToken, err := h.generateTokens(user)
	if err != nil {
		h.logger.Error("failed to generate tokens", zap.Error(err))
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, models.TokenResponse{
		AccessToken:  token,
		RefreshToken: refreshToken,
		ExpiresIn:    int(h.cfg.JWTExpiration.Seconds()),
		TokenType:    "Bearer",
	})
}

// Register creates a new user account.
func (h *Handler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "failed to hash password")
		return
	}

	var userID string
	err = h.db.Get(&userID,
		"INSERT INTO users (tenant_id, email, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
		"00000000-0000-0000-0000-000000000000", req.Email, string(hashedPassword), "user", "active",
	)
	if err != nil {
		h.error(c, http.StatusConflict, "user already exists")
		return
	}

	h.success(c, gin.H{"user_id": userID})
}

// RefreshToken issues a new access token using a refresh token.
func (h *Handler) RefreshToken(c *gin.Context) {
	var req models.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}

	// Verify refresh token is not blacklisted
	blocked, err := h.rdb.Exists(c.Request.Context(), "token:blacklist:"+req.RefreshToken).Result()
	if err == nil && blocked > 0 {
		h.error(c, http.StatusUnauthorized, "refresh token revoked")
		return
	}

	token, err := jwt.Parse(req.RefreshToken, func(token *jwt.Token) (interface{}, error) {
		return []byte(h.cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		h.error(c, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		h.error(c, http.StatusUnauthorized, "invalid token claims")
		return
	}

	newToken, _, err := h.generateTokens(models.User{
		ID:       claims["sub"].(string),
		TenantID: claims["tenant_id"].(string),
		Role:     claims["role"].(string),
	})
	if err != nil {
		h.error(c, http.StatusInternalServerError, "internal error")
		return
	}

	h.success(c, gin.H{"access_token": newToken, "token_type": "Bearer", "expires_in": int(h.cfg.JWTExpiration.Seconds())})
}

// Logout adds the current token to the blacklist.
func (h *Handler) Logout(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		h.error(c, http.StatusBadRequest, "missing token")
		return
	}

	token := authHeader[len("Bearer "):]
	// Blacklist token until its natural expiry
	h.rdb.Set(c.Request.Context(), "token:blacklist:"+token, "1", h.cfg.JWTExpiration)

	h.success(c, gin.H{"message": "logged out"})
}

// LDAPLogin handles LDAP directory authentication.
func (h *Handler) LDAPLogin(c *gin.Context) {
	var req models.LDAPLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}

	// TODO: Connect to LDAP server and authenticate
	// For now, return placeholder
	h.success(c, gin.H{"message": "LDAP login - implementation pending"})
}

// WechatLogin handles WeChat Work OAuth authentication.
func (h *Handler) WechatLogin(c *gin.Context) {
	var req models.WechatLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}

	// TODO: Connect to WeChat Work OAuth
	h.success(c, gin.H{"message": "WeChat login - implementation pending"})
}

// GetMe returns the current user's profile.
func (h *Handler) GetMe(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		h.error(c, http.StatusUnauthorized, "not authenticated")
		return
	}

	var user models.User
	err := h.db.Get(&user, "SELECT id, tenant_id, email, role, status, created_at FROM users WHERE id = $1", userID)
	if err != nil {
		h.error(c, http.StatusNotFound, "user not found")
		return
	}

	h.success(c, models.UserProfile{
		ID:        user.ID,
		TenantID:  user.TenantID,
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
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "failed to hash password")
		return
	}

	_, err = h.db.Exec("UPDATE users SET password_hash = $1 WHERE id = $2", string(hashedPassword), userID)
	if err != nil {
		h.error(c, http.StatusInternalServerError, "failed to update password")
		return
	}

	h.success(c, gin.H{"message": "password updated"})
}

// ListSessions returns active sessions for the current user.
func (h *Handler) ListSessions(c *gin.Context) {
	userID := c.GetString("user_id")
	h.success(c, []gin.H{}) // TODO: Query from sessions table
}

// RevokeSession revokes a specific session.
func (h *Handler) RevokeSession(c *gin.Context) {
	sessionID := c.Param("id")
	h.rdb.Del(c.Request.Context(), "session:"+sessionID)
	h.success(c, gin.H{"message": "session revoked"})
}

// AddToBlacklist adds a token to the blacklist.
func (h *Handler) AddToBlacklist(c *gin.Context) {
	var req struct {
		TokenID string `json:"token_id"`
		Reason  string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, "invalid request")
		return
	}

	h.rdb.Set(c.Request.Context(), "token:blacklist:"+req.TokenID, req.Reason, 24*time.Hour)
	h.success(c, gin.H{"message": "token blacklisted"})
}

// GetBlacklistEntry retrieves a blacklist entry.
func (h *Handler) GetBlacklistEntry(c *gin.Context) {
	tokenID := c.Param("token_id")
	val, err := h.rdb.Get(c.Request.Context(), "token:blacklist:"+tokenID).Result()
	if err == redis.Nil {
		h.error(c, http.StatusNotFound, "not found")
		return
	}
	h.success(c, gin.H{"token_id": tokenID, "reason": val})
}

// RemoveFromBlacklist removes a token from the blacklist.
func (h *Handler) RemoveFromBlacklist(c *gin.Context) {
	tokenID := c.Param("token_id")
	h.rdb.Del(c.Request.Context(), "token:blacklist:"+tokenID)
	h.success(c, gin.H{"message": "token removed from blacklist"})
}

func (h *Handler) generateTokens(user models.User) (string, string, error) {
	now := time.Now()
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":       user.ID,
		"tenant_id": user.TenantID,
		"role":      user.Role,
		"iat":       now.Unix(),
		"exp":       now.Add(h.cfg.JWTExpiration).Unix(),
	})

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":       user.ID,
		"tenant_id": user.TenantID,
		"type":      "refresh",
		"iat":       now.Unix(),
		"exp":       now.Add(h.cfg.JWTRefreshExpiration).Unix(),
	})

	accessString, err := accessToken.SignedString([]byte(h.cfg.JWTSecret))
	if err != nil {
		return "", "", err
	}

	refreshString, err := refreshToken.SignedString([]byte(h.cfg.JWTSecret))
	if err != nil {
		return "", "", err
	}

	return accessString, refreshString, nil
}

func generateSessionID() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
