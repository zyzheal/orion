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
    r.PUT("", auth.RequirePermission("privacy", "write"), h.UpdateConfig)
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

func (h *Handler) UpdateConfig(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    var config models.PrivacyConfig
    if err := c.ShouldBindJSON(&config); err != nil {
        errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
        return
    }
    err := h.svc.UpdatePrivacyConfig(ctx, tenantID, &config)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, nil)
}
