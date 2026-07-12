package handler

import (
	"orion/ai-svc-go/internal/aicost/models"
	"orion/ai-svc-go/internal/aicost/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
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
		},)
}

// GetHistory handles GET /ai/cost/history
func (h *Handler) GetHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	history, err := h.svc.GetSavingsHistory(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, history,
		"meta": gin.H{"total": len(history)},)
}

// GetSummary handles GET /ai/cost/summary
func (h *Handler) GetSummary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	analysis := h.svc.AnalyzeCostSavings(tenantID)
	totalSavings, err := h.svc.GetTotalSavings(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, models.CostSummary{
			TotalSpend:        analysis.TotalSpend,
			TotalSavingsToDate: totalSavings,
			OpportunityCount:  len(analysis.Opportunities),
			Currency:          analysis.Currency,
		},)
}

// GetAlerts handles GET /ai/cost/alerts
func (h *Handler) GetAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	alerts := h.svc.GenerateAlerts(tenantID)

	respondSuccess(c, alerts,
		"meta": gin.H{"total": len(alerts)},)
}