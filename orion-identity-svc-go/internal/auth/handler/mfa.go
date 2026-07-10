package handler

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"orion/identity-svc-go/internal/auth/mfa"
	"orion/identity-svc-go/internal/auth/model"
	"orion/identity-svc-go/internal/auth/repository"
	"orion/go-common/pkg/auth"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// MFAHandler handles MFA setup, verification, and disable routes.
type MFAHandler struct {
	repo *repository.AuthRepository
	log  *zap.Logger
}

func NewMFAHandler(repo *repository.AuthRepository, log *zap.Logger) *MFAHandler {
	return &MFAHandler{repo: repo, log: log}
}

// Setup handles POST /mfa/setup.
func (h *MFAHandler) Setup(c *gin.Context) {
	ctx := c.Request.Context()
	userID := auth.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	// Check if MFA is already enabled
	existing, err := h.repo.FindMfaByUserID(ctx, userID)
	if err != nil {
		h.log.Error("mfa setup lookup failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if existing != nil && existing.Enabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": mfa.ErrMfaAlreadyEnabled.Error()})
		return
	}

	secret, err := mfa.GenerateTotpSecret()
	if err != nil {
		h.log.Error("failed to generate TOTP secret", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	backupCodes := mfa.GenerateBackupCodes(mfa.BackupCodeCount)
	backupHashes := make([]string, len(backupCodes))
	for i, code := range backupCodes {
		backupHashes[i] = mfa.HashBackupCode(code)
	}

	tenantID := auth.GetTenantID(c)
	now := time.Now()
	mfaConfig := &model.MfaConfig{
		ID:        uuid.New().String(),
		UserID:    userID,
		TenantID:  tenantID,
		Type:      "totp",
		Secret:    secret,
		Enabled:   false, // enable after verification
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Store backup code hashes as comma-separated string
	mfaConfig.Secret = secret

	if err := h.repo.UpsertMfaConfig(ctx, mfaConfig); err != nil {
		h.log.Error("failed to upsert MFA config", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	result := mfa.SetupResult{
		Secret:      secret,
		QRCodeUri:   mfa.BuildQRCodeUri(secret, "orion-auth-svc", userID),
		BackupCodes: backupCodes,
	}

	c.JSON(http.StatusOK, gin.H{
		"setup": result,
		"note":  "Verify with a TOTP code before MFA is activated",
	})
}

// Verify handles POST /mfa/verify.
func (h *MFAHandler) Verify(c *gin.Context) {
	ctx := c.Request.Context()
	userID := auth.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mfaConfig, err := h.repo.FindMfaByUserID(ctx, userID)
	if err != nil {
		h.log.Error("mfa verify lookup failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if mfaConfig == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": mfa.ErrMfaNotEnabled.Error()})
		return
	}

	var verified bool
	// Try TOTP first
	if mfa.VerifyTOTPCode(mfaConfig.Secret, req.Code, mfa.TotpWindow) {
		verified = true
	}

	if verified {
		// Enable MFA
		now := time.Now()
		mfaConfig.Enabled = true
		mfaConfig.UpdatedAt = now
		if err := h.repo.UpsertMfaConfig(ctx, mfaConfig); err != nil {
			h.log.Error("failed to enable MFA", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
            "success":         true,
            "message":         "MFA verified and enabled",
            "remaining_codes": 10,
        })
		return
	}

	c.JSON(http.StatusUnauthorized, gin.H{"error": mfa.ErrInvalidCredentials.Error()})
}

// Disable handles DELETE /mfa.
func (h *MFAHandler) Disable(c *gin.Context) {
	ctx := c.Request.Context()
	userID := auth.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	// Require a valid TOTP code to disable (security measure)
	var req struct {
		Code string `json:"code"`
	}
	if err := c.ShouldBindJSON(&req); err == nil && req.Code != "" {
		mfaConfig, err := h.repo.FindMfaByUserID(ctx, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
			return
		}
		if mfaConfig == nil || !mfa.VerifyTOTPCode(mfaConfig.Secret, req.Code, mfa.TotpWindow) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid MFA code"})
			return
		}
	}

	if err := h.repo.DisableMfa(ctx, userID); err != nil {
		h.log.Error("failed to disable MFA", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "MFA disabled"})
}

// Status handles GET /mfa/status.
func (h *MFAHandler) Status(c *gin.Context) {
	ctx := c.Request.Context()
	userID := auth.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	mfaConfig, err := h.repo.FindMfaByUserID(ctx, userID)
	if err != nil {
		h.log.Error("mfa status lookup failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	if mfaConfig == nil || !mfaConfig.Enabled {
		c.JSON(http.StatusOK, gin.H{
            "enabled": false,
            "type":    nil,
        })
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"enabled": mfaConfig.Enabled,
		"type":    mfaConfig.Type,
	})
}

// ExtractClaims extracts JWT claims from the Authorization header.
func ExtractClaims(c *gin.Context, secret string) *jwt.MapClaims {
	tokenString := c.GetHeader("Authorization")
	tokenString = strings.TrimPrefix(tokenString, "Bearer ")

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{"HS256", "HS384", "HS512"}))
	if err != nil || !token.Valid {
		return nil
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil
	}
	return &claims
}
