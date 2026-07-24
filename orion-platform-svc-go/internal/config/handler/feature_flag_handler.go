package handler

import (
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
	tenantID := c.GetString("tenant_id")
	var req models.CreateFeatureFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	flag, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, flag)
}

func (h *FeatureFlagHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	key := c.Param("key")
	env := c.Query("environment")
	flag, err := h.svc.Get(c.Request.Context(), tenantID, key, env)
	if err != nil {
		middleware.RespondNotFound(c, "feature flag not found")
		return
	}
	middleware.RespondSuccess(c, flag)
}

func (h *FeatureFlagHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")
	flags, err := h.svc.List(c.Request.Context(), tenantID, env)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, flags)
}

func (h *FeatureFlagHandler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	key := c.Param("key")
	env := c.Query("environment")
	var req models.UpdateFeatureFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	flag, err := h.svc.Update(c.Request.Context(), tenantID, key, env, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, flag)
}

func (h *FeatureFlagHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	key := c.Param("key")
	env := c.Query("environment")
	if err := h.svc.Delete(c.Request.Context(), tenantID, key, env); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "feature flag deleted"})
}

func (h *FeatureFlagHandler) Evaluate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.EvaluateFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.EvaluateFlag(c.Request.Context(), tenantID, req)
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
