package handler

import (
    "net/http"

    "orion/go-common/pkg/auth"
    "orion/go-common/pkg/errors"
    "orion/platform-svc-go/internal/privacy/models"
    "orion/platform-svc-go/internal/privacy/service"

    "github.com/gin-gonic/gin"
)

type Handler struct {
    svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
    return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
    r := rg.Group("/privacy")
    r.GET("", auth.RequirePermission("privacy", "read"), h.GetConfig)
    r.PUT("", auth.RequirePermission("privacy", "write"), h.UpsertConfig)
    r.DELETE("", auth.RequirePermission("privacy", "write"), h.DeleteConfig)
    r.GET("/compliance", auth.RequirePermission("privacy", "read"), h.ListComplianceStatus)
}

func (h *Handler) GetConfig(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    config, err := h.svc.GetPrivacyConfig(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrNotFound, "config not found", http.StatusNotFound)
        return
    }
    errors.WriteSuccess(c, config)
}

func (h *Handler) UpsertConfig(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    var config models.PrivacyConfig
    if err := c.ShouldBindJSON(&config); err != nil {
        errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
        return
    }
    result, err := h.svc.UpsertPrivacyConfig(ctx, tenantID, &config)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, result)
}

func (h *Handler) DeleteConfig(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    err := h.svc.DeletePrivacyConfig(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"message": "privacy config deleted"})
}

func (h *Handler) ListComplianceStatus(c *gin.Context) {
    ctx := c.Request.Context()
    statuses, err := h.svc.ListComplianceStatus(ctx)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, statuses)
}
