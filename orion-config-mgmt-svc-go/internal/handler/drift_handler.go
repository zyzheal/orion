package handler

import (
	"net/http"

	"orion/config-mgmt-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

type DriftHandler struct {
	svc *service.DriftService
}

func NewDriftHandler(svc *service.DriftService) *DriftHandler {
	return &DriftHandler{svc: svc}
}

func (h *DriftHandler) Scan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")
	if env == "" {
		env = "production"
	}
	result, err := h.svc.ScanForDrift(c.Request.Context(), tenantID, env)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *DriftHandler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	env := c.Query("environment")
	unresolved := c.Query("unresolved") == "true"
	drifts, err := h.svc.ListDrifts(c.Request.Context(), tenantID, env, unresolved)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": drifts, "count": len(drifts)})
}

func (h *DriftHandler) Resolve(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req struct {
		Resolution string `json:"resolution" binding:"required"`
		ResolvedBy string `json:"resolved_by"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.ResolveDrift(c.Request.Context(), tenantID, c.Param("id"), req.ResolvedBy, req.Resolution); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "resolved"})
}

func (h *DriftHandler) RegisterRoutes(rg *gin.RouterGroup) {
	d := rg.Group("/drifts")
	{
		d.POST("/scan", h.Scan)
		d.GET("", h.List)
		d.POST("/:id/resolve", h.Resolve)
	}
}
