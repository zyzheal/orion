package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"orion/auth-svc-go/internal/model"
	"orion/auth-svc-go/internal/repository"
	"orion/auth-svc-go/internal/service"
	"orion/auth-svc-go/internal/ssosvc"
	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type Handler struct {
	svc        *service.AuthService
	oidcSVC    *ssosvc.OIDCService
	oidcRepo   *repository.OIDCRepository
	log        *zap.Logger
	jwtSecret  string
	redis      *redis.Client
}

func New(db *database.DB, log *zap.Logger, jwtSecret string, redisClient *redis.Client) *Handler {
	repo := repository.NewAuthRepository(db)
	svc := service.NewAuthService(repo, log)
	oidcRepo := repository.NewOIDCRepository(db)
	oidcSVC := ssosvc.NewOIDCService(oidcRepo, repo, log, jwtSecret)
	return &Handler{svc: svc, oidcSVC: oidcSVC, oidcRepo: oidcRepo, log: log, jwtSecret: jwtSecret, redis: redisClient}
}

// GetUser returns a user by ID.
func (h *Handler) GetUser(c *gin.Context) {
	userID := c.Param("id")
	u, err := h.svc.GetUser(c.Request.Context(), userID)
	if err != nil {
		h.log.Error("get user failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, u)
}

// ListUsers returns a list of users (not implemented).
func (h *Handler) ListUsers(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

// CreateUser creates a new user.
func (h *Handler) CreateUser(c *gin.Context) {
	var u model.User
	if err := c.ShouldBindJSON(&u); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.CreateUser(c.Request.Context(), &u); err != nil {
		h.log.Error("create user failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusCreated, u)
}

// UpdateUser updates a user.
func (h *Handler) UpdateUser(c *gin.Context) {
	var u model.User
	if err := c.ShouldBindJSON(&u); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.UpdateUser(c.Request.Context(), &u); err != nil {
		h.log.Error("update user failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, u)
}

// ---- /api/auth endpoints ----

// Login handles POST /api/auth/login.
// Authenticates user by username/password, returns access and refresh JWT tokens.
func (h *Handler) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.svc.GetUserByUsername(c.Request.Context(), req.Username)
	if err != nil {
		h.log.Error("login lookup failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if user == nil || user.PasswordHash == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		_ = h.svc.RecordLoginAttempt(c.Request.Context(), &model.LoginAttempt{
			ID:        uuid.New().String(),
			TenantID:  user.TenantID,
			Username:  user.Username,
			Success:   false,
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
		})
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// Default role for users without explicit role in this model
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
		h.log.Error("failed to sign access token", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	refreshBytes := make([]byte, 32)
	if _, err := rand.Read(refreshBytes); err != nil {
		h.log.Error("failed to generate refresh token", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	refreshToken := hex.EncodeToString(refreshBytes)
	refreshHash := sha256.Sum256([]byte(refreshToken))

	_ = h.svc.SaveRefreshToken(c.Request.Context(), &model.RefreshToken{
		ID:        uuid.New().String(),
		UserID:    user.ID,
		TokenHash: hex.EncodeToString(refreshHash[:]),
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
		CreatedAt: time.Now(),
	})

	_ = h.svc.RecordLoginAttempt(c.Request.Context(), &model.LoginAttempt{
		ID:        uuid.New().String(),
		TenantID:  user.TenantID,
		Username:  user.Username,
		Success:   true,
		IPAddress: c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	})

	c.JSON(http.StatusOK, gin.H{
		"access_token":  tokenString,
		"refresh_token": refreshToken,
		"expires_at":    now.Add(5 * time.Minute).Unix(),
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"roles":    roles,
			"status":   user.Status,
		},
	})
}

// RefreshToken handles POST /api/auth/refresh.
// Accepts a refresh token, validates it against DB, issues a new access token.
func (h *Handler) RefreshToken(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	refreshToken := strings.TrimSpace(req.RefreshToken)
	if refreshToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "refresh_token is required"})
		return
	}

	refreshHash := sha256.Sum256([]byte(refreshToken))
	hashHex := hex.EncodeToString(refreshHash[:])

	// Find valid refresh token by hash across all users
	valid, err := h.svc.FindValidRefreshTokenByHash(c.Request.Context(), hashHex)
	if err != nil {
		h.log.Error("refresh token lookup failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if valid == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired refresh token"})
		return
	}

	user, err := h.svc.GetUser(c.Request.Context(), valid.UserID)
	if err != nil {
		h.log.Error("get user for refresh failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

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
		h.log.Error("failed to sign access token on refresh", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	// Revoke old refresh token after use (one-time use)
	_ = h.svc.RevokeRefreshToken(c.Request.Context(), valid.ID)

	// Issue a new refresh token
	newRefreshBytes := make([]byte, 32)
	if _, err := rand.Read(newRefreshBytes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	newRefreshToken := hex.EncodeToString(newRefreshBytes)
	newRefreshHash := sha256.Sum256([]byte(newRefreshToken))

	_ = h.svc.SaveRefreshToken(c.Request.Context(), &model.RefreshToken{
		ID:        uuid.New().String(),
		UserID:    user.ID,
		TokenHash: hex.EncodeToString(newRefreshHash[:]),
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
		CreatedAt: time.Now(),
	})

	h.log.Info("token refreshed", zap.String("user_id", user.ID))
	c.JSON(http.StatusOK, gin.H{
		"access_token":  tokenString,
		"refresh_token": newRefreshToken,
		"expires_at":    now.Add(5 * time.Minute).Unix(),
	})
}

// Logout handles POST /api/auth/logout.
// Accepts an access token and blacklists it in Redis.
func (h *Handler) Logout(c *gin.Context) {
	// Prefer token from Authorization header; fall back to request body
	tokenString := c.GetHeader("Authorization")
	tokenString = strings.TrimPrefix(tokenString, "Bearer ")
	if tokenString == c.GetHeader("Authorization") {
		// No header; check body
		var req struct {
			AccessToken string `json:"access_token"`
		}
		if err := c.ShouldBindJSON(&req); err == nil && req.AccessToken != "" {
			tokenString = req.AccessToken
		}
	}

	// If still empty, check if user_id exists in context (auth middleware)
	if tokenString == "" {
		userID := auth.GetUserID(c)
		if userID != "" {
			h.log.Info("logout requested (auth middleware)", zap.String("user_id", userID))
			c.Status(http.StatusOK)
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "access_token or Authorization header required"})
		return
	}

	// Parse token to extract expiration for blacklist TTL
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(h.jwtSecret), nil
	})
	if err != nil || !token.Valid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid access_token"})
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token claims"})
		return
	}

	// Blacklist token in Redis for its remaining TTL
	exp, _ := claims["exp"].(float64)
	ttl := time.Until(time.Unix(int64(exp), 0))

	ctx := c.Request.Context()
	if h.redis != nil && ttl > 0 {
		if err := h.redis.Set(ctx, "token:blacklist:"+tokenString, "1", ttl).Err(); err != nil {
			h.log.Warn("failed to blacklist token", zap.Error(err))
		}
	}

	// Record audit log for logout
	userID, _ := claims["sub"].(string)
	if userID != "" {
		if err := h.svc.Audit(ctx, &model.AuditLog{
			ID:        uuid.New().String(),
			ActorID:   userID,
			Action:    "logout",
			IPAddress: c.ClientIP(),
			CreatedAt: time.Now(),
		}); err != nil {
			h.log.Warn("failed to record logout audit", zap.Error(err))
		}
	}

	c.Status(http.StatusOK)
}

// Me handles GET /api/auth/me.
// Returns the current authenticated user's info. Requires auth middleware.
func (h *Handler) Me(c *gin.Context) {
	userID := auth.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	user, err := h.svc.GetUser(c.Request.Context(), userID)
	if err != nil {
		h.log.Error("get current user failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         user.ID,
		"username":   user.Username,
		"email":      user.Email,
		"tenant_id":  user.TenantID,
		"roles":      auth.GetRoles(c),
		"status":     user.Status,
		"last_login": user.LastLoginAt,
		"created_at": user.CreatedAt,
	})
}

// Permissions handles GET /api/auth/permissions.
// Returns the current user's permissions based on role. Requires auth middleware.
func (h *Handler) Permissions(c *gin.Context) {
	roles := auth.GetRoles(c)
	tenantID := auth.GetTenantID(c)

	// Compute effective permissions from role definitions
	effectivePerms := make(map[string][]string)
	for _, role := range roles {
		for _, p := range rolePermissions(role) {
			resource, action := splitPermission(p)
			if resource == "" || action == "" {
				continue
			}
			effectivePerms[resource] = append(effectivePerms[resource], action)
		}
	}

	// Also load DB permissions scoped to tenant
	dbPerms, err := h.svc.GetPermissions(c.Request.Context(), tenantID)
	if err != nil {
		h.log.Warn("failed to list DB permissions", zap.Error(err))
		dbPerms = nil
	}

	c.JSON(http.StatusOK, gin.H{
		"roles":          roles,
		"permissions":    effectivePerms,
		"db_permissions": dbPerms,
	})
}

// rolePermissions returns the permission list for a known role.
func rolePermissions(role string) []string {
	perms := map[string][]string{
		"super_admin":    {"*:*"},
		"platform_admin": {"*:manage", "*:read", "*:write", "*:execute", "*:delete", "*:approve"},
		"tenant_admin":   {"*:read", "*:write", "*:manage", "audit_log:read"},
		"security_admin": {"audit_log:read", "config:read", "secrets:read", "user:read", "role:read",
			"project:read", "pipeline:read", "deployment:read", "alert:read",
			"security:manage", "ticket:read", "approval:approve"},
		"finops_admin": {"finops:*", "project:read", "deployment:read", "pipeline:read"},
		"org_admin": {"*:read", "*:write", "*:execute", "*:manage", "*:approve"},
		"tech_lead": {"project:read", "project:write", "pipeline:*",
			"deployment:read", "deployment:execute", "alert:read",
			"config:read", "ticket:*", "artifact:read", "knowledge:*"},
		"developer": {"project:read", "pipeline:read", "pipeline:write", "pipeline:execute",
			"deployment:read", "alert:read", "config:read",
			"ticket:read", "ticket:write", "artifact:read", "knowledge:read"},
		"sre": {"*:read", "deployment:execute", "deployment:approve",
			"environment:*", "alert:*", "config:write", "pipeline:read", "pipeline:execute", "iac:*",
			"ticket:read", "ticket:write", "oncall:*"},
		"dba": {"project:read", "pipeline:read", "deployment:read",
			"config:read", "alert:read", "cmdb:read", "environment:read", "secrets:read"},
		"viewer": {"project:read", "pipeline:read", "deployment:read",
			"alert:read", "artifact:read", "knowledge:read", "ticket:read", "finops:read"},
		"auditor": {"audit_log:*", "*:read", "ticket:read", "approval:read"},
		"user": {"project:read", "pipeline:read", "deployment:read"},
	}
	return perms[role]
}

// splitPermission splits "resource:action" into its parts.
func splitPermission(p string) (resource, action string) {
	idx := strings.Index(p, ":")
	if idx < 0 {
		return p, ""
	}
	return p[:idx], p[idx+1:]
}
