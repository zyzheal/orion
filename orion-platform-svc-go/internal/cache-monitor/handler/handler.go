package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/cache-monitor/models"
	"orion/platform-svc-go/internal/cache-monitor/service"
	"orion/platform-svc-go/internal/middleware"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCacheMetrics")
	defer span.End()
	metrics := h.svc.CollectMetrics(ctx)
	middleware.RespondSuccess(c, metrics)
}

func (h *CacheMonitorHandler) GetCacheMetrics(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCacheMetricByName")
	defer span.End()
	name := c.Param("name")
	metrics, ok := h.svc.GetMetrics(name)
	if !ok {
		middleware.RespondNotFound(c, "cache not found: "+name)
		return
	}
	middleware.RespondSuccess(c, metrics)
}

func (h *CacheMonitorHandler) GetHealth(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCacheHealth")
	defer span.End()
	health := h.svc.GetHealth()
	middleware.RespondSuccess(c, health)
}

func (h *CacheMonitorHandler) RegisterCache(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterCache")
	defer span.End()
	var req models.CacheConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Name == "" {
		req.Name = req.Type
	}

	h.svc.RegisterCache(&req)
	middleware.RespondCreated(c, gin.H{"name": req.Name, "message": "registered"})
}

func (h *CacheMonitorHandler) EnableCache(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "EnableCache")
	defer span.End()
	name := c.Param("name")
	h.svc.EnableCache(name)
	middleware.RespondSuccess(c, gin.H{"message": "cache enabled", "name": name})
}

func (h *CacheMonitorHandler) DisableCache(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DisableCache")
	defer span.End()
	name := c.Param("name")
	h.svc.DisableCache(name)
	middleware.RespondSuccess(c, gin.H{"message": "cache disabled", "name": name})
}

func (h *CacheMonitorHandler) UnregisterCache(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UnregisterCache")
	defer span.End()
	name := c.Param("name")
	h.svc.UnregisterCache(name)
	c.JSON(http.StatusNoContent, nil)
}
