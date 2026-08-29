package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/monitoring/internal/cache-monitor/models"
	"orion/platform-svc-go/internal/monitoring/internal/cache-monitor/service"
	"orion/platform-svc-go/internal/monitoring/internal/response_writer"
)

type CacheMonitorHandler struct {
	svc *service.CacheMonitorService
}

func NewCacheMonitorHandler(svc *service.CacheMonitorService) *CacheMonitorHandler {
	return &CacheMonitorHandler{svc: svc}
}

func (h *CacheMonitorHandler) RegisterRoutes(rg *gin.RouterGroup) {
	cache := rg.Group("/cache-monitor")
	cache.GET("/metrics", auth.RequirePermission("monitor", "read"), h.GetMetrics)
	cache.GET("/metrics/:name", auth.RequirePermission("monitor", "read"), h.GetCacheMetrics)
	cache.GET("/health", auth.RequirePermission("monitor", "read"), h.GetHealth)
	cache.POST("/register", auth.RequirePermission("monitor", "write"), h.RegisterCache)
	cache.PATCH("/enable/:name", auth.RequirePermission("monitor", "write"), h.EnableCache)
	cache.PATCH("/disable/:name", auth.RequirePermission("monitor", "write"), h.DisableCache)
	cache.DELETE("/:name", auth.RequirePermission("monitor", "delete"), h.UnregisterCache)
}

func (h *CacheMonitorHandler) GetMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorCacheGetMetrics")
	defer span.End()
	metrics := h.svc.CollectMetrics(ctx)
	response_writer.Respond(c, http.StatusOK, metrics)
}

func (h *CacheMonitorHandler) GetCacheMetrics(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorCacheGetMetricsByName")
	defer span.End()
	name := c.Param("name")
	metrics, ok := h.svc.GetMetrics(name)
	if !ok {
		response_writer.RespondNotFound(c, "cache not found: "+name)
		return
	}
	response_writer.Respond(c, http.StatusOK, metrics)
}

func (h *CacheMonitorHandler) GetHealth(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorCacheGetHealth")
	defer span.End()
	health := h.svc.GetHealth()
	response_writer.Respond(c, http.StatusOK, health)
}

func (h *CacheMonitorHandler) RegisterCache(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorCacheRegister")
	defer span.End()
	var req models.CacheConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		response_writer.RespondBadRequest(c, err.Error())
		return
	}
	if req.Name == "" {
		req.Name = req.Type
	}
	h.svc.RegisterCache(&req)
	response_writer.RespondCreated(c, gin.H{"name": req.Name, "message": "registered"})
}

func (h *CacheMonitorHandler) EnableCache(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorCacheEnable")
	defer span.End()
	name := c.Param("name")
	h.svc.EnableCache(name)
	response_writer.Respond(c, http.StatusOK, gin.H{"message": "cache enabled", "name": name})
}

func (h *CacheMonitorHandler) DisableCache(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorCacheDisable")
	defer span.End()
	name := c.Param("name")
	h.svc.DisableCache(name)
	response_writer.Respond(c, http.StatusOK, gin.H{"message": "cache disabled", "name": name})
}

func (h *CacheMonitorHandler) UnregisterCache(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "MonitorCacheUnregister")
	defer span.End()
	name := c.Param("name")
	h.svc.UnregisterCache(name)
	c.JSON(http.StatusNoContent, nil)
}
