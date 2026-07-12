package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"orion-ticket-svc-go/internal/service"
)

type AnalyticsHandler struct {
	svc *service.AnalyticsService
}

func NewAnalyticsHandler(svc *service.AnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{svc: svc}
}

// GetStatistics GET /api/v1/tickets/stats
func (h *AnalyticsHandler) GetStatistics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetStatistics(c.Request.Context(), tenantID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, stats)
}

// GetResolutionStats GET /api/v1/tickets/reports/resolution
func (h *AnalyticsHandler) GetResolutionStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetResolutionStats(c.Request.Context(), tenantID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, stats)
}

// GetBacklogAnalysis GET /api/v1/tickets/reports/backlog
func (h *AnalyticsHandler) GetBacklogAnalysis(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	analysis, err := h.svc.GetBacklogAnalysis(c.Request.Context(), tenantID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, analysis)
}

// GetTrendReport GET /api/v1/tickets/reports/trend
func (h *AnalyticsHandler) GetTrendReport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	days, _ := strconv.Atoi(c.Query("days"))
	granularity := c.Query("granularity")

	report, err := h.svc.GetTrendReport(c.Request.Context(), tenantID, days, granularity)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, report)
}

// GetExecutiveDashboard GET /api/v1/tickets/bi/dashboard/executive
func (h *AnalyticsHandler) GetExecutiveDashboard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	dash, err := h.svc.GetExecutiveDashboard(c.Request.Context(), tenantID, start, end)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, dash)
}

// GetManagerDashboard GET /api/v1/tickets/bi/dashboard/manager
func (h *AnalyticsHandler) GetManagerDashboard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	dash, err := h.svc.GetManagerDashboard(c.Request.Context(), tenantID, start, end)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, dash)
}

// GetEngineerDashboard GET /api/v1/tickets/bi/dashboard/engineer/:engineerId
func (h *AnalyticsHandler) GetEngineerDashboard(c *gin.Context) {
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	dash, err := h.svc.GetEngineerDashboard(c.Request.Context(), c.Param("engineerId"), start, end)
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, dash)
}

// GetEfficiencyScore GET /api/v1/tickets/bi/score/:engineerId
func (h *AnalyticsHandler) GetEfficiencyScore(c *gin.Context) {
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	score, err := h.svc.GetEfficiencyScore(c.Request.Context(), c.Param("engineerId"), start, end)
	if err != nil {
		respondError(c, http.StatusNotFound, err)
		return
	}
	respondSuccess(c, score)
}

// ComparePeriods GET /api/v1/tickets/bi/compare
func (h *AnalyticsHandler) ComparePeriods(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	currentStart := parseTime(c.Query("currentStart"))
	currentEnd := parseTime(c.Query("currentEnd"))
	previousStart := parseTime(c.Query("previousStart"))
	previousEnd := parseTime(c.Query("previousEnd"))

	comparison, err := h.svc.ComparePeriods(c.Request.Context(), tenantID, currentStart, currentEnd, previousStart, previousEnd)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, comparison)
}

// ExportBIData POST /api/v1/tickets/bi/export
func (h *AnalyticsHandler) ExportBIData(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req struct {
		Dataset     string `json:"dataset" binding:"required"`
		Granularity string `json:"granularity"`
		PeriodStart string `json:"period_start"`
		PeriodEnd   string `json:"period_end"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	validDatasets := map[string]bool{"tickets": true, "sla": true, "dispatch": true, "efficiency": true}
	if !validDatasets[req.Dataset] {
		respondBadRequest(c, "invalid dataset")
		return
	}

	data, err := h.svc.ExportBIData(c.Request.Context(), tenantID, req.Dataset, req.Granularity,
		parseTime(req.PeriodStart), parseTime(req.PeriodEnd))
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, data)
}

// GetTimeTrend GET /api/v1/tickets/bi/trend
func (h *AnalyticsHandler) GetTimeTrend(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	metric := c.Query("metric")
	if metric == "" {
		metric = "volume"
	}
	start := parseTime(c.Query("start"))
	end := parseTime(c.Query("end"))
	granularity := c.Query("granularity")
	if granularity == "" {
		granularity = "day"
	}

	trend, err := h.svc.GetTimeTrend(c.Request.Context(), tenantID, metric, start, end, granularity)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, trend)
}

// TransferTicket POST /api/v1/tickets/transfer/:ticketId
func (h *AnalyticsHandler) TransferTicket(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ticketID := c.Param("ticketId")

	var req struct {
		ToEngineerID string `json:"to_engineer_id" binding:"required"`
		InitiatedBy  string `json:"initiated_by" binding:"required"`
		Reason       string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	record, holdMs, err := h.svc.TransferTicket(c.Request.Context(), ticketID, tenantID, req.ToEngineerID, req.InitiatedBy, req.Reason)
	if err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	respondSuccess(c, gin.H{"transfer": record, "hold_duration_ms": holdMs})
}

// GetTransferHistory GET /api/v1/tickets/transfer/:ticketId/history
func (h *AnalyticsHandler) GetTransferHistory(c *gin.Context) {
	history, err := h.svc.GetTransferHistory(c.Request.Context(), c.Param("ticketId"))
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, gin.H{"history": history, "count": len(history)})
}

// GetTransferStats GET /api/v1/tickets/transfer/stats
func (h *AnalyticsHandler) GetTransferStats(c *gin.Context) {
	start := parseTime(c.Query("periodStart"))
	end := parseTime(c.Query("periodEnd"))

	stats, err := h.svc.GetTransferStats(c.Request.Context(), start, end)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, stats)
}

// Assignment rule handlers

type AssignmentRuleHandler struct {
	svc *service.TicketService
}

func NewAssignmentRuleHandler(svc *service.TicketService) *AssignmentRuleHandler {
	return &AssignmentRuleHandler{svc: svc}
}

func parseTime(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t, _ = time.Parse("2006-01-02", s)
	}
	return t
}
