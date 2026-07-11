package handler

import (
	"net/http"

	"orion-build-env-svc-go/internal/models"
	cacheSVC "orion-build-env-svc-go/internal/cache_monitor/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *cacheSVC.Service
}

func NewHandler(svc *cacheSVC.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/cache-monitor/dashboard", h.GetDashboard)
	rg.GET("/cache-monitor/metrics/:cacheId", h.GetMetrics)
	rg.GET("/cache-monitor/health/:cacheId", h.AssessHealth)
	rg.GET("/cache-monitor/impact/:pipelineId", h.AnalyzePerformanceImpact)
	rg.POST("/cache-monitor/event", h.RecordEvent)
}

func (h *Handler) RecordEvent(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.RecordCacheEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "error": err.Error()})
		return
	}
	m, err := h.svc.RecordEvent(c.Request.Context(), tenantID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": m})
}

func (h *Handler) GetDashboard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	dashboard, err := h.svc.GetDashboard(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": dashboard})
}

func (h *Handler) GetMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	cacheID := c.Param("cacheId")
	metrics, err := h.svc.GetMetrics(c.Request.Context(), tenantID, cacheID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 404, "error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": metrics})
}

func (h *Handler) AssessHealth(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	cacheID := c.Param("cacheId")
	health, err := h.svc.AssessHealth(c.Request.Context(), tenantID, cacheID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": health})
}

func (h *Handler) AnalyzePerformanceImpact(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")
	impact, err := h.svc.AnalyzePerformanceImpact(c.Request.Context(), tenantID, pipelineID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": impact})
}
