package handler

import (
	"orion/config-mgmt-svc-go/internal/config/models"
	"orion/config-mgmt-svc-go/internal/config/service"

	"github.com/gin-gonic/gin"
)

type FeatureFlagHandler struct {
	svc *service.FeatureFlagService
}

func NewFeatureFlagHandler(svc *service.FeatureFlagService) *FeatureFlagHandler {
	return &FeatureFlagHandler{svc: svc}
}

func (h *FeatureFlagHandler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateFeatureFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	flag, err := h.svc.Create(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, flag)
}

func (h *FeatureFlagHandler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")
	flag, err := h.svc.Get(c.Request.Context(), tenantID, c.Param("key"), env)
	if err != nil {
		respondNotFound(c, "feature flag not found")
		return
	}
	respondSuccess(c, flag)
}

func (h *FeatureFlagHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")
	flags, err := h.svc.List(c.Request.Context(), tenantID, env)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": flags})
}

func (h *FeatureFlagHandler) Update(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")
	var req models.UpdateFeatureFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	flag, err := h.svc.Update(c.Request.Context(), tenantID, c.Param("key"), env, req)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, flag)
}

func (h *FeatureFlagHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("key"), env); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *FeatureFlagHandler) Evaluate(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.EvaluateFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.EvaluateFlag(c.Request.Context(), tenantID, req)
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
