package handler

import (
	"go.opentelemetry.io/otel"
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/ticketing/service"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingGetHeatmapData")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	data, err := h.svc.GetHeatmapData(ctx, tenantID, start, end)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, data)
}

// GetBottleneckAnalysis GET /api/v1/tickets/bi/bottlenecks
func (h *AnalyticsEnhancedHandler) GetBottleneckAnalysis(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingGetBottleneckAnalysis")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	analysis, err := h.svc.GetBottleneckAnalysis(ctx, tenantID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, analysis)
}

// GetCategoryBreakdown GET /api/v1/tickets/bi/engineer/:engineerId/categories
func (h *AnalyticsEnhancedHandler) GetCategoryBreakdown(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingGetCategoryBreakdown")
	defer span.End()
	breakdown, err := h.svc.GetCategoryBreakdown(ctx, c.Param("engineerId"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, breakdown)
}

// GetManagerDashboardEnhanced GET /api/v1/tickets/bi/dashboard/manager-enhanced
func (h *AnalyticsEnhancedHandler) GetManagerDashboardEnhanced(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingGetManagerDashboardEnhanced")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	dash, err := h.svc.GetManagerDashboardEnhanced(ctx, tenantID, start, end)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, dash)
}

// GetEngineerDashboardEnhanced GET /api/v1/tickets/bi/dashboard/engineer-enhanced/:engineerId
func (h *AnalyticsEnhancedHandler) GetEngineerDashboardEnhanced(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TicketingGetEngineerDashboardEnhanced")
	defer span.End()
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	dash, err := h.svc.GetEngineerDashboardEnhanced(ctx, c.Param("engineerId"), start, end)
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, dash)
}
