package handler

import (
        "github.com/gin-gonic/gin"
        "orion/go-common/pkg/auth"
        "orion/platform-svc-go/internal/statistics/handler/models"
        "orion/platform-svc-go/internal/statistics/service"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
        g := rg.Group("/stats")
        g.POST("/ingest", auth.RequirePermission("stats", "write"), h.Ingest)
        g.POST("/ingest/batch", auth.RequirePermission("stats", "write"), h.IngestBatch)
        g.POST("/aggregate", auth.RequirePermission("stats", "read"), h.Aggregate)
        g.GET("/aggregate-all", auth.RequirePermission("stats", "read"), h.AggregateAll)
        g.POST("/prune", auth.RequirePermission("stats", "manage"), h.Prune)
        g.GET("/stats", auth.RequirePermission("stats", "read"), h.Stats)
}

func (h *Handler) Ingest(c *gin.Context) {
        var req models.StatMetricRequest
        if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
        if err := h.svc.Ingest(c.Request.Context(), c.GetString("tenant_id"), &req); err != nil {
                c.JSON(500, gin.H{"error": err.Error()}); return
        }
        c.JSON(201, gin.H{"status": "ingested"})
}

func (h *Handler) IngestBatch(c *gin.Context) {
        var req struct { Metrics []models.StatMetricRequest `json:"metrics" binding:"required"` }
        if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
        if err := h.svc.IngestBatch(c.Request.Context(), c.GetString("tenant_id"), req.Metrics); err != nil {
                c.JSON(500, gin.H{"error": err.Error()}); return
        }
        c.JSON(201, gin.H{"status": "ingested", "count": len(req.Metrics)})
}

func (h *Handler) Aggregate(c *gin.Context) {
        var req models.AggregateRequest
        if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
        result, err := h.svc.Aggregate(c.Request.Context(), c.GetString("tenant_id"), &req)
        if err != nil { c.JSON(404, gin.H{"error": err.Error()}); return }
        c.JSON(200, gin.H{"data": result})
}

func (h *Handler) AggregateAll(c *gin.Context) {
        window := c.Query("window")
        if window == "" { window = "5m" }
        results, err := h.svc.AggregateAll(c.Request.Context(), c.GetString("tenant_id"), window)
        if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
        c.JSON(200, gin.H{"data": results})
}

func (h *Handler) Prune(c *gin.Context) {
        pruned, err := h.svc.Prune(c.Request.Context(), c.GetString("tenant_id"))
        if err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
        c.JSON(200, gin.H{"pruned": pruned})
}

func (h *Handler) Stats(c *gin.Context) {
        stats := h.svc.Stats(c.Request.Context(), c.GetString("tenant_id"))
        c.JSON(200, gin.H{"data": stats})
}
