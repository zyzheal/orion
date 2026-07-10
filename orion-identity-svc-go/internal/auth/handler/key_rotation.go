package handler

import (
	"net/http"

	"orion/identity-svc-go/internal/auth/keyrotation"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// KeyRotationHandler handles JWT key lifecycle routes.
type KeyRotationHandler struct {
	svc *keyrotation.KeyRotationService
	log *zap.Logger
}

func NewKeyRotationHandler(svc *keyrotation.KeyRotationService, log *zap.Logger) *KeyRotationHandler {
	return &KeyRotationHandler{svc: svc, log: log}
}

// ListKeys handles GET /keys.
func (h *KeyRotationHandler) ListKeys(c *gin.Context) {
	keys, err := h.svc.ListKeys()
	if err != nil {
		h.log.Error("failed to list keys", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"keys": keys,
		"total": len(keys),
	})
}

// GenerateKey handles POST /keys.
func (h *KeyRotationHandler) GenerateKey(c *gin.Context) {
	key, err := h.svc.Generate()
	if err != nil {
		h.log.Error("failed to generate key", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"key": key,
		"message": "key generated (pending activation)",
	})
}

// RotateKey handles POST /keys/rotate.
func (h *KeyRotationHandler) RotateKey(c *gin.Context) {
	newKey, err := h.svc.Rotate()
	if err != nil {
		h.log.Error("failed to rotate key", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"key":     newKey,
		"message": "key rotated successfully",
	})
}

// EmergencyRotateKey handles POST /keys/emergency-rotate.
func (h *KeyRotationHandler) EmergencyRotateKey(c *gin.Context) {
	newKey, err := h.svc.EmergencyRotate()
	if err != nil {
		h.log.Error("failed to emergency rotate key", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"key":     newKey,
		"message": "emergency key rotation completed (previous key expired immediately)",
	})
}

// KeyStats handles GET /keys/stats.
func (h *KeyRotationHandler) KeyStats(c *gin.Context) {
	stats, err := h.svc.GetKeyStats()
	if err != nil {
		h.log.Error("failed to get key stats", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"stats": stats,
	})
}
