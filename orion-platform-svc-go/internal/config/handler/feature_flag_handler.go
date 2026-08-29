package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/config/models"
	"orion/platform-svc-go/internal/config/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
)

// FeatureFlagHandler handles feature flag endpoints.
type FeatureFlagHandler struct {
	svc *service.FeatureFlagService
}

// NewFeatureFlagHandler creates a new FeatureFlagHandler.
func NewFeatureFlagHandler(svc *service.FeatureFlagService) *FeatureFlagHandler {
	return &FeatureFlagHandler{svc: svc}
}

func (h *FeatureFlagHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateFeatureFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	flag, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, flag)
}

func (h *FeatureFlagHandler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	key := c.Param("key")
	env := c.Query("environment")
	flag, err := h.svc.Get(ctx, tenantID, key, env)
	if err != nil {
		middleware.RespondNotFound(c, "feature flag not found")
		return
	}
	middleware.RespondSuccess(c, flag)
}

func (h *FeatureFlagHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")
	flags, err := h.svc.List(ctx, tenantID, env)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, flags)
}

func (h *FeatureFlagHandler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigUpdate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	key := c.Param("key")
	env := c.Query("environment")
	var req models.UpdateFeatureFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	flag, err := h.svc.Update(ctx, tenantID, key, env, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, flag)
}

func (h *FeatureFlagHandler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	key := c.Param("key")
	env := c.Query("environment")
	if err := h.svc.Delete(ctx, tenantID, key, env); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "feature flag deleted"})
}

func (h *FeatureFlagHandler) Evaluate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigEvaluate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.EvaluateFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.EvaluateFlag(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// RegisterRoutes registers feature flag routes.
func (h *FeatureFlagHandler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/feature-flags")
	{
		f.POST("", h.Create)
		f.GET("", h.List)
		f.GET("/:key", h.Get)
		f.PUT("/:key", h.Update)
		f.DELETE("/:key", h.Delete)
		f.POST("/evaluate", h.Evaluate)
	}
}
