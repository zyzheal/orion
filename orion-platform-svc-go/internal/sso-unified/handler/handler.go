package handler

import (
        "orion/go-common/pkg/auth"
        "orion/platform-svc-go/internal/sso-unified/models"
        "orion/platform-svc-go/internal/sso-unified/service"

        "github.com/gin-gonic/gin"
	"orion/go-common/pkg/errors"
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
                errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
                return
        }
        result, err := h.svc.Create(c.Request.Context(), tenantID, &req)
        if err != nil {
                errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
                return
        }
        c.JSON(201, result)
}

func (h *Handler) ListConfigs(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        configs, err := h.svc.GetAll(c.Request.Context(), tenantID)
        if err != nil {
                errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
                return
        }
        errors.WriteSuccess(c, configs)
}

func (h *Handler) GetConfig(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        provider := c.Param("provider")
        config, err := h.svc.Get(c.Request.Context(), tenantID, provider)
        if err != nil {
                errors.WriteError(c, errors.ErrNotFound, "config not found", 404)
                return
        }
        c.JSON(200, config)
}

func (h *Handler) UpdateConfig(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        provider := c.Param("provider")
        var req models.UpdateSSOConfigRequest
        if err := c.ShouldBindJSON(&req); err != nil {
                errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
                return
        }
        result, err := h.svc.Update(c.Request.Context(), tenantID, provider, &req)
        if err != nil {
                errors.WriteError(c, errors.ErrNotFound, "config not found", 404)
                return
        }
        c.JSON(200, result)
}

func (h *Handler) DeleteConfig(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        provider := c.Param("provider")
        deleted, err := h.svc.Delete(c.Request.Context(), tenantID, provider)
        if err != nil {
                errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
                return
        }
        if !deleted {
                errors.WriteError(c, errors.ErrNotFound, "config not found", 404)
                return
        }
        errors.WriteSuccess(c, gin.H{"message": "config deleted"})
}
