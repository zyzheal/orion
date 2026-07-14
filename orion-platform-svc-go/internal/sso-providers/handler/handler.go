package handler

import (
        "orion/go-common/pkg/auth"
        "orion/platform-svc-go/internal/sso-providers/models"
        "orion/platform-svc-go/internal/sso-providers/service"

        "github.com/gin-gonic/gin"
)

type Handler struct {
        svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
        return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
        f := rg.Group("/sso-providers")

        f.POST("", auth.RequirePermission("sso-providers", "write"), h.CreateProvider)
        f.GET("", auth.RequirePermission("sso-providers", "read"), h.ListProviders)
        f.GET("/:id", auth.RequirePermission("sso-providers", "read"), h.GetProvider)
        f.PUT("/:id", auth.RequirePermission("sso-providers", "write"), h.UpdateProvider)
        f.DELETE("/:id", auth.RequirePermission("sso-providers", "delete"), h.DeleteProvider)
        f.POST("/:id/test", auth.RequirePermission("sso-providers", "write"), h.TestConnection)
}

func (h *Handler) CreateProvider(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        var req models.CreateSSOProviderRequest
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

func (h *Handler) GetProvider(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        id := c.Param("id")
        provider, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
        if err != nil {
                c.JSON(404, gin.H{"error": "provider not found"})
                return
        }
        c.JSON(200, provider)
}

func (h *Handler) ListProviders(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        filter := &models.SSOProviderFilter{}
        if t := c.Query("type"); t != "" {
                filter.Type = &t
        }
        if e := c.Query("enabled"); e != "" {
                b := e == "true" || e == "1"
                filter.Enabled = &b
        }
        providers, total, err := h.svc.List(c.Request.Context(), tenantID, filter)
        if err != nil {
                c.JSON(500, gin.H{"error": err.Error()})
                return
        }
        c.JSON(200, gin.H{"data": providers, "total": total})
}

func (h *Handler) UpdateProvider(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        id := c.Param("id")
        var req models.UpdateSSOProviderRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                c.JSON(400, gin.H{"error": err.Error()})
                return
        }
        result, err := h.svc.Update(c.Request.Context(), tenantID, id, &req)
        if err != nil {
                c.JSON(404, gin.H{"error": "provider not found"})
                return
        }
        c.JSON(200, result)
}

func (h *Handler) DeleteProvider(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        id := c.Param("id")
        deleted, err := h.svc.Delete(c.Request.Context(), tenantID, id)
        if err != nil {
                c.JSON(500, gin.H{"error": err.Error()})
                return
        }
        if !deleted {
                c.JSON(404, gin.H{"error": "provider not found"})
                return
        }
        c.JSON(200, gin.H{"message": "provider deleted"})
}

func (h *Handler) TestConnection(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        id := c.Param("id")
        ok, msg, err := h.svc.TestConnection(c.Request.Context(), tenantID, id)
        if err != nil {
                c.JSON(404, gin.H{"error": "provider not found"})
                return
        }
        c.JSON(200, gin.H{"success": ok, "message": msg})
}
