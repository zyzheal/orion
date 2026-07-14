package handler

import (
        "strconv"
        "time"

        "orion/go-common/pkg/auth"
        "orion/platform-svc-go/internal/auth-enhanced/models"
        "orion/platform-svc-go/internal/auth-enhanced/service"

        "github.com/gin-gonic/gin"
)

type Handler struct {
        svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
        return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
        f := rg.Group("/auth-enhanced")

        // Key management
        f.POST("/keys", auth.RequirePermission("auth-enhanced", "write"), h.CreateKey)
        f.GET("/keys", auth.RequirePermission("auth-enhanced", "read"), h.ListKeys)
        f.GET("/keys/:id", auth.RequirePermission("auth-enhanced", "read"), h.GetKey)
        f.PUT("/keys/:id/deactivate", auth.RequirePermission("auth-enhanced", "write"), h.DeactivateKey)
        f.DELETE("/keys/:id", auth.RequirePermission("auth-enhanced", "delete"), h.DeleteKey)

        // Token blacklist
        f.POST("/blacklist", auth.RequirePermission("auth-enhanced", "write"), h.BlacklistToken)
        f.GET("/blacklist", auth.RequirePermission("auth-enhanced", "read"), h.ListBlacklist)
        f.DELETE("/blacklist/:id", auth.RequirePermission("auth-enhanced", "delete"), h.DeleteBlacklist)
}

func (h *Handler) CreateKey(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        var req models.CreateAuthKeyRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(400, gin.H{"error": err.Error()})
                return
        }
        result, err := h.svc.CreateKey(c.Request.Context(), tenantID, &req)
        if err != nil {
                c.JSON(500, gin.H{"error": err.Error()})
                return
        }
        c.JSON(201, result)
}

func (h *Handler) GetKey(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        id := c.Param("id")
        result, err := h.svc.GetKey(c.Request.Context(), tenantID, id)
        if err != nil {
                c.JSON(404, gin.H{"error": "key not found"})
                return
        }
        c.JSON(200, result)
}

func (h *Handler) ListKeys(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        status := c.Query("status")
        keys, err := h.svc.ListKeys(c.Request.Context(), tenantID, &status)
        if err != nil {
                c.JSON(500, gin.H{"error": err.Error()})
                return
        }
        c.JSON(200, gin.H{"data": keys})
}

func (h *Handler) DeactivateKey(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        id := c.Param("id")
        if err := h.svc.DeactivateKey(c.Request.Context(), tenantID, id); err != nil {
                c.JSON(404, gin.H{"error": "key not found"})
                return
        }
        c.JSON(200, gin.H{"message": "key deactivated"})
}

func (h *Handler) DeleteKey(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        id := c.Param("id")
        deleted, err := h.svc.DeleteKey(c.Request.Context(), tenantID, id)
        if err != nil {
                c.JSON(500, gin.H{"error": err.Error()})
                return
        }
        if !deleted {
                c.JSON(404, gin.H{"error": "key not found"})
                return
        }
        c.JSON(200, gin.H{"message": "key deleted"})
}

func (h *Handler) BlacklistToken(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        var req models.CreateBlacklistRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(400, gin.H{"error": err.Error()})
                return
        }
        expiresAt := time.Now().UTC().Add(24 * time.Hour)
        if hours := c.Query("expiresHours"); hours != "" {
                if h, err := strconv.Atoi(hours); err == nil && h > 0 {
                        expiresAt = time.Now().UTC().Add(time.Duration(h) * time.Hour)
                }
        }
        result, err := h.svc.BlacklistToken(c.Request.Context(), tenantID, &req, expiresAt)
        if err != nil {
                c.JSON(400, gin.H{"error": err.Error()})
                return
        }
        c.JSON(201, result)
}

func (h *Handler) ListBlacklist(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        tokens, err := h.svc.ListBlacklist(c.Request.Context(), tenantID)
        if err != nil {
                c.JSON(500, gin.H{"error": err.Error()})
                return
        }
        c.JSON(200, gin.H{"data": tokens})
}

func (h *Handler) DeleteBlacklist(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        id := c.Param("id")
        deleted, err := h.svc.DeleteBlacklist(c.Request.Context(), tenantID, id)
        if err != nil {
                c.JSON(500, gin.H{"error": err.Error()})
                return
        }
        if !deleted {
                c.JSON(404, gin.H{"error": "blacklist entry not found"})
                return
        }
        c.JSON(200, gin.H{"message": "blacklist entry deleted"})
}
