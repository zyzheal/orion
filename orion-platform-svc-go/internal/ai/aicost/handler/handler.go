package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/ai/aicost/models"
	"orion/platform-svc-go/internal/ai/aicost/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/ai/cost")
	{
		r.POST("/optimize", auth.RequirePermission("ai-cost", "write"), h.Optimize)
		r.GET("/history", auth.RequirePermission("ai-cost", "read"), h.GetHistory)
		r.GET("/summary", auth.RequirePermission("ai-cost", "read"), h.GetSummary)
		r.GET("/alerts", auth.RequirePermission("ai-cost", "read"), h.GetAlerts)
	}
}

// Optimize handles POST /ai/cost/optimize
func (h *Handler) Optimize(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "OptimizeAICost")
	defer span.End()
	_ = ctx
	tenantID := c.GetString("tenant_id")

	var req models.OptimizeRequest
	if err := c.ShouldBindJSON(&req); err == nil && req.TenantID != "" {
		tenantID = req.TenantID
	}

	analysis := h.svc.AnalyzeCostSavings(tenantID)
	recommendations, err := h.svc.RecommendOptimization(tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondCreated(c, models.OptimizeResponse{
		Analysis:        analysis,
		Recommendations: recommendations,
	})
}

// GetHistory handles GET /ai/cost/history
func (h *Handler) GetHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAICostHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	history, err := h.svc.GetSavingsHistory(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"data": history, "total": len(history)})
}

// GetSummary handles GET /ai/cost/summary
func (h *Handler) GetSummary(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAICostSummary")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	analysis := h.svc.AnalyzeCostSavings(tenantID)
	totalSavings, err := h.svc.GetTotalSavings(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, models.CostSummary{
		TotalSpend:         analysis.TotalSpend,
		TotalSavingsToDate: totalSavings,
		OpportunityCount:   len(analysis.Opportunities),
		Currency:           analysis.Currency,
	})
}

// GetAlerts handles GET /ai/cost/alerts
func (h *Handler) GetAlerts(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAICostAlerts")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	alerts := h.svc.GenerateAlerts(tenantID)

	respondSuccess(c, gin.H{"data": alerts, "total": len(alerts)})
}
