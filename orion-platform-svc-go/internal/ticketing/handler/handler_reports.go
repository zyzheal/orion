package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/middleware"
)

// GetSLACompliance returns the SLA compliance report.
func (h *Handler) GetSLACompliance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSLACompliance")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	report, err := h.svc.GetSLACompliance(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

// GetResolutionStats returns resolution statistics.
func (h *Handler) GetResolutionStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetResolutionStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetResolutionStats(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// GetBacklogAnalysis returns backlog analysis.
func (h *Handler) GetBacklogAnalysis(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBacklogAnalysis")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	analysis, err := h.svc.GetBacklogAnalysis(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, analysis)
}

// GetTrendReport returns the trend report.
func (h *Handler) GetTrendReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTrendReport")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	report, err := h.svc.GetTrendReport(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}

// GetStatistics returns ticketing statistics.
func (h *Handler) GetStatistics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStatistics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	report, err := h.svc.GetStatistics(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, report)
}
