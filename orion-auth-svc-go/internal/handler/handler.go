package handler

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"time"

	"golang.org/x/crypto/bcrypt"

	"orion/auth-svc-go/internal/model"
	"orion/auth-svc-go/internal/repository"
	"orion/auth-svc-go/internal/service"
	"orion/go-common/pkg/database"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
)

type Handler struct {
	svc       *service.AuthService
	log       *zap.Logger
	jwtSecret string
}

func New(db *database.DB, log *zap.Logger, jwtSecret string) *Handler {
	repo := repository.NewAuthRepository(db)
	svc := service.NewAuthService(repo, log)
	return &Handler{svc: svc, log: log, jwtSecret: jwtSecret}
}

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

func (h *Handler) ListUsers(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

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
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(h.jwtSecret))
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
		UserID:    user.ID,
		TokenHash: hex.EncodeToString(refreshHash[:]),
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	})

	_ = h.svc.RecordLoginAttempt(c.Request.Context(), &model.LoginAttempt{
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

func (h *Handler) RefreshToken(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"access_token": "placeholder"})
}

func (h *Handler) RevokeToken(c *gin.Context) {
	c.Status(http.StatusNoContent)
}
