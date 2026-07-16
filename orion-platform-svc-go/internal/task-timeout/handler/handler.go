package handler

import (
    "net/http"

    "orion/go-common/pkg/auth"
    "orion/go-common/pkg/errors"
    "orion/platform-svc-go/internal/task-timeout/service"

    "github.com/gin-gonic/gin"
)

type Handler struct {
    svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
    return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
    r := rg.Group("/task-timeout")
    r.GET("", auth.RequirePermission("task-timeout", "read"), h.GetTimeouts)
    r.PUT("", auth.RequirePermission("task-timeout", "write"), h.SetTimeouts)
}

func (h *Handler) GetTimeouts(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    timeouts, err := h.svc.GetTimeouts(ctx, tenantID)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"data": timeouts})
}

func (h *Handler) SetTimeouts(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    ctx := c.Request.Context()
    var req struct {
        DefaultTimeout int `json:"defaultTimeout" binding:"required"`
        MaxTimeout     int `json:"maxTimeout"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
        return
    }
    err := h.svc.SetTimeouts(ctx, tenantID, req.DefaultTimeout, req.MaxTimeout)
    if err != nil {
        errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
        return
    }
    errors.WriteSuccess(c, gin.H{"ok": true})
}
