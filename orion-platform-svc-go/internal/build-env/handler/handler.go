package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/build-env/models"
	"orion/platform-svc-go/internal/build-env/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all build-env endpoints under the given group.
// Mirrors /api/v1/build-env routes from the TS source (23 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/build-env")

	// --- Builds ---
	// GET /build-env/builds - List builds
	f.GET("/builds", auth.RequirePermission("build_env", "read"), h.ListBuilds)
	// GET /build-env/builds/:id - Get build by ID
	f.GET("/builds/:id", auth.RequirePermission("build_env", "read"), h.GetBuild)
	// POST /build-env/builds - Create build
	f.POST("/builds", auth.RequirePermission("build_env", "write"), h.CreateBuild)
	// PUT /build-env/builds/:id - Update build
	f.PUT("/builds/:id", auth.RequirePermission("build_env", "write"), h.UpdateBuild)
	// DELETE /build-env/builds/:id - Delete build
	f.DELETE("/builds/:id", auth.RequirePermission("build_env", "delete"), h.DeleteBuild)

	// --- Build Images ---
	// GET /build-env/build-images - List build images
	rg.GET("/build-env/build-images", auth.RequirePermission("build_env", "read"), h.ListBuildImages)
	// GET /build-env/build-images/:id - Get build image by ID
	rg.GET("/build-env/build-images/:id", auth.RequirePermission("build_env", "read"), h.GetBuildImage)
	// POST /build-env/build-images - Create build image
	rg.POST("/build-env/build-images", auth.RequirePermission("build_env", "write"), h.CreateBuildImage)
	// PUT /build-env/build-images/:id - Update build image
	rg.PUT("/build-env/build-images/:id", auth.RequirePermission("build_env", "write"), h.UpdateBuildImage)
	// DELETE /build-env/build-images/:id - Delete build image
	rg.DELETE("/build-env/build-images/:id", auth.RequirePermission("build_env", "delete"), h.DeleteBuildImage)

	// --- Build Cache ---
	// GET /build-env/build-cache - List cache configs
	f.GET("/build-cache", auth.RequirePermission("build_env", "read"), h.ListCacheConfigs)
	// GET /build-env/build-cache/:id - Get cache config by ID
	f.GET("/build-cache/:id", auth.RequirePermission("build_env", "read"), h.GetCacheConfig)
	// POST /build-env/build-cache - Create cache config
	f.POST("/build-cache", auth.RequirePermission("build_env", "write"), h.CreateCacheConfig)
	// PUT /build-env/build-cache/:id - Update cache config
	f.PUT("/build-cache/:id", auth.RequirePermission("build_env", "write"), h.UpdateCacheConfig)
	// DELETE /build-env/build-cache/:id - Delete cache config
	f.DELETE("/build-cache/:id", auth.RequirePermission("build_env", "delete"), h.DeleteCacheConfig)

	// --- Build Logs ---
	// GET /build-env/build-logs - List build logs
	f.GET("/build-logs", auth.RequirePermission("build_env", "read"), h.ListBuildLogs)
	// GET /build-env/build-logs/:id - Get build log by ID
	f.GET("/build-logs/:id", auth.RequirePermission("build_env", "read"), h.GetBuildLog)

	// --- Cache Monitor ---
	// GET /build-env/cache-monitor/dashboard - Get cache monitoring dashboard
	f.GET("/cache-monitor/dashboard", auth.RequirePermission("build_env", "read"), h.GetCacheDashboard)
	// GET /build-env/cache-monitor/metrics/:cacheId - Get cache metrics
	f.GET("/cache-monitor/metrics/:cacheId", auth.RequirePermission("build_env", "read"), h.GetCacheMetrics)
	// GET /build-env/cache-monitor/health/:cacheId - Assess cache health
	f.GET("/cache-monitor/health/:cacheId", auth.RequirePermission("build_env", "read"), h.AssessCacheHealth)
	// GET /build-env/cache-monitor/impact/:pipelineId - Analyze performance impact
	f.GET("/cache-monitor/impact/:pipelineId", auth.RequirePermission("build_env", "read"), h.AnalyzePerformanceImpact)
	// POST /build-env/cache-monitor/event - Record cache event
	f.POST("/cache-monitor/event", auth.RequirePermission("build_env", "write"), h.RecordCacheEvent)
}

// --- Build handlers ---

func (h *Handler) ListBuilds(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBuilds")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := 0
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil {
			offset = (v - 1) * limit
		}
	}
	items, err := h.svc.ListBuilds(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"builds": items,
		"total":  len(items),
	})
}

func (h *Handler) GetBuild(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBuild")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetBuild(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "build not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) CreateBuild(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateBuild")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateBuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateBuild(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) UpdateBuild(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateBuild")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateBuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.UpdateBuild(ctx, tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "build not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) DeleteBuild(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteBuild")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteBuild(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	c.Writer.WriteHeader(http.StatusNoContent)
	c.Writer.Flush()
}

// --- Build Image handlers ---

func (h *Handler) ListBuildImages(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBuildImages")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListBuildImages(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"images": items,
		"total":  len(items),
	})
}

func (h *Handler) GetBuildImage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBuildImage")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetBuildImage(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) CreateBuildImage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateBuildImage")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateBuildImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateBuildImage(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) UpdateBuildImage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateBuildImage")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateBuildImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.UpdateBuildImage(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) DeleteBuildImage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteBuildImage")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteBuildImage(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	c.Writer.WriteHeader(http.StatusNoContent)
	c.Writer.Flush()
}

// --- Build Cache handlers ---

func (h *Handler) ListCacheConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCacheConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	level := c.Query("level")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	configs, err := h.svc.ListCacheConfigs(ctx, tenantID, level, status, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"configs": configs,
		"total":   len(configs),
	})
}

func (h *Handler) GetCacheConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCacheConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	config, err := h.svc.GetCacheConfig(ctx, tenantID, id)
	if err != nil {
		if service.IsInvalidID(err) {
			middleware.RespondBadRequest(c, "invalid config id")
			return
		}
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "cache config not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, config)
}

func (h *Handler) CreateCacheConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateCacheConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateBuildCacheConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	config, err := h.svc.CreateCacheConfig(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, config)
}

func (h *Handler) UpdateCacheConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateCacheConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateBuildCacheConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	config, err := h.svc.UpdateCacheConfig(ctx, tenantID, id, req)
	if err != nil {
		if service.IsInvalidID(err) {
			middleware.RespondBadRequest(c, "invalid config id")
			return
		}
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "cache config not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, config)
}

func (h *Handler) DeleteCacheConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteCacheConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteCacheConfig(ctx, tenantID, id); err != nil {
		if service.IsInvalidID(err) {
			middleware.RespondBadRequest(c, "invalid config id")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	c.Writer.WriteHeader(http.StatusNoContent)
	c.Writer.Flush()
}

// --- Build Log handlers ---

func (h *Handler) ListBuildLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBuildLogs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	logs, err := h.svc.ListBuildLogs(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"logs":  logs,
		"total": len(logs),
	})
}

func (h *Handler) GetBuildLog(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBuildLog")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	log, err := h.svc.GetBuildLog(ctx, tenantID, id)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, log)
}

// --- Cache Monitor handlers ---

func (h *Handler) GetCacheDashboard(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCacheDashboard")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	dashboard, err := h.svc.GetDashboard(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, dashboard)
}

func (h *Handler) GetCacheMetrics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCacheMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	cacheID := c.Param("cacheId")
	metrics, err := h.svc.GetCacheMetrics(ctx, tenantID, cacheID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "cache not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, metrics)
}

func (h *Handler) AssessCacheHealth(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AssessCacheHealth")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	cacheID := c.Param("cacheId")
	health, err := h.svc.AssessCacheHealth(ctx, tenantID, cacheID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, health)
}

func (h *Handler) AnalyzePerformanceImpact(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AnalyzePerformanceImpact")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	pipelineID := c.Param("pipelineId")
	impact, err := h.svc.AnalyzePerformanceImpact(ctx, tenantID, pipelineID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, impact)
}

func (h *Handler) RecordCacheEvent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecordCacheEvent")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.RecordCacheEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.RecordCacheEvent(ctx, tenantID, req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "cache event recorded"})
}
