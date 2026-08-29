package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/finops/finops/service"

	"github.com/gin-gonic/gin"
)

type CostTrendHandler struct {
	svc *service.CostTrendService
}

func NewCostTrendHandler(svc *service.CostTrendService) *CostTrendHandler {
	return &CostTrendHandler{svc: svc}
}

func (h *CostTrendHandler) GetTrend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsGetTrend")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	periodStart := c.Query("period_start")
	periodEnd := c.Query("period_end")

	trend, err := h.svc.GetCostTrend(ctx, tenantID, periodStart, periodEnd)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, trend)
}

func (h *CostTrendHandler) GetByService(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsGetByService")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	periodStart := c.Query("period_start")
	periodEnd := c.Query("period_end")

	data, err := h.svc.GetCostByService(ctx, tenantID, periodStart, periodEnd)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, data)
}

func (h *CostTrendHandler) GetK8sByNamespace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsGetK8sByNamespace")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	periodStart := c.Query("period_start")
	periodEnd := c.Query("period_end")

	data, err := h.svc.GetK8sCostByNamespace(ctx, tenantID, periodStart, periodEnd)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, data)
}

func (h *CostTrendHandler) DetectAnomalies(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsDetectAnomalies")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	periodStart := c.Query("period_start")
	periodEnd := c.Query("period_end")

	anomalies, err := h.svc.DetectAnomalies(ctx, tenantID, periodStart, periodEnd)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"anomalies": anomalies, "count": len(anomalies)})
}

func (h *CostTrendHandler) GetROI(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "FinopsGetROI")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	roi, err := h.svc.CalculateROI(ctx, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, roi)
}

func (h *CostTrendHandler) RegisterRoutes(rg *gin.RouterGroup) {
	costs := rg.Group("/costs")
	{
		costs.GET("/trend", h.GetTrend)
		costs.GET("/by-service", h.GetByService)
		costs.GET("/k8s/by-namespace", h.GetK8sByNamespace)
		costs.GET("/anomalies", h.DetectAnomalies)
		costs.GET("/roi", h.GetROI)
	}
}
