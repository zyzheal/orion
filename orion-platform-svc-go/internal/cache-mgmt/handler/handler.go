package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/cache-mgmt/models"
	"orion/platform-svc-go/internal/cache-mgmt/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	CreateConfig(ctx context.Context, tenantID string, req models.CreateCacheConfigRequest) (*models.CacheConfig, error)
	GetConfig(ctx context.Context, tenantID, id string) (*models.CacheConfig, error)
	ListConfigs(ctx context.Context, tenantID string, limit, offset int) ([]models.CacheConfig, error)
	UpdateConfig(ctx context.Context, tenantID, id string, req models.UpdateCacheConfigRequest) (*models.CacheConfig, error)
	DeleteConfig(ctx context.Context, tenantID, id string) error
	Flush(ctx context.Context, tenantID, configID string) error
	EvictKey(ctx context.Context, tenantID, configID, key string) error
	GetCachedValue(ctx context.Context, tenantID, configID, key string) (*models.CacheValueResponse, error)
	SetCachedValue(ctx context.Context, tenantID, configID, key string, value interface{}) error
	DeleteCachedValue(ctx context.Context, tenantID, configID, key string) error
	GetStats(ctx context.Context, tenantID, configID string) (*models.StatsList, error)
	ClearAllCaches(ctx context.Context) error
}

// Handler wires Gin routes to the cache-mgmt service.
type Handler struct {
	svc Service
}

// NewHandler creates a new handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all cache-mgmt endpoints under the given group.
// Base prefix: /api/cache/configs
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/cache/configs")

	// --- Config CRUD ---
	f.POST("", auth.RequirePermission("cache", "write"), h.CreateConfig)
	f.GET("", auth.RequirePermission("cache", "read"), h.ListConfigs)
	f.GET("/:id", auth.RequirePermission("cache", "read"), h.GetConfig)
	f.PUT("/:id", auth.RequirePermission("cache", "write"), h.UpdateConfig)
	f.DELETE("/:id", auth.RequirePermission("cache", "delete"), h.DeleteConfig)

	// --- Cache operations ---
	f.POST("/:id/flush", auth.RequirePermission("cache", "write"), h.Flush)
	f.POST("/:id/evict", auth.RequirePermission("cache", "write"), h.EvictKey)
	f.GET("/:id/stats", auth.RequirePermission("cache", "read"), h.GetStats)
	f.POST("/:id/get", auth.RequirePermission("cache", "read"), h.GetCachedValue)
	f.POST("/:id/set", auth.RequirePermission("cache", "write"), h.SetCachedValue)
	f.POST("/:id/delete", auth.RequirePermission("cache", "delete"), h.DeleteCachedValue)

	// --- Bulk ---
	f.DELETE("/flush-all", auth.RequirePermission("cache", "delete"), h.FlushAll)
}

// CreateConfig handles POST /cache/configs.
func (h *Handler) CreateConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "cache-mgmt.CreateConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateCacheConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.CreateConfig(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, cfg)
}

// ListConfigs handles GET /cache/configs.
func (h *Handler) ListConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "cache-mgmt.ListConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	configs, err := h.svc.ListConfigs(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, configs)
}

// GetConfig handles GET /cache/configs/:id.
func (h *Handler) GetConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "cache-mgmt.GetConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	cfg, err := h.svc.GetConfig(ctx, tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, "cache config not found")
		return
	}
	middleware.RespondSuccess(c, cfg)
}

// UpdateConfig handles PUT /cache/configs/:id.
func (h *Handler) UpdateConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "cache-mgmt.UpdateConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateCacheConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cfg, err := h.svc.UpdateConfig(ctx, tenantID, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, cfg)
}

// DeleteConfig handles DELETE /cache/configs/:id.
func (h *Handler) DeleteConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "cache-mgmt.DeleteConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteConfig(ctx, tenantID, id); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "cache config deleted"})
}

// Flush handles POST /cache/configs/:id/flush.
func (h *Handler) Flush(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "cache-mgmt.Flush")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	configID := c.Param("id")
	if err := h.svc.Flush(ctx, tenantID, configID); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "cache flushed"})
}

// EvictKey handles POST /cache/configs/:id/evict.
func (h *Handler) EvictKey(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "cache-mgmt.EvictKey")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	configID := c.Param("id")
	var body models.EvictKeyRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.EvictKey(ctx, tenantID, configID, body.Key); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "key evicted"})
}

// GetStats handles GET /cache/configs/:id/stats.
func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "cache-mgmt.GetStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	configID := c.Param("id")
	stats, err := h.svc.GetStats(ctx, tenantID, configID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

// GetCachedValue handles POST /cache/configs/:id/get.
func (h *Handler) GetCachedValue(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "cache-mgmt.GetCachedValue")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	configID := c.Param("id")
	var body models.CacheValueRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	resp, err := h.svc.GetCachedValue(ctx, tenantID, configID, body.Key)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, resp)
}

// SetCachedValue handles POST /cache/configs/:id/set.
func (h *Handler) SetCachedValue(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "cache-mgmt.SetCachedValue")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	configID := c.Param("id")
	var body models.CacheValueRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.SetCachedValue(ctx, tenantID, configID, body.Key, body.Value); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "value cached", "key": body.Key})
}

// DeleteCachedValue handles POST /cache/configs/:id/delete.
func (h *Handler) DeleteCachedValue(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "cache-mgmt.DeleteCachedValue")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	configID := c.Param("id")
	var body models.CacheValueRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.DeleteCachedValue(ctx, tenantID, configID, body.Key); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "value deleted", "key": body.Key})
}

// FlushAll handles DELETE /cache/configs/flush-all.
func (h *Handler) FlushAll(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "cache-mgmt.FlushAll")
	defer span.End()
	if err := h.svc.ClearAllCaches(ctx); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "all caches flushed"})
}
