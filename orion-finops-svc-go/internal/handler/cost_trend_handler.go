package handler

import (
	"net/http"

	"orion/finops-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

type CostTrendHandler struct {
	svc *service.CostTrendService
}

func NewCostTrendHandler(svc *service.CostTrendService) *CostTrendHandler {
	return &CostTrendHandler{svc: svc}
}

func (h *CostTrendHandler) GetTrend(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	periodStart := c.Query("period_start")
	periodEnd := c.Query("period_end")

	trend, err := h.svc.GetCostTrend(c.Request.Context(), tenantID, periodStart, periodEnd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, trend)
}

func (h *CostTrendHandler) GetByService(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	periodStart := c.Query("period_start")
	periodEnd := c.Query("period_end")

	data, err := h.svc.GetCostByService(c.Request.Context(), tenantID, periodStart, periodEnd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func (h *CostTrendHandler) GetK8sByNamespace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	periodStart := c.Query("period_start")
	periodEnd := c.Query("period_end")

	data, err := h.svc.GetK8sCostByNamespace(c.Request.Context(), tenantID, periodStart, periodEnd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

func (h *CostTrendHandler) DetectAnomalies(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	periodStart := c.Query("period_start")
	periodEnd := c.Query("period_end")

	anomalies, err := h.svc.DetectAnomalies(c.Request.Context(), tenantID, periodStart, periodEnd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": anomalies, "count": len(anomalies)})
}

func (h *CostTrendHandler) GetROI(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	roi, err := h.svc.CalculateROI(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, roi)
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
