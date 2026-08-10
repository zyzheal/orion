package handler

import (
        "time"

        "github.com/gin-gonic/gin"
        "orion/go-common/pkg/auth"
        "orion/platform-svc-go/internal/middleware/handler/models"
        "orion/platform-svc-go/internal/middleware/service"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
        g := rg.Group("/middleware")
        g.POST("/rate-limit", auth.RequirePermission("middleware", "write"), h.RegisterRateLimit)
        g.GET("/rate-limit", auth.RequirePermission("middleware", "read"), h.GetRateLimit)
        g.PUT("/config", auth.RequirePermission("middleware", "write"), h.UpdateMiddleware)
        g.GET("/stats", auth.RequirePermission("middleware", "read"), h.GetStats)
        g.PUT("/timeout", auth.RequirePermission("middleware", "write"), h.SetTimeout)
        g.GET("/trace-id", auth.RequirePermission("middleware", "read"), h.GenerateTraceID)
}

func (h *Handler) RegisterRateLimit(c *gin.Context) {
        var req models.RateLimitConfig
        if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
        if err := h.svc.RegisterRateLimit(c.Request.Context(), c.GetString("tenant_id"), &req); err != nil {
                c.JSON(500, gin.H{"error": err.Error()}); return
        }
        c.JSON(201, gin.H{"status": "registered"})
}

func (h *Handler) GetRateLimit(c *gin.Context) {
        cfg, err := h.svc.GetRateLimit(c.Request.Context(), c.GetString("tenant_id"))
        if err != nil { c.JSON(404, gin.H{"error": err.Error()}); return }
        c.JSON(200, gin.H{"data": cfg})
}

func (h *Handler) UpdateMiddleware(c *gin.Context) {
        var req models.MiddlewareUpdateRequest
        if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
        if err := h.svc.UpdateMiddleware(c.Request.Context(), c.GetString("tenant_id"), &req); err != nil {
                c.JSON(500, gin.H{"error": err.Error()}); return
        }
        c.JSON(200, gin.H{"status": "updated"})
}

func (h *Handler) GetStats(c *gin.Context) {
        stats := h.svc.GetStats(c.Request.Context(), c.GetString("tenant_id"))
        c.JSON(200, gin.H{"data": stats})
}

func (h *Handler) SetTimeout(c *gin.Context) {
        var req struct { Timeout string `json:"timeout" binding:"required"` }
        if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
        dur, err := time.ParseDuration(req.Timeout)
        if err != nil { c.JSON(400, gin.H{"error": "invalid duration"}); return }
        h.svc.SetTimeout(c.Request.Context(), c.GetString("tenant_id"), dur)
        c.JSON(200, gin.H{"status": "updated"})
}

func (h *Handler) GenerateTraceID(c *gin.Context) {
        id := h.svc.GenerateTraceID(c.Request.Context(), c.GetString("tenant_id"))
        c.JSON(200, gin.H{"trace_id": id})
}
