package handler

import (
	"errors"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/build-env/models"
	"orion/platform-svc-go/internal/build-env/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// tenantKey is the exact context key that orion-go-common/pkg/auth's JWT
// middleware writes (middleware.go: c.Set("tenant_id", …)). Nothing in the
// platform copies it into camelCase.
//
// This handler read that key but never checked it. c.GetString on a missing key
// returns "", and every query here is keyed "WHERE tenant_id = $1", so a
// request with no authenticated tenant searched the empty-string bucket instead
// of failing. A 401 costs one round trip; a query that quietly returns nobody
// else's absence costs a wrong answer.
const tenantKey = "tenant_id"

// defaultListLimit is shared by all four list endpoints.
const defaultListLimit = 50

type Handler struct {
	svc service.ServiceInterface
}

func NewHandler(svc service.ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all build-env endpoints under the given group.
// Mirrors /api/v1/build-env from the TS source (22 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/build-env")

	// --- Builds ---
	f.GET("/builds", auth.RequirePermission("build_env", "read"), h.ListBuilds)
	f.GET("/builds/:id", auth.RequirePermission("build_env", "read"), h.GetBuild)
	f.POST("/builds", auth.RequirePermission("build_env", "write"), h.CreateBuild)
	f.PUT("/builds/:id", auth.RequirePermission("build_env", "write"), h.UpdateBuild)
	f.DELETE("/builds/:id", auth.RequirePermission("build_env", "delete"), h.DeleteBuild)

	// --- Build Images ---
	f.GET("/build-images", auth.RequirePermission("build_env", "read"), h.ListBuildImages)
	f.GET("/build-images/:id", auth.RequirePermission("build_env", "read"), h.GetBuildImage)
	f.POST("/build-images", auth.RequirePermission("build_env", "write"), h.CreateBuildImage)
	f.PUT("/build-images/:id", auth.RequirePermission("build_env", "write"), h.UpdateBuildImage)
	f.DELETE("/build-images/:id", auth.RequirePermission("build_env", "delete"), h.DeleteBuildImage)

	// --- Build Cache ---
	f.GET("/build-cache", auth.RequirePermission("build_env", "read"), h.ListCacheConfigs)
	f.GET("/build-cache/:id", auth.RequirePermission("build_env", "read"), h.GetCacheConfig)
	f.POST("/build-cache", auth.RequirePermission("build_env", "write"), h.CreateCacheConfig)
	f.PUT("/build-cache/:id", auth.RequirePermission("build_env", "write"), h.UpdateCacheConfig)
	f.DELETE("/build-cache/:id", auth.RequirePermission("build_env", "delete"), h.DeleteCacheConfig)

	// --- Build Logs ---
	f.GET("/build-logs", auth.RequirePermission("build_env", "read"), h.ListBuildLogs)
	f.GET("/build-logs/:id", auth.RequirePermission("build_env", "read"), h.GetBuildLog)

	// --- Cache Monitor ---
	f.GET("/cache-monitor/dashboard", auth.RequirePermission("build_env", "read"), h.GetCacheDashboard)
	f.GET("/cache-monitor/metrics/:cacheId", auth.RequirePermission("build_env", "read"), h.GetCacheMetrics)
	f.GET("/cache-monitor/health/:cacheId", auth.RequirePermission("build_env", "read"), h.AssessCacheHealth)
	f.GET("/cache-monitor/impact/:pipelineId", auth.RequirePermission("build_env", "read"), h.AnalyzePerformanceImpact)
	f.POST("/cache-monitor/event", auth.RequirePermission("build_env", "write"), h.RecordCacheEvent)
}

// requireTenant returns the caller's tenant id or fails closed.
//
// It must reject an empty tenant rather than pass it through: every query in
// this module is tenant-scoped, so an empty tenant is a valid-looking predicate
// value that matches nothing — and nothing at all would have looked like "no
// such record" to the caller.
func (h *Handler) requireTenant(c *gin.Context) (string, bool) {
	tenantID := c.GetString(tenantKey)
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return "", false
	}
	return tenantID, true
}

// listParams resolves limit and offset for the list endpoints.
//
// offset is primary; page is accepted as an alias only when offset is absent,
// converting a 1-based page number into an offset. ListBuilds took page while
// the other three list endpoints took offset, and defaulted limit to 20 while
// they defaulted it to 50, so the same pagination shape behaved differently per
// endpoint. Now both spellings work, offset wins when both are given, and the
// default limit is one constant.
func listParams(c *gin.Context) (limit, offset int) {
	limit = defaultListLimit
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	offset = 0
	if v := c.Query("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
		return limit, offset
	}
	if v := c.Query("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 1 {
			offset = (n - 1) * limit
		}
	}
	return limit, offset
}

// fail maps a service error to its status code. notFound is the message used
// when the repository reports sentinel.NotFound; badRequest covers the
// repository and service guards that report sentinel.BadRequest.
func fail(c *gin.Context, err error, notFound string) {
	if service.IsNotFound(err) {
		middleware.RespondNotFound(c, notFound)
		return
	}
	if errors.Is(err, sentinel.BadRequest) {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondInternalError(c, err.Error())
}

// --- Build handlers ---

func (h *Handler) ListBuilds(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBuilds")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	limit, offset := listParams(c)
	items, err := h.svc.ListBuilds(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"builds": items, "total": len(items)})
}

func (h *Handler) GetBuild(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBuild")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	id := c.Param("id")
	m, err := h.svc.GetBuild(ctx, tenantID, id)
	if err != nil {
		fail(c, err, "build not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) CreateBuild(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateBuild")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
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
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	id := c.Param("id")
	var req models.UpdateBuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.UpdateBuild(ctx, tenantID, id, req)
	if err != nil {
		fail(c, err, "build not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) DeleteBuild(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteBuild")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	if err := h.svc.DeleteBuild(ctx, tenantID, c.Param("id")); err != nil {
		fail(c, err, "build not found")
		return
	}
	middleware.RespondNoContent(c)
}

// --- Build Image handlers ---

func (h *Handler) ListBuildImages(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBuildImages")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	limit, offset := listParams(c)
	items, err := h.svc.ListBuildImages(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"images": items, "total": len(items)})
}

func (h *Handler) GetBuildImage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBuildImage")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	m, err := h.svc.GetBuildImage(ctx, tenantID, c.Param("id"))
	if err != nil {
		fail(c, err, "build image not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) CreateBuildImage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateBuildImage")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
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
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	id := c.Param("id")
	var req models.UpdateBuildImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.UpdateBuildImage(ctx, tenantID, id, req)
	if err != nil {
		fail(c, err, "build image not found")
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) DeleteBuildImage(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteBuildImage")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	if err := h.svc.DeleteBuildImage(ctx, tenantID, c.Param("id")); err != nil {
		fail(c, err, "build image not found")
		return
	}
	middleware.RespondNoContent(c)
}

// --- Build Cache handlers ---

func (h *Handler) ListCacheConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCacheConfigs")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	limit, offset := listParams(c)
	configs, err := h.svc.ListCacheConfigs(ctx, tenantID, c.Query("level"), c.Query("status"), limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"configs": configs, "total": len(configs)})
}

func (h *Handler) GetCacheConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCacheConfig")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	config, err := h.svc.GetCacheConfig(ctx, tenantID, c.Param("id"))
	if err != nil {
		fail(c, err, "cache config not found")
		return
	}
	middleware.RespondSuccess(c, config)
}

func (h *Handler) CreateCacheConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateCacheConfig")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
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
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	id := c.Param("id")
	var req models.UpdateBuildCacheConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	config, err := h.svc.UpdateCacheConfig(ctx, tenantID, id, req)
	if err != nil {
		fail(c, err, "cache config not found")
		return
	}
	middleware.RespondSuccess(c, config)
}

func (h *Handler) DeleteCacheConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteCacheConfig")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	if err := h.svc.DeleteCacheConfig(ctx, tenantID, c.Param("id")); err != nil {
		fail(c, err, "cache config not found")
		return
	}
	middleware.RespondNoContent(c)
}

// --- Build Log handlers ---

func (h *Handler) ListBuildLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBuildLogs")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	limit, offset := listParams(c)
	logs, err := h.svc.ListBuildLogs(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"logs": logs, "total": len(logs)})
}

func (h *Handler) GetBuildLog(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetBuildLog")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	log, err := h.svc.GetBuildLog(ctx, tenantID, c.Param("id"))
	if err != nil {
		fail(c, err, "build log not found")
		return
	}
	middleware.RespondSuccess(c, log)
}

// --- Cache Monitor handlers ---

func (h *Handler) GetCacheDashboard(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCacheDashboard")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
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
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	metrics, err := h.svc.GetCacheMetrics(ctx, tenantID, c.Param("cacheId"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, metrics)
}

func (h *Handler) AssessCacheHealth(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AssessCacheHealth")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	health, err := h.svc.AssessCacheHealth(ctx, tenantID, c.Param("cacheId"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, health)
}

func (h *Handler) AnalyzePerformanceImpact(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AnalyzePerformanceImpact")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	impact, err := h.svc.AnalyzePerformanceImpact(ctx, tenantID, c.Param("pipelineId"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, impact)
}

func (h *Handler) RecordCacheEvent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecordCacheEvent")
	defer span.End()
	tenantID, ok := h.requireTenant(c)
	if !ok {
		return
	}
	var req models.RecordCacheEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.RecordCacheEvent(ctx, tenantID, req); err != nil {
		fail(c, err, "cache event not found")
		return
	}
	middleware.RespondCreated(c, gin.H{"message": "cache event recorded"})
}
