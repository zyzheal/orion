package handler

import (
        "orion/go-common/pkg/auth"
        "orion/platform-svc-go/internal/sso-unified/models"
        "orion/platform-svc-go/internal/sso-unified/service"

        "github.com/gin-gonic/gin"
)

type Handler struct {
        svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
        return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
        f := rg.Group("/sso-unified")

        f.POST("", auth.RequirePermission("sso-unified", "write"), h.CreateConfig)
        f.GET("", auth.RequirePermission("sso-unified", "read"), h.ListConfigs)
        f.GET("/:provider", auth.RequirePermission("sso-unified", "read"), h.GetConfig)
        f.PUT("/:provider", auth.RequirePermission("sso-unified", "write"), h.UpdateConfig)
        f.DELETE("/:provider", auth.RequirePermission("sso-unified", "delete"), h.DeleteConfig)
}

func (h *Handler) CreateConfig(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        var req models.CreateSSOConfigRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(400, gin.H{"error": err.Error()})
                return
        }
        result, err := h.svc.Create(c.Request.Context(), tenantID, &req)
        if err != nil {
                c.JSON(500, gin.H{"error": err.Error()})
                return
        }
        c.JSON(201, result)
}

func (h *Handler) ListConfigs(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        configs, err := h.svc.GetAll(c.Request.Context(), tenantID)
        if err != nil {
                c.JSON(500, gin.H{"error": err.Error()})
                return
        }
        c.JSON(200, gin.H{"data": configs})
}

func (h *Handler) GetConfig(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        provider := c.Param("provider")
        config, err := h.svc.Get(c.Request.Context(), tenantID, provider)
        if err != nil {
                c.JSON(404, gin.H{"error": "config not found"})
                return
        }
        c.JSON(200, config)
}

func (h *Handler) UpdateConfig(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        provider := c.Param("provider")
        var req models.UpdateSSOConfigRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(400, gin.H{"error": err.Error()})
                return
        }
        result, err := h.svc.Update(c.Request.Context(), tenantID, provider, &req)
        if err != nil {
                c.JSON(404, gin.H{"error": "config not found"})
                return
        }
        c.JSON(200, result)
}

func (h *Handler) DeleteConfig(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        provider := c.Param("provider")
        deleted, err := h.svc.Delete(c.Request.Context(), tenantID, provider)
        if err != nil {
                c.JSON(500, gin.H{"error": err.Error()})
                return
        }
        if !deleted {
                c.JSON(404, gin.H{"error": "config not found"})
                return
        }
        c.JSON(200, gin.H{"message": "config deleted"})
}
