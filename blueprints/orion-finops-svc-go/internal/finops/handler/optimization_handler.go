package handler

import (
	"orion/finops-svc-go/internal/finops/models"
	"orion/finops-svc-go/internal/finops/service"

	"github.com/gin-gonic/gin"
)

type OptimizationHandler struct {
	svc *service.OptimizationService
}

func NewOptimizationHandler(svc *service.OptimizationService) *OptimizationHandler {
	return &OptimizationHandler{svc: svc}
}

func (h *OptimizationHandler) Analyze(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var req models.AnalyzeOptimizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	opts, err := h.svc.AnalyzeUtilization(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"opts": opts, "count": len(opts)})
}

func (h *OptimizationHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	category := models.OptimizationCategory(c.Query("category"))
	status := models.OptimizationStatus(c.Query("status"))

	opts, err := h.svc.ListOptimizations(c.Request.Context(), tenantID, category, status)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, opts)
}

func (h *OptimizationHandler) UpdateStatus(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var req struct {
		Status models.OptimizationStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	if err := h.svc.UpdateStatus(c.Request.Context(), tenantID, id, req.Status); err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "updated"})
}

func (h *OptimizationHandler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *OptimizationHandler) GetSavings(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	category := models.OptimizationCategory(c.Query("category"))
	status := models.OptimizationStatus(c.Query("status"))

	savings, err := h.svc.GetSavingsEstimate(c.Request.Context(), tenantID, category, status)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, savings)
}

func (h *OptimizationHandler) GetRightSizing(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	recs, err := h.svc.GenerateRightSizingRecommendations(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"recommendations": recs, "count": len(recs)})
}

func (h *OptimizationHandler) GetUnusedResources(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	resources, err := h.svc.GetUnusedResources(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	respondSuccess(c, gin.H{"resources": resources, "count": len(resources)})
}

func (h *OptimizationHandler) RegisterRoutes(rg *gin.RouterGroup) {
	opt := rg.Group("/optimizations")
	{
		opt.POST("/analyze", h.Analyze)
		opt.GET("", h.List)
		opt.PUT("/:id/status", h.UpdateStatus)
		opt.DELETE("/:id", h.Delete)
		opt.GET("/savings", h.GetSavings)
		opt.GET("/right-sizing", h.GetRightSizing)
		opt.GET("/unused-resources", h.GetUnusedResources)
	}
}
