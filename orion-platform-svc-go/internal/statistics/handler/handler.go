package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IngestStat")
	defer span.End()
	var req models.StatMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.Ingest(ctx, c.GetString("tenant_id"), &req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"status": "ingested"})
}

func (h *Handler) IngestBatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "IngestBatchStats")
	defer span.End()
	var req struct {
		Metrics []models.StatMetricRequest `json:"metrics" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.IngestBatch(ctx, c.GetString("tenant_id"), req.Metrics); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"status": "ingested", "count": len(req.Metrics)})
}

func (h *Handler) Aggregate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AggregateStats")
	defer span.End()
	var req models.AggregateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Aggregate(ctx, c.GetString("tenant_id"), &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) AggregateAll(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AggregateAllStats")
	defer span.End()
	window := c.Query("window")
	if window == "" {
		window = "5m"
	}
	results, err := h.svc.AggregateAll(ctx, c.GetString("tenant_id"), window)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, results)
}

func (h *Handler) Prune(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "PruneStats")
	defer span.End()
	pruned, err := h.svc.Prune(ctx, c.GetString("tenant_id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"pruned": pruned})
}

func (h *Handler) Stats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	stats := h.svc.Stats(ctx, c.GetString("tenant_id"))
	middleware.RespondSuccess(c, stats)
}
