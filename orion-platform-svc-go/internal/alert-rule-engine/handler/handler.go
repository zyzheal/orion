package handler

import (
        "github.com/gin-gonic/gin"
        "orion/go-common/pkg/auth"
        "orion/platform-svc-go/internal/alert-rule-engine"
        "orion/platform-svc-go/internal/alert-rule-engine/handler/models"
        "orion/platform-svc-go/internal/alert-rule-engine/service"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
        g := rg.Group("/alert-rules")
        g.POST("/compile", auth.RequirePermission("alert", "write"), h.CompileRule)
        g.DELETE("/:id", auth.RequirePermission("alert", "delete"), h.UnregisterRule)
        g.GET("/:id", auth.RequirePermission("alert", "read"), h.GetRule)
        g.GET("", auth.RequirePermission("alert", "read"), h.ListRules)
        g.POST("/:id/update", auth.RequirePermission("alert", "write"), h.UpdateRule)
        g.GET("/stats", auth.RequirePermission("alert", "read"), h.Stats)
        g.POST("/evaluate", auth.RequirePermission("alert", "execute"), h.Evaluate)
        g.POST("/:id/reset-cooldown", auth.RequirePermission("alert", "write"), h.ResetCooldown)
}

func (h *Handler) CompileRule(c *gin.Context) {
        var req models.RuleRequest
        if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
        resp, err := h.svc.CompileRule(c.Request.Context(), c.GetString("tenant_id"), &req)
        if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
        c.JSON(201, gin.H{"data": resp})
}

func (h *Handler) UnregisterRule(c *gin.Context) {
        if err := h.svc.UnregisterRule(c.Request.Context(), c.GetString("tenant_id"), c.Param("id")); err != nil {
                c.JSON(500, gin.H{"error": err.Error()}); return
        }
        c.JSON(200, gin.H{"status": "deleted"})
}

func (h *Handler) GetRule(c *gin.Context) {
        resp, err := h.svc.GetRule(c.Request.Context(), c.GetString("tenant_id"), c.Param("id"))
        if err != nil { c.JSON(404, gin.H{"error": err.Error()}); return }
        c.JSON(200, gin.H{"data": resp})
}

func (h *Handler) ListRules(c *gin.Context) {
        group := c.Query("group")
        rules, err := h.svc.ListRules(c.Request.Context(), c.GetString("tenant_id"), group)
        if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
        c.JSON(200, gin.H{"data": rules})
}

func (h *Handler) UpdateRule(c *gin.Context) {
        var req models.RuleUpdateRequest
        if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
        if err := h.svc.UpdateRule(c.Request.Context(), c.GetString("tenant_id"), c.Param("id"), &req); err != nil {
                c.JSON(500, gin.H{"error": err.Error()}); return
        }
        c.JSON(200, gin.H{"status": "updated"})
}

func (h *Handler) Stats(c *gin.Context) {
        stats, err := h.svc.Stats(c.Request.Context(), c.GetString("tenant_id"))
        if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
        c.JSON(200, gin.H{"data": stats})
}

func (h *Handler) Evaluate(c *gin.Context) {
        var req struct { Metrics []map[string]interface{} `json:"metrics" binding:"required"` }
        if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
        builder := alertruleengine.NewSnapshotBuilder()
        for _, m := range req.Metrics {
                name, _ := m["name"].(string)
                val, _ := m["value"].(float64)
                builder.AddMetric(name, val)
        }
        snapshot := builder.Build()
        results, err := h.svc.Evaluate(c.Request.Context(), c.GetString("tenant_id"), snapshot)
        if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
        c.JSON(200, gin.H{"data": results})
}

func (h *Handler) ResetCooldown(c *gin.Context) {
        if err := h.svc.ResetCooldown(c.Request.Context(), c.GetString("tenant_id"), c.Param("id")); err != nil {
                c.JSON(500, gin.H{"error": err.Error()}); return
        }
        c.JSON(200, gin.H{"status": "reset"})
}
