package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/workflow-svc-go/internal/ticket/service"
)

// AnalyticsEnhancedHandler handles advanced BI analytics HTTP requests
type AnalyticsEnhancedHandler struct {
	svc *service.AnalyticsEnhanced
}

func NewAnalyticsEnhancedHandler(svc *service.AnalyticsEnhanced) *AnalyticsEnhancedHandler {
	return &AnalyticsEnhancedHandler{svc: svc}
}

// GetHeatmapData GET /api/v1/tickets/bi/heatmap
func (h *AnalyticsEnhancedHandler) GetHeatmapData(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	data, err := h.svc.GetHeatmapData(c.Request.Context(), tenantID, start, end)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, data)
}

// GetBottleneckAnalysis GET /api/v1/tickets/bi/bottlenecks
func (h *AnalyticsEnhancedHandler) GetBottleneckAnalysis(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	analysis, err := h.svc.GetBottleneckAnalysis(c.Request.Context(), tenantID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, analysis)
}

// GetCategoryBreakdown GET /api/v1/tickets/bi/engineer/:engineerId/categories
func (h *AnalyticsEnhancedHandler) GetCategoryBreakdown(c *gin.Context) {
	breakdown, err := h.svc.GetCategoryBreakdown(c.Request.Context(), c.Param("engineerId"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, breakdown)
}

// GetManagerDashboardEnhanced GET /api/v1/tickets/bi/dashboard/manager-enhanced
func (h *AnalyticsEnhancedHandler) GetManagerDashboardEnhanced(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	dash, err := h.svc.GetManagerDashboardEnhanced(c.Request.Context(), tenantID, start, end)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, dash)
}

// GetEngineerDashboardEnhanced GET /api/v1/tickets/bi/dashboard/engineer-enhanced/:engineerId
func (h *AnalyticsEnhancedHandler) GetEngineerDashboardEnhanced(c *gin.Context) {
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	dash, err := h.svc.GetEngineerDashboardEnhanced(c.Request.Context(), c.Param("engineerId"), start, end)
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, dash)
}
