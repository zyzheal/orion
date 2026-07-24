package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/cache-monitor/models"
	"orion/platform-svc-go/internal/cache-monitor/service"
	"orion/platform-svc-go/internal/middleware"
	"orion/go-common/pkg/auth"
)

type CacheMonitorHandler struct {
	svc *service.CacheMonitorService
}

func NewCacheMonitorHandler(svc *service.CacheMonitorService) *CacheMonitorHandler {
	return &CacheMonitorHandler{svc: svc}
}

// RegisterRoutes registers cache-monitor routes.
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

// GetMetrics returns all cache metrics.
func (h *CacheMonitorHandler) GetMetrics(c *gin.Context) {
	metrics := h.svc.CollectMetrics(c.Request.Context())
	middleware.Respond(c, http.StatusOK, metrics)
}

// GetCacheMetrics returns metrics for a specific cache.
func (h *CacheMonitorHandler) GetCacheMetrics(c *gin.Context) {
	name := c.Param("name")
	metrics, ok := h.svc.GetMetrics(name)
	if !ok {
		middleware.RespondNotFound(c, "cache not found: "+name)
		return
	}
	middleware.Respond(c, http.StatusOK, metrics)
}

// GetHealth returns health status for all caches.
func (h *CacheMonitorHandler) GetHealth(c *gin.Context) {
	health := h.svc.GetHealth()
	middleware.Respond(c, http.StatusOK, health)
}

// RegisterCache registers a new cache for monitoring.
func (h *CacheMonitorHandler) RegisterCache(c *gin.Context) {
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

// EnableCache enables a cache for monitoring.
func (h *CacheMonitorHandler) EnableCache(c *gin.Context) {
	name := c.Param("name")
	h.svc.EnableCache(name)
	middleware.Respond(c, http.StatusOK, gin.H{"message": "cache enabled", "name": name})
}

// DisableCache disables a cache for monitoring.
func (h *CacheMonitorHandler) DisableCache(c *gin.Context) {
	name := c.Param("name")
	h.svc.DisableCache(name)
	middleware.Respond(c, http.StatusOK, gin.H{"message": "cache disabled", "name": name})
}

// UnregisterCache removes a cache from monitoring.
func (h *CacheMonitorHandler) UnregisterCache(c *gin.Context) {
	name := c.Param("name")
	h.svc.UnregisterCache(name)
	c.JSON(http.StatusNoContent, nil)
}
