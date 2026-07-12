package handler

import (
	"orion-build-env-svc-go/internal/models"
	cacheSVC "orion-build-env-svc-go/internal/cache_monitor/service"

	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *cacheSVC.Service
}

func NewHandler(svc *cacheSVC.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/cache-monitor/dashboard", auth.RequirePermission("cache_monitor", "read"), h.GetDashboard)
	rg.GET("/cache-monitor/metrics/:cacheId", auth.RequirePermission("cache_monitor", "read"), h.GetMetrics)
	rg.GET("/cache-monitor/health/:cacheId", auth.RequirePermission("cache_monitor", "read"), h.AssessHealth)
	rg.GET("/cache-monitor/impact/:pipelineId", auth.RequirePermission("cache_monitor", "read"), h.AnalyzePerformanceImpact)
	rg.POST("/cache-monitor/event", auth.RequirePermission("cache_monitor", "write"), h.RecordEvent)
}

func (h *Handler) RecordEvent(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.RecordCacheEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.RecordEvent(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) GetDashboard(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	dashboard, err := h.svc.GetDashboard(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, dashboard)
}

func (h *Handler) GetMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	cacheID := c.Param("cacheId")
	metrics, err := h.svc.GetMetrics(c.Request.Context(), tenantID, cacheID)
	if err != nil {
		respondNotFound(c, "not found")
		return
	}
	respondSuccess(c, metrics)
}

func (h *Handler) AssessHealth(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	cacheID := c.Param("cacheId")
	health, err := h.svc.AssessHealth(c.Request.Context(), tenantID, cacheID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, health)
}

func (h *Handler) AnalyzePerformanceImpact(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")
	impact, err := h.svc.AnalyzePerformanceImpact(c.Request.Context(), tenantID, pipelineID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, impact)
}
