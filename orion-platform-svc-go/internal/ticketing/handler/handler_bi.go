package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/ticketing/models"
)

// GetExecutiveDashboard returns the executive BI dashboard.
func (h *Handler) GetExecutiveDashboard(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetExecutiveDashboard")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	dashboard, err := h.svc.GetExecutiveDashboard(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, dashboard)
}

// GetManagerDashboard returns the manager BI dashboard.
func (h *Handler) GetManagerDashboard(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetManagerDashboard")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	dashboard, err := h.svc.GetManagerDashboard(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, dashboard)
}

// GetEngineerDashboard returns the engineer BI dashboard.
func (h *Handler) GetEngineerDashboard(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEngineerDashboard")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	engineerID := c.Param("engineerId")
	dashboard, err := h.svc.GetEngineerDashboard(ctx, tenantID, engineerID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, dashboard)
}

// GetEngineerEfficiency returns efficiency metrics for an engineer.
func (h *Handler) GetEngineerEfficiency(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEngineerEfficiency")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	engineerID := c.Param("engineerId")
	efficiency, err := h.svc.GetEngineerEfficiency(ctx, tenantID, engineerID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, efficiency)
}

// GetEfficiencyScore returns the efficiency score for an engineer.
func (h *Handler) GetEfficiencyScore(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetEfficiencyScore")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	engineerID := c.Param("engineerId")
	score, err := h.svc.GetEfficiencyScore(ctx, tenantID, engineerID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, score)
}

// ComparePeriods compares BI data between two periods.
func (h *Handler) ComparePeriods(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ComparePeriods")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	current := c.Query("current")
	previous := c.Query("previous")
	if current == "" || previous == "" {
		middleware.RespondBadRequest(c, "current and previous period required")
		return
	}
	result, err := h.svc.ComparePeriods(ctx, tenantID, current, previous)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ExportBIData exports BI data based on the request parameters.
func (h *Handler) ExportBIData(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ExportBIData")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.BIDataExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.ExportBIData(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// GetTimeTrend returns time-series trend data.
func (h *Handler) GetTimeTrend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTimeTrend")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	period := c.Query("period")
	if period == "" {
		period = "week"
	}
	trend, err := h.svc.GetTimeTrend(ctx, tenantID, period)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, trend)
}
