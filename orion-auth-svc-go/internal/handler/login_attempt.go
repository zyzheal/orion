package handler

import (
	"net/http"
	"time"

	"orion/auth-svc-go/internal/loginattempt"
	"orion/auth-svc-go/internal/repository"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// LoginAttemptHandler handles login attempt tracking and unlock routes.
type LoginAttemptHandler struct {
	tracker *loginattempt.Tracker
	repo    *repository.AuthRepository
	log     *zap.Logger
}

func NewLoginAttemptHandler(tracker *loginattempt.Tracker, repo *repository.AuthRepository, log *zap.Logger) *LoginAttemptHandler {
	return &LoginAttemptHandler{tracker: tracker, repo: repo, log: log}
}

// List handles GET /login-attempts.
// Returns recent login attempts with optional filtering by username.
func (h *LoginAttemptHandler) List(c *gin.Context) {
	ctx := c.Request.Context()

	username := c.Query("username")
	tenantID := c.Query("tenant_id")
	limit := 50

	rows, err := h.repo.DB().QueryContext(ctx, `
		SELECT id, tenant_id, username, success, ip_address, user_agent, created_at
		FROM login_attempts
		WHERE $1 = '' OR username = $1
		ORDER BY created_at DESC LIMIT $2`, username, limit)
	if err != nil {
		if tenantID != "" {
			rows, err = h.repo.DB().QueryContext(ctx, `
				SELECT id, tenant_id, username, success, ip_address, user_agent, created_at
				FROM login_attempts
				WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`, tenantID, limit)
		}
		if err != nil {
			h.log.Error("failed to list login attempts", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
			return
		}
	}
	defer rows.Close()

	var attempts []map[string]interface{}
	for rows.Next() {
		var id, tenantID, username, ipAddress, userAgent string
		var success bool
		var createdAt time.Time
		if err := rows.Scan(&id, &tenantID, &username, &success, &ipAddress, &userAgent, &createdAt); err != nil {
			continue
		}
		attempts = append(attempts, map[string]interface{}{
			"id":         id,
			"tenant_id":  tenantID,
			"username":   username,
			"success":    success,
			"ip_address": ipAddress,
			"user_agent": userAgent,
			"created_at": createdAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"attempts": attempts,
		"total":    len(attempts),
	})
}

// Unlock handles POST /login-attempts/unlock/:username.
// Admin endpoint to manually unlock a locked user account.
func (h *LoginAttemptHandler) Unlock(c *gin.Context) {
	username := c.Param("username")
	if username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username is required"})
		return
	}

	h.tracker.Unlock(username)

	// Also clear any lockout state in the database if applicable
	_, _ = h.repo.DB().ExecContext(c.Request.Context(),
		"UPDATE users SET locked_until = NULL WHERE username = $1", username)

	c.JSON(http.StatusOK, gin.H{
		"message":  "account unlocked",
		"username": username,
	})
}

// Record handles POST /login-attempts (for external callers to record attempts).
func (h *LoginAttemptHandler) Record(c *gin.Context) {
	var req struct {
		Username  string `json:"username" binding:"required"`
		TenantID  string `json:"tenant_id"`
		Success   bool   `json:"success"`
		IPAddress string `json:"ip_address"`
		UserAgent string `json:"user_agent"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Success {
		h.tracker.RecordSuccess(req.Username)
	} else {
		isLocked, remaining, lockoutRemaining := h.tracker.RecordFailure(req.Username)
		if isLocked {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":     loginattempt.ErrLockout.Error(),
				"retryAfter": int(lockoutRemaining.Seconds()),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"remaining_attempts": remaining,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "attempt recorded",
	})
}
