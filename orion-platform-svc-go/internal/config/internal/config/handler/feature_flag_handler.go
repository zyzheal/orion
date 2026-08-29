package handler

import (
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/config/internal/config/models"
	"orion/platform-svc-go/internal/config/internal/config/service"

	"github.com/gin-gonic/gin"
)

type FeatureFlagHandler struct {
	svc *service.FeatureFlagService
}

func NewFeatureFlagHandler(svc *service.FeatureFlagService) *FeatureFlagHandler {
	return &FeatureFlagHandler{svc: svc}
}

func (h *FeatureFlagHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateFeatureFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	flag, err := h.svc.Create(ctx, tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, flag)
}

func (h *FeatureFlagHandler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")
	flag, err := h.svc.Get(ctx, tenantID, c.Param("key"), env)
	if err != nil {
		respondNotFound(c, "feature flag not found")
		return
	}
	respondSuccess(c, flag)
}

func (h *FeatureFlagHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")
	flags, err := h.svc.List(ctx, tenantID, env)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": flags})
}

func (h *FeatureFlagHandler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigUpdate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")
	var req models.UpdateFeatureFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	flag, err := h.svc.Update(ctx, tenantID, c.Param("key"), env, req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, flag)
}

func (h *FeatureFlagHandler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")
	if err := h.svc.Delete(ctx, tenantID, c.Param("key"), env); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *FeatureFlagHandler) Evaluate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ConfigEvaluate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.EvaluateFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.EvaluateFlag(ctx, tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

func (h *FeatureFlagHandler) RegisterRoutes(rg *gin.RouterGroup) {
	ff := rg.Group("/feature-flags")
	{
		ff.POST("", h.Create)
		ff.GET("", h.List)
		ff.POST("/evaluate", h.Evaluate)
		ff.GET("/:key", h.Get)
		ff.PUT("/:key", h.Update)
		ff.DELETE("/:key", h.Delete)
	}
}
